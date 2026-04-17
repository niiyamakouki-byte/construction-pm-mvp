/**
 * ContractorRepository — Phase B (Supabase mode) ルーティングテスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { ContractorRepository, type ContractorRecord } from './ContractorRepository.js';
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

function makeContractor(): ContractorRecord {
  return {
    id: 'c-1',
    name: '山田工務店',
    trade: '内装',
    phone: '03-0000-0000',
    email: 'yamada@example.com',
    createdAt: '2025-04-17T00:00:00.000Z',
    updatedAt: '2025-04-17T00:00:00.000Z',
  };
}

describe('ContractorRepository Phase B — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getAsync は contractors テーブルを参照し specialty→trade マッピングする', async () => {
    const row = {
      id: 'c-1',
      name: '山田工務店',
      specialty: '内装',
      contact_person: '山田',
      phone: '03-0000-0000',
      email: 'y@e.com',
      line_id: null,
      created_at: '2025-04-17T00:00:00.000Z',
      updated_at: '2025-04-17T00:00:00.000Z',
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new ContractorRepository(true);
    const result = await repo.getAsync('c-1');
    expect(mockFrom).toHaveBeenCalledWith('contractors');
    expect(result?.trade).toBe('内装');
    expect(result?.contactPerson).toBe('山田');
  });

  it('useSupabase=false で従来通りインメモリ', async () => {
    const repo = new ContractorRepository(false);
    await repo.saveAsync(makeContractor());
    const found = await repo.getAsync('c-1');
    expect(found?.name).toBe('山田工務店');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
