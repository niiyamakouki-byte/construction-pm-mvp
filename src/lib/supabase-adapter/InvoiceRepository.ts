/**
 * InvoiceRepository — Phase C
 * async メソッドのみ（sync メソッド削除済み）。
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

// DB実スキーマ: id, project_id, organization_id, invoice_number, customer_id, status, issue_date, due_date, subtotal, tax_amount, total_amount, notes, created_at, updated_at
type InvoiceRow = {
  id: string;
  project_id: string;
  invoice_number: string;
  customer_id: string | null;
  status: string;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
};

function rowToInvoice(row: InvoiceRow): InvoiceRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    vendorName: row.notes ?? '',
    amount: row.subtotal,
    tax: row.tax_amount,
    total: row.total_amount,
    items: [],
    invoiceDate: row.issue_date,
    dueDate: row.due_date ?? undefined,
    status: (row.status as InvoiceStatus) ?? '未確認',
  };
}

let _invoiceCounter = 1;
function nextInvoiceNumber(): string {
  return `INV-${Date.now()}-${_invoiceCounter++}`;
}

function invoiceToRow(inv: InvoiceRecord): InvoiceRow {
  return {
    id: inv.id,
    project_id: inv.projectId,
    invoice_number: nextInvoiceNumber(),
    customer_id: null,
    status: inv.status,
    issue_date: inv.invoiceDate,
    due_date: inv.dueDate ?? null,
    subtotal: inv.amount,
    tax_amount: inv.tax,
    total_amount: inv.total,
    notes: inv.vendorName || null,
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

  // ── async メソッド（Phase C: Supabase or InMemory）────────────────────

  async getAsync(id: string): Promise<InvoiceRecord | null> {
    if (this.supabase) {
      const row = await this.supabase.getById(id);
      return row ? rowToInvoice(row) : null;
    }
    return this.store.get(id) ?? null;
  }

  async listAsync(): Promise<InvoiceRecord[]> {
    if (this.supabase) {
      const rows = await this.supabase.getAll();
      return rows.map(rowToInvoice);
    }
    return [...this.store.values()];
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
    const invoice: InvoiceRecord = { ...data, id: `inv-${this.nextId++}` };
    this.store.set(invoice.id, invoice);
    return invoice;
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
    this.store.set(invoice.id, { ...invoice });
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
    return this.store.delete(id);
  }
}
