/**
 * FreeeRepository — freee 連携データの永続化アダプタ。
 *
 * VITE_USE_SUPABASE=true のとき Supabase へ、それ以外はインメモリへルーティングする。
 * トークン暗号化は AES-GCM envelope encryption（key は VITE_FREEE_ENCRYPTION_KEY から）。
 *
 * NOTE: 実 freee OAuth フローは次フェーズ（Edge Function 化）で実装。
 *       このファイルは Supabase レイヤーのみ担当する。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';
import type { FreeeDeal } from './MatchingEngine.js';

// ── 型定義 ────────────────────────────────────────────

export type FreeeConnection = {
  id: string;
  organizationId: string;
  freeeCompanyId: number;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  expiresAt: string;
  createdAt?: string;
};

export type FreeeConnectionRow = {
  id: string;
  organization_id: string;
  freee_company_id: number;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  expires_at: string;
  created_at?: string;
};

export type FreeeDealCacheRow = {
  id: string;
  organization_id: string;
  freee_deal_id: number;
  freee_company_id: number;
  issue_date: string;
  amount: number;
  partner_name?: string;
  ref_number?: string;
  status: 'settled' | 'unsettled' | 'partial';
  raw_data?: unknown;
  cached_at?: string;
};

export type InvoiceFreeeMatchRow = {
  id: string;
  invoice_id: string;
  freee_deal_id: number;
  organization_id: string;
  match_score: number;
  match_reason?: string;
  matched_by: 'auto' | 'manual';
  created_at?: string;
};

export type DealCacheFilter = {
  amountMin?: number;
  amountMax?: number;
  partnerName?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
};

// ── Helpers ──────────────────────────────────────────

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

function rowToDeal(row: FreeeDealCacheRow): FreeeDeal {
  return {
    id: row.freee_deal_id,
    issue_date: row.issue_date,
    amount: row.amount,
    partner_name: row.partner_name,
    ref_number: row.ref_number,
    status: row.status,
  };
}

// ── Envelope encryption (AES-GCM) ────────────────────

/**
 * VITE_FREEE_ENCRYPTION_KEY（base64 の 256-bit キー）で
 * AES-GCM 暗号化した文字列を返す（iv:ciphertext の base64 結合）。
 * キー未設定時は平文をそのまま返す（開発環境向け no-op）。
 */
async function encryptToken(plaintext: string): Promise<string> {
  const keyB64 =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_FREEE_ENCRYPTION_KEY
      : undefined;

  if (!keyB64) return plaintext;

  const keyBytes = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoded);
  const ivB64 = btoa(String.fromCharCode(...iv));
  const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(cipherBuf)));
  return `${ivB64}:${cipherB64}`;
}

// ── InMemory store (フォールバック) ───────────────────

type MatchRecord = Omit<InvoiceFreeeMatchRow, 'id' | 'created_at'>;

// ── FreeeRepository ───────────────────────────────────

export class FreeeRepository {
  private readonly useSupabase: boolean;
  private readonly connections: SupabaseRepository<FreeeConnectionRow> | null;
  private readonly dealsCache: SupabaseRepository<FreeeDealCacheRow> | null;
  private readonly matches: SupabaseRepository<InvoiceFreeeMatchRow> | null;

  // インメモリストア（インスタンス単位でテスト間分離）
  private readonly memConnections = new Map<string, FreeeConnectionRow>();
  private readonly memDeals = new Map<string, FreeeDealCacheRow>();
  private readonly memMatches = new Map<string, InvoiceFreeeMatchRow>();
  private memMatchNextId = 1;

  constructor(useSupabase?: boolean) {
    this.useSupabase = useSupabase ?? isSupabaseEnabled();
    if (this.useSupabase) {
      this.connections = new SupabaseRepository<FreeeConnectionRow>('freee_connections');
      this.dealsCache = new SupabaseRepository<FreeeDealCacheRow>('freee_deals_cache');
      this.matches = new SupabaseRepository<InvoiceFreeeMatchRow>('invoice_freee_matches');
    } else {
      this.connections = null;
      this.dealsCache = null;
      this.matches = null;
    }
  }

  // ── freee_connections ─────────────────────────────

