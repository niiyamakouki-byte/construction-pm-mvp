/**
 * freee API wrapper — 認証済みユーザー向け、期限切れトークンの自動 refresh 付き。
 *
 * 既存の `src/lib/freee/client.ts` は固定トークン用。
 * 本ファイルは Supabase に保管した OAuth トークンを使い、
 * 期限が切れていれば自動で refresh して呼び直す。
 *
 * Phase 1 の最小 3 エンドポイント:
 *   - GET /api/1/companies  (事業所一覧)
 *   - GET /api/1/invoices   (請求書一覧)
 *   - GET /api/1/deals      (取引一覧 = 収入/支出)
 *
 * 参考: https://app.secure.freee.co.jp/developers/api
 */

import type { Company, Deal, Invoice } from "./freee/types.js";
import {
  refreshAccessToken,
  computeExpiresAt,
  type FreeeTokenResponse,
} from "./freee-client.js";

export const FREEE_API_BASE = "https://api.freee.co.jp";

// ── トークン ────────────────────────────────────────────

export type StoredFreeeToken = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;   // ISO 8601
};

/** expires_at から 60 秒以内に切れる場合は refresh 対象とみなす。 */
const REFRESH_LEEWAY_MS = 60_000;

export function isExpired(expiresAt: string, now: Date = new Date()): boolean {
  const ts = new Date(expiresAt).getTime();
  // Invalid Date (NaN) → treat as expired so a fresh token is fetched
  if (!Number.isFinite(ts)) return true;
  return ts - now.getTime() <= REFRESH_LEEWAY_MS;
}

// ── TokenStore (Supabase を隠蔽) ────────────────────────

/**
 * Supabase 依存をテストで切り離すための最小インターフェース。
 * 実装は /api/freee/* 側で作る。
 */
export type TokenStore = {
  load(): Promise<StoredFreeeToken | null>;
  save(token: StoredFreeeToken): Promise<void>;
};

// ── FreeeApi ────────────────────────────────────────────

export type FreeeApiOptions = {
  store: TokenStore;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
};

export class FreeeApi {
  private readonly store: TokenStore;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: FreeeApiOptions) {
    this.store = opts.store;
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  // ── 公開 API ──────────────────────────────

  /** GET /api/1/companies — 事業所一覧 */
  async getCompanies(): Promise<Company[]> {
    const data = await this.request<{ companies: Company[] }>(
      "GET",
      "/api/1/companies",
    );
    return data.companies;
  }

  /** GET /api/1/invoices — 請求書一覧 */
  async getInvoices(
    companyId: number,
    params: Record<string, string | number | undefined> = {},
  ): Promise<Invoice[]> {
    const qs = buildQuery({ company_id: companyId, ...params });
    const data = await this.request<{ invoices: Invoice[] }>(
      "GET",
      `/api/1/invoices${qs}`,
    );
    return data.invoices;
  }

  /** GET /api/1/deals — 取引一覧（income / expense） */
  async getDeals(
    companyId: number,
    params: Record<string, string | number | undefined> = {},
  ): Promise<Deal[]> {
    const qs = buildQuery({ company_id: companyId, ...params });
    const data = await this.request<{ deals: Deal[] }>(
      "GET",
      `/api/1/deals${qs}`,
    );
    return data.deals;
  }

  // ── 内部 ───────────────────────────────────

  /**
   * 認証ヘッダつきで freee API を叩く。
   * 期限切れなら refresh、401 が返ったら 1 度だけ強制 refresh してリトライ。
   */
  private async request<T>(method: string, path: string): Promise<T> {
    let token = await this.loadFreshToken();

    let response = await this.fetchImpl(`${FREEE_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": "application/json",
        "X-Api-Version": "2020-06-15",
      },
    });

    // サーバー側で先に期限切れたケースに備えて 1 回だけ強制 refresh
    if (response.status === 401) {
      token = await this.forceRefresh(token);
      response = await this.fetchImpl(`${FREEE_API_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          "Content-Type": "application/json",
          "X-Api-Version": "2020-06-15",
        },
      });
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get?.("Retry-After");
      const waitSec = retryAfter ? Number(retryAfter) : 60;
      const wait = Number.isFinite(waitSec) && waitSec > 0 ? waitSec : 60;
      throw new Error(`freee API rate limited (429). Retry-After: ${wait}s`);
    }

    if (!response.ok) {
      throw new Error(`freee API error ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  /** store からロードし、期限が近ければ refresh して返す。 */
  private async loadFreshToken(): Promise<StoredFreeeToken> {
    const current = await this.store.load();
    if (!current) {
      throw new Error("freee未連携: アクセストークンが保存されていません");
    }
    if (!isExpired(current.expiresAt)) {
      return current;
    }
    return this.forceRefresh(current);
  }

  /** refresh_token を使って新しいトークンを取得し、store に保存する。 */
  private async forceRefresh(
    current: StoredFreeeToken,
  ): Promise<StoredFreeeToken> {
    const fresh: FreeeTokenResponse = await refreshAccessToken(
      { clientId: this.clientId, clientSecret: this.clientSecret },
      current.refreshToken,
      this.fetchImpl,
    );
    const next: StoredFreeeToken = {
      accessToken: fresh.access_token,
      refreshToken: fresh.refresh_token,
      expiresAt: computeExpiresAt(fresh),
    };
    await this.store.save(next);
    return next;
  }
}

// ── helpers ─────────────────────────────────────────────

function buildQuery(
  params: Record<string, string | number | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      sp.set(key, String(value));
    }
  }
  const q = sp.toString();
  return q ? `?${q}` : "";
}
