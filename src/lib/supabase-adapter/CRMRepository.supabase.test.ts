/**
 * CRMRepository — Phase B (Supabase mode) ルーティングテスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { CRMRepository, type CustomerRecord, type DealRecord } from './CRMRepository.js';
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

function makeCustomer(): CustomerRecord {
  return {
    id: 'cust-1',
    name: '田中太郎',
    company: '田中建設',
    phone: '03-0000-0000',
    email: 'tanaka@example.com',
    address: '東京都港区南青山',
    note: 'VIP顧客',
    createdAt: '2025-04-17T00:00:00.000Z',
  };
}

function makeDeal(): DealRecord {
  return {
    id: 'deal-1',
    customerId: 'cust-1',
    projectName: '南青山内装工事',
    stage: '商談中',
    estimatedAmount: 5000000,
    actualAmount: null,
    probability: 70,
    expectedCloseDate: '2025-06-01',
    note: '',
    createdAt: '2025-04-17T00:00:00.000Z',
    updatedAt: '2025-04-17T00:00:00.000Z',
  };
}

describe('CRMRepository Phase B — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSupabase=true で getCustomerAsync は customers テーブルを参照する', async () => {
    const row = {
      id: 'cust-1',
      name: '田中太郎',
      company: '田中建設',
      phone: '03-0000-0000',
      email: 'tanaka@example.com',
      address: '東京都港区南青山',
      note: 'VIP顧客',
      created_at: '2025-04-17T00:00:00.000Z',
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new CRMRepository(true);
    const result = await repo.getCustomerAsync('cust-1');
    expect(mockFrom).toHaveBeenCalledWith('customers');
    expect(result?.name).toBe('田中太郎');
    expect(result?.company).toBe('田中建設');
  });

  it('useSupabase=true で listCustomersAsync は Supabase から取得する', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [], error: null }));
    const repo = new CRMRepository(true);
    const result = await repo.listCustomersAsync();
    expect(mockFrom).toHaveBeenCalledWith('customers');
    expect(result).toEqual([]);
  });

  it('useSupabase=true でも deals は InMemory フォールバック（警告あり）', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const repo = new CRMRepository(true);
    const deal = makeDeal();
    await repo.saveDealAsync(deal);
    const found = await repo.getDealAsync('deal-1');
    expect(found?.projectName).toBe('南青山内装工事');
    expect(mockFrom).not.toHaveBeenCalledWith('deals');
    consoleSpy.mockRestore();
  });

  it('useSupabase=false で async はインメモリ', async () => {
    const repo = new CRMRepository(false);
    await repo.saveCustomerAsync(makeCustomer());
    const found = await repo.getCustomerAsync('cust-1');
    expect(found?.name).toBe('田中太郎');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('useSupabase=false で deleteCustomerAsync は同期 delete と同じ挙動', async () => {
    const repo = new CRMRepository(false);
    repo.saveCustomer(makeCustomer());
    expect(await repo.deleteCustomerAsync('cust-1')).toBe(true);
    expect(await repo.deleteCustomerAsync('ghost')).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
