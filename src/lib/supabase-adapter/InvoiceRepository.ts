/**
 * InvoiceRepository — Phase B
 * 同期メソッドはインメモリ（既存互換）。
 * async メソッドは VITE_USE_SUPABASE=true のとき Supabase へ、
 * それ以外はインメモリへルーティングする。
 *
 * NOTE: invoices テーブルは items (JSONB) / vendorContact / bankInfo /
 * registrationNumber / pdfPath が標準スキーマにない可能性があるため
 * デフォルト値でフォールバックする（Phase C で詳細スキーマ追加予定）。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';

export type InvoiceStatus = '未確認' | '確認済' | '振込予定' | '振込済' | '保留';

export type InvoiceItemRecord = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type InvoiceRecord = {
  id: string;
  projectId: string;
  vendorName: string;
  vendorContact?: string;
  amount: number;
  tax: number;
  total: number;
  items: InvoiceItemRecord[];
  bankInfo?: string;
  registrationNumber?: string;
  invoiceDate: string;
  dueDate?: string;
  status: InvoiceStatus;
  paidDate?: string;
  pdfPath?: string;
};

// DB 行 (snake_case) ↔ アプリ型 (camelCase) のマッピング
type InvoiceRow = {
  id: string;
  project_id: string;
  amount: number;
  issued_date: string;
  paid_date?: string | null;
  status: string;
};

function rowToInvoice(row: InvoiceRow): InvoiceRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    vendorName: '',
    amount: row.amount,
    tax: 0,
    total: row.amount,
    items: [],
    invoiceDate: row.issued_date,
    dueDate: undefined,
    status: (row.status as InvoiceStatus) ?? '未確認',
    paidDate: row.paid_date ?? undefined,
  };
}

function invoiceToRow(inv: InvoiceRecord): InvoiceRow {
  return {
    id: inv.id,
    project_id: inv.projectId,
    amount: inv.amount,
    issued_date: inv.invoiceDate,
    paid_date: inv.paidDate ?? null,
    status: inv.status,
  };
}

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

export class InvoiceRepository {
  private store = new Map<string, InvoiceRecord>();
  private nextId = 1;
  private supabase: SupabaseRepository<InvoiceRow> | null;

  /**
   * @param useSupabase 明示指定がなければ env を見る。テスト用に上書き可。
   */
  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    this.supabase = enabled ? new SupabaseRepository<InvoiceRow>('invoices') : null;
  }

  // ── 同期メソッド（既存互換 / インメモリのみ）─────────────────────────────

  /** @deprecated Use getAsync instead. Will be removed in Phase C cleanup. */
  get(id: string): InvoiceRecord | null {
    return this.store.get(id) ?? null;
  }

  /** @deprecated Use listAsync instead. Will be removed in Phase C cleanup. */
  list(): InvoiceRecord[] {
    return [...this.store.values()];
  }

  /** @deprecated Use addAsync instead. Will be removed in Phase C cleanup. */
  add(data: Omit<InvoiceRecord, 'id'>): InvoiceRecord {
    const invoice: InvoiceRecord = { ...data, id: `inv-${this.nextId++}` };
    this.store.set(invoice.id, invoice);
    return invoice;
  }

  /** @deprecated Use saveAsync instead. Will be removed in Phase C cleanup. */
  save(invoice: InvoiceRecord): void {
    this.store.set(invoice.id, { ...invoice });
  }

  /** @deprecated Use deleteAsync instead. Will be removed in Phase C cleanup. */
  delete(id: string): boolean {
    return this.store.delete(id);
  }

  // ── async メソッド（Phase B: Supabase or InMemory）────────────────────

  async getAsync(id: string): Promise<InvoiceRecord | null> {
    if (this.supabase) {
      const row = await this.supabase.getById(id);
      return row ? rowToInvoice(row) : null;
    }
    return this.get(id);
  }

  async listAsync(): Promise<InvoiceRecord[]> {
    if (this.supabase) {
      const rows = await this.supabase.getAll();
      return rows.map(rowToInvoice);
    }
    return this.list();
  }

  async addAsync(data: Omit<InvoiceRecord, 'id'>): Promise<InvoiceRecord> {
    if (this.supabase) {
      const tempId = `inv-${this.nextId++}`;
      const invoice: InvoiceRecord = { ...data, id: tempId };
      const row = invoiceToRow(invoice);
      const { id: _id, ...rest } = row;
      void _id;
      const created = await this.supabase.create({ ...rest, id: tempId } as unknown as Omit<InvoiceRow, 'id'>);
      return rowToInvoice(created);
    }
    return this.add(data);
  }

  async saveAsync(invoice: InvoiceRecord): Promise<void> {
    if (this.supabase) {
      const row = invoiceToRow(invoice);
      const existing = await this.supabase.getById(invoice.id);
      if (existing) {
        await this.supabase.update(invoice.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabase.create({ ...rest, id: invoice.id } as unknown as Omit<InvoiceRow, 'id'>);
      }
      return;
    }
    this.save(invoice);
  }

  async deleteAsync(id: string): Promise<boolean> {
    if (this.supabase) {
      try {
        await this.supabase.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.delete(id);
  }
}