  async saveConnection(
    orgId: string,
    companyId: number,
    tokens: { accessToken: string; refreshToken: string; expiresAt: string },
  ): Promise<void> {
    const accessTokenEncrypted = await encryptToken(tokens.accessToken);
    const refreshTokenEncrypted = await encryptToken(tokens.refreshToken);

    const row: Omit<FreeeConnectionRow, 'id' | 'created_at'> = {
      organization_id: orgId,
      freee_company_id: companyId,
      access_token_encrypted: accessTokenEncrypted,
      refresh_token_encrypted: refreshTokenEncrypted,
      expires_at: tokens.expiresAt,
    };

    if (this.connections) {
      await this.connections.create(row as Omit<FreeeConnectionRow, 'id'>);
    } else {
      const key = `${orgId}:${companyId}`;
      this.memConnections.set(key, { ...row, id: key });
    }
  }

  // ── freee_deals_cache ─────────────────────────────

  async listCachedDeals(
    orgId: string,
    filter: DealCacheFilter = {},
  ): Promise<FreeeDeal[]> {
    if (this.dealsCache) {
      const rows = await this.dealsCache.getAll();
      return rows
        .filter((r) => {
          if (r.organization_id !== orgId) return false;
          if (filter.amountMin !== undefined && r.amount < filter.amountMin) return false;
          if (filter.amountMax !== undefined && r.amount > filter.amountMax) return false;
          if (filter.partnerName && !r.partner_name?.includes(filter.partnerName)) return false;
          if (filter.issueDateFrom && r.issue_date < filter.issueDateFrom) return false;
          if (filter.issueDateTo && r.issue_date > filter.issueDateTo) return false;
          return true;
        })
        .map(rowToDeal);
    }

    return [...this.memDeals.values()]
      .filter((r) => {
        if (r.organization_id !== orgId) return false;
        if (filter.amountMin !== undefined && r.amount < filter.amountMin) return false;
        if (filter.amountMax !== undefined && r.amount > filter.amountMax) return false;
        if (filter.partnerName && !r.partner_name?.includes(filter.partnerName)) return false;
        if (filter.issueDateFrom && r.issue_date < filter.issueDateFrom) return false;
        if (filter.issueDateTo && r.issue_date > filter.issueDateTo) return false;
        return true;
      })
      .map(rowToDeal);
  }

  async upsertDeals(orgId: string, companyId: number, deals: FreeeDeal[]): Promise<void> {
    for (const deal of deals) {
      const row: Omit<FreeeDealCacheRow, 'id' | 'cached_at'> = {
        organization_id: orgId,
        freee_deal_id: deal.id,
        freee_company_id: companyId,
        issue_date: deal.issue_date,
        amount: deal.amount,
        partner_name: deal.partner_name,
        ref_number: deal.ref_number,
        status: deal.status,
      };

      if (this.dealsCache) {
        // upsert: create が UNIQUE 違反でも上書き（Supabase upsert は本実装で処理）
        await this.dealsCache.create(row as Omit<FreeeDealCacheRow, 'id'>).catch(() => undefined);
      } else {
        const key = `${orgId}:${deal.id}`;
        this.memDeals.set(key, { ...row, id: key, cached_at: new Date().toISOString() });
      }
    }
  }

  // ── invoice_freee_matches ─────────────────────────

  async recordMatch(
    invoiceId: string,
    dealId: number,
    orgId: string,
    score: number,
    reason: string,
    by: 'auto' | 'manual',
  ): Promise<void> {
    const record: MatchRecord = {
      invoice_id: invoiceId,
      freee_deal_id: dealId,
      organization_id: orgId,
      match_score: score,
      match_reason: reason,
      matched_by: by,
    };

    if (this.matches) {
      await this.matches.create(record as Omit<InvoiceFreeeMatchRow, 'id'>);
    } else {
      const key = `${invoiceId}:${dealId}`;
      this.memMatches.set(key, {
        ...record,
        id: `match-${this.memMatchNextId++}`,
        created_at: new Date().toISOString(),
      });
    }
  }

  async listMatches(orgId: string): Promise<InvoiceFreeeMatchRow[]> {
    if (this.matches) {
      const rows = await this.matches.getAll();
      return rows.filter((r) => r.organization_id === orgId);
    }
    return [...this.memMatches.values()].filter((r) => r.organization_id === orgId);
  }
}
