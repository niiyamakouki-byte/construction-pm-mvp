import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { SelectionRepository } from './SelectionRepository.js';
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

describe('SelectionRepository — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSupabase=true の getAsync が selection_items を参照し camelCase に変換', async () => {
    const now = '2026-05-28T10:00:00.000Z';
    const row = {
      id: 'sel-1',
      project_id: 'p-1',
      category: '床材',
      item_name: 'リビング床材',
      options: [{ id: 'opt-1', name: 'オーク', description: '15mm', unitPrice: 12000 }],
      selected_option: null,
      status: 'pending',
      notes: 'メモ',
      created_at: now,
      updated_at: now,
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new SelectionRepository(true);
    const result = await repo.getAsync('sel-1');
    expect(mockFrom).toHaveBeenCalledWith('selection_items');
    expect(result?.name).toBe('リビング床材');
    expect(result?.projectId).toBe('p-1');
    expect(result?.status).toBe('選定中');
    expect(result?.clientNote).toBe('メモ');
    expect(result?.selectedOptionId).toBeNull();
  });

  it('DB status が正しく日本語にマッピングされる', async () => {
    const now = '2026-05-28T10:00:00.000Z';
    const cases = [
      { dbStatus: 'pending', expected: '選定中' },
      { dbStatus: 'decided', expected: '施主確認待ち' },
      { dbStatus: 'installed', expected: '承認済' },
      { dbStatus: 'ordered', expected: '変更依頼' },
    ] as const;

    for (const { dbStatus, expected } of cases) {
      vi.clearAllMocks();
      const row = {
        id: 'sel-1',
        project_id: 'p-1',
        category: '床材',
        item_name: 'テスト',
        options: null,
        selected_option: null,
        status: dbStatus,
        notes: null,
        created_at: now,
        updated_at: now,
      };
      mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));
      const repo = new SelectionRepository(true);
      const result = await repo.getAsync('sel-1');
      expect(result?.status).toBe(expected);
    }
  });

  it('options が null のとき空配列に変換される', async () => {
    const now = '2026-05-28T10:00:00.000Z';
    const row = {
      id: 'sel-1',
      project_id: 'p-1',
      category: '床材',
      item_name: 'テスト',
      options: null,
      selected_option: null,
      status: 'pending',
      notes: null,
      created_at: now,
      updated_at: now,
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new SelectionRepository(true);
    const result = await repo.getAsync('sel-1');
    expect(result?.options).toEqual([]);
  });

  it('useSupabase=true の listByProjectAsync が selection_items を参照する', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [], error: null }));
    const repo = new SelectionRepository(true);
    const result = await repo.listByProjectAsync('p-1');
    expect(mockFrom).toHaveBeenCalledWith('selection_items');
    expect(result).toEqual([]);
  });

  it('useSupabase=false で Supabase を呼ばない', async () => {
    const now = '2026-05-28T10:00:00.000Z';
    const repo = new SelectionRepository(false);
    await repo.saveAsync({
      id: 'sel-1',
      projectId: 'p-1',
      category: '床材',
      name: 'テスト',
      options: [],
      selectedOptionId: null,
      status: '選定中',
      clientNote: '',
      createdAt: now,
      updatedAt: now,
    });
    await repo.listByProjectAsync('p-1');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
