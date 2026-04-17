/**
 * CRMRepository — Phase B
 * 同期メソッドはインメモリ（既存互換）。
 * async メソッドは VITE_USE_SUPABASE=true のとき Supabase へ、
 * それ以外はインメモリへルーティングする。
 *
 * NOTE: deals テーブルの stage カラムが日本語値（引合/現調/...）と
 * 一致する保証がないため、deals は警告+InMemory フォールバック（Phase C 待ち）。
 * customers テーブルは標準的なスキーマのため Supabase ルーティング対応。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';

export type CustomerRecord = {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  address: string;
  note: string;
  createdAt: string;
};

export type DealStage = '引合' | '現調' | '見積提出' | '商談中' | '受注' | '失注';

export type DealRecord = {
  id: string;
  customerId: string;
  projectName: string;
  stage: DealStage;
  estimatedAmount: number;
  actualAmount: number | null;
  probability: number;
  expectedCloseDate: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

// DB 行 (snake_case) ↔ アプリ型 (camelCase) のマッピング
type CustomerRow = {
  id: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  note?: string | null;
  created_at: string;
};

function rowToCustomer(row: CustomerRow): CustomerRecord {
  return {
    id: row.id,
    name: row.name,
    company: row.company ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    address: row.address ?? '',
    note: row.note ?? '',
    createdAt: row.created_at,
  };
}

function customerToRow(c: CustomerRecord): CustomerRow {
  return {
    id: c.id,
    name: c.name,
    company: c.company || null,
    phone: c.phone || null,
    email: c.email || null,
    address: c.address || null,
    note: c.note || null,
    created_at: c.createdAt,
  };
}

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

let warnedDealsSchemaMismatch = false;

export class CRMRepository {
  private customers = new Map<string, CustomerRecord>();
  private deals = new Map<string, DealRecord>();
  private supabaseCustomers: SupabaseRepository<CustomerRow> | null;

  /**
   * @param useSupabase 明示指定がなければ env を見る。テスト用に上書き可。
   * deals は DB スキーマ不一致のため useSupabase=true でも InMemory フォールバック。
   */
  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    this.supabaseCustomers = enabled ? new SupabaseRepository<CustomerRow>('customers') : null;
    if (enabled && !warnedDealsSchemaMismatch) {
      warnedDealsSchemaMismatch = true;
      console.warn(
        '[CRMRepository] deals テーブルのスキーマが Phase C 待ちのため deals は InMemory にフォールバックします',
      );
    }
  }

  // ── 同期メソッド（既存互換 / インメモリのみ）─────────────────────────────

  getCustomer(id: string): CustomerRecord | null {
    return this.customers.get(id) ?? null;
  }

  listCustomers(): CustomerRecord[] {
    return [...this.customers.values()];
  }

  saveCustomer(customer: CustomerRecord): void {
    this.customers.set(customer.id, { ...customer });
  }

  deleteCustomer(id: string): boolean {
    return this.customers.delete(id);
  }

  getDeal(id: string): DealRecord | null {
    return this.deals.get(id) ?? null;
  }

  listDeals(): DealRecord[] {
    return [...this.deals.values()];
  }

  saveDeal(deal: DealRecord): void {
    this.deals.set(deal.id, { ...deal });
  }

  deleteDeal(id: string): boolean {
    return this.deals.delete(id);
  }

  // ── async メソッド（Phase B: Supabase or InMemory）────────────────────

  async getCustomerAsync(id: string): Promise<CustomerRecord | null> {
    if (this.supabaseCustomers) {
      const row = await this.supabaseCustomers.getById(id);
      return row ? rowToCustomer(row) : null;
    }
    return this.getCustomer(id);
  }

  async listCustomersAsync(): Promise<CustomerRecord[]> {
    if (this.supabaseCustomers) {
      const rows = await this.supabaseCustomers.getAll();
      return rows.map(rowToCustomer);
    }
    return this.listCustomers();
  }

  async saveCustomerAsync(customer: CustomerRecord): Promise<void> {
    if (this.supabaseCustomers) {
      const row = customerToRow(customer);
      const existing = await this.supabaseCustomers.getById(customer.id);
      if (existing) {
        await this.supabaseCustomers.update(customer.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabaseCustomers.create({ ...rest, id: customer.id } as unknown as Omit<CustomerRow, 'id'>);
      }
      return;
    }
    this.saveCustomer(customer);
  }

  async deleteCustomerAsync(id: string): Promise<boolean> {
    if (this.supabaseCustomers) {
      try {
        await this.supabaseCustomers.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.deleteCustomer(id);
  }

  // deals は Phase C 待ち → 常に InMemory

  async getDealAsync(id: string): Promise<DealRecord | null> {
    return this.getDeal(id);
  }

  async listDealsAsync(): Promise<DealRecord[]> {
    return this.listDeals();
  }

  async saveDealAsync(deal: DealRecord): Promise<void> {
    this.saveDeal(deal);
  }

  async deleteDealAsync(id: string): Promise<boolean> {
    return this.deleteDeal(id);
  }
}
