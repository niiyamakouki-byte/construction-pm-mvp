import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { OrderRepository } from './OrderRepository.js';
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

const mockFrom = (
  supabaseClient as unknown as { supabase: { from: ReturnType<typeof vi.fn> } }
).supabase.from;

describe('OrderRepository — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSupabase=true の getAsync が purchase_orders を参照し camelCase に変換', async () => {
    const now = '2026-05-28T10:00:00.000Z';
    const row = {
      id: 'po-1',
      project_id: 'p-1',
      supplier_name: '山田内装工業',
      contractor_id: 'c-1',
      contractor_name: '山田内装工業',
      status: '下書き',
      order_date: '2025-07-01',
      delivery_date: '2025-07-15',
      items: [{ code: 'A-01', name: 'LGS 65mm', unit: '本', quantity: 100, unitPrice: 500, amount: 50000 }],
      total_amount: 50000,
      tax_amount: 5000,
      total_with_tax: 55000,
      notes: null,
      created_at: now,
      updated_at: now,
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new OrderRepository(true);
    const result = await repo.getAsync('po-1');
    expect(mockFrom).toHaveBeenCalledWith('purchase_orders');
    expect(result?.contractorName).toBe('山田内装工業');
    expect(result?.projectId).toBe('p-1');
    expect(result?.status).toBe('下書き');
    expect(result?.totalAmount).toBe(50000);
    expect(result?.taxAmount).toBe(5000);
    expect(result?.totalWithTax).toBe(55000);
    expect(result?.items).toHaveLength(1);
  });

  it('items が null のとき空配列に変換される', async () => {
    const now = '2026-05-28T10:00:00.000Z';
    const row = {
      id: 'po-2',
      project_id: 'p-1',
      supplier_name: 'テスト',
      contractor_id: null,
      contractor_name: null,
      status: '下書き',
      order_date: null,
      delivery_date: null,
      items: null,
      total_amount: 0,
      tax_amount: 0,
      total_with_tax: 0,
      notes: null,
      created_at: now,
      updated_at: now,
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new OrderRepository(true);
    const result = await repo.getAsync('po-2');
    expect(result?.items).toEqual([]);
  });

  it('total_amount が文字列でも数値に変換される', async () => {
    const now = '2026-05-28T10:00:00.000Z';
    const row = {
      id: 'po-3',
      project_id: 'p-1',
      supplier_name: 'テスト',
      contractor_id: null,
      contractor_name: null,
      status: '発注済',
      order_date: null,
      delivery_date: null,
      items: [],
      total_amount: '123456',
      tax_amount: '12345',
      total_with_tax: '135801',
      notes: null,
      created_at: now,
      updated_at: now,
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new OrderRepository(true);
    const result = await repo.getAsync('po-3');
    expect(result?.totalAmount).toBe(123456);
    expect(result?.taxAmount).toBe(12345);
    expect(result?.totalWithTax).toBe(135801);
  });

  it('useSupabase=true の listByProjectAsync が purchase_orders を参照する', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [], error: null }));
    const repo = new OrderRepository(true);
    const result = await repo.listByProjectAsync('p-1');
    expect(mockFrom).toHaveBeenCalledWith('purchase_orders');
    expect(result).toEqual([]);
  });

  it('useSupabase=false で Supabase を呼ばない', async () => {
    const now = '2026-05-28T10:00:00.000Z';
    const repo = new OrderRepository(false);
    await repo.saveAsync({
      id: 'po-1',
      projectId: 'p-1',
      contractorId: 'c-1',
      contractorName: '山田内装工業',
      items: [],
      status: '下書き',
      orderDate: '2025-07-01',
      deliveryDate: '2025-07-15',
      totalAmount: 0,
      taxAmount: 0,
      totalWithTax: 0,
      createdAt: now,
      updatedAt: now,
    });
    await repo.listByProjectAsync('p-1');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
