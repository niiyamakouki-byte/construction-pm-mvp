/**
 * InvoiceRepository — Phase B (Supabase mode) ルーティングテスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { InvoiceRepository, type InvoiceRecord } from './InvoiceRepository.js';
import * as supabaseClient from '../repository/supabase-client.js';

function makeBuilder(terminal: { data: unknown; error: { message: string } | null }) {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  const term = () => Promise.resolve(terminal);
  b.select = vi.fn(chain);
  b.eq = vi.fn(chain);
  b.insert = vi.fn(chain);
  b.update = vi.fn(chain);
  b.delete = vi.fn(chain);
  b.single = vi.fn(term);
  b.maybeSingle = vi.fn(term);
  (b as { then?: unknown }).then = (
    res: (v: unknown) => unknown,
    rej?: (e: unknown) => unknown,
  ) => Promise.resolve(terminal).then(res, rej);
  return b;
}

const mockFrom = (supabaseClient as unknown as { supabase: { from: ReturnType<typeof vi.fn> } })
  .supabase.from;

function makeInvoice(id = 'inv-1'): InvoiceRecord {
  return {
    id,
    projectId: 'p-1',
    vendorName: '山田工務店',
    amount: 100000,
    tax: 10000,
    total: 110000,
    items: [],
    invoiceDate: '2025-04-17',
    status: '未確認',
  };
}

describe('InvoiceRepository Phase B — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSupabase=true で getAsync は invoices テーブルを参照し camelCase マッピングする', async () => {
    const row = {
      id: 'inv-1',
      project_id: 'p-1',
      invoice_number: 'INV-001',
      customer_id: null,
      status: '未確認',
      issue_date: '2025-04-17',
      due_date: null,
      subtotal: 100000,
      tax_amount: 10000,
      total_amount: 110000,
      notes: null,
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new InvoiceRepository(true);
    const result = await repo.getAsync('inv-1');
    expect(mockFrom).toHaveBeenCalledWith('invoices');
    expect(result?.projectId).toBe('p-1');
    expect(result?.amount).toBe(100000);
    expect(result?.invoiceDate).toBe('2025-04-17');
  });

  it('useSupabase=true で listAsync は Supabase から取得する', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [], error: null }));
    const repo = new InvoiceRepository(true);
    const result = await repo.listAsync();
    expect(mockFrom).toHaveBeenCalledWith('invoices');
    expect(result).toEqual([]);
  });

  it('useSupabase=false で async はインメモリ', async () => {
    const repo = new InvoiceRepository(false);
    const inv = makeInvoice('inv-99');
    await repo.saveAsync(inv);
    const found = await repo.getAsync('inv-99');
    expect(found?.vendorName).toBe('山田工務店');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('useSupabase=false で deleteAsync は同期 delete と同じ挙動', async () => {
    const repo = new InvoiceRepository(false);
    await repo.saveAsync(makeInvoice());
    expect(await repo.deleteAsync('inv-1')).toBe(true);
    expect(await repo.deleteAsync('ghost')).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('useSupabase=false で saveAsync → getAsync でラウンドトリップ', async () => {
    const repo = new InvoiceRepository(false);
    const inv = makeInvoice('inv-round');
    await repo.saveAsync(inv);
    const found = await repo.getAsync('inv-round');
    expect(found?.status).toBe('未確認');
    expect(found?.total).toBe(110000);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
