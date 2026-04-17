/**
 * InvoiceRepository — Phase A
 * 同期メソッドはインメモリ（既存互換）。
 * async メソッドは現時点でインメモリにルーティング（Phase A）。
 * TODO: Phase B — VITE_USE_SUPABASE=true のとき Supabase へ切替
 */

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

export class InvoiceRepository {
  private store = new Map<string, InvoiceRecord>();
  private nextId = 1;

  // ── 同期メソッド（既存互換 / インメモリのみ）─────────────────────────────

  get(id: string): InvoiceRecord | null {
    return this.store.get(id) ?? null;
  }

  list(): InvoiceRecord[] {
    return [...this.store.values()];
  }

  add(data: Omit<InvoiceRecord, 'id'>): InvoiceRecord {
    const invoice: InvoiceRecord = { ...data, id: `inv-${this.nextId++}` };
    this.store.set(invoice.id, invoice);
    return invoice;
  }

  save(invoice: InvoiceRecord): void {
    this.store.set(invoice.id, { ...invoice });
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  // ── async メソッド（Phase A: インメモリエイリアス）────────────────────

  async getAsync(id: string): Promise<InvoiceRecord | null> {
    return this.get(id);
  }

  async listAsync(): Promise<InvoiceRecord[]> {
    return this.list();
  }

  async addAsync(data: Omit<InvoiceRecord, 'id'>): Promise<InvoiceRecord> {
    return this.add(data);
  }

  async saveAsync(invoice: InvoiceRecord): Promise<void> {
    this.save(invoice);
  }

  async deleteAsync(id: string): Promise<boolean> {
    return this.delete(id);
  }
}
