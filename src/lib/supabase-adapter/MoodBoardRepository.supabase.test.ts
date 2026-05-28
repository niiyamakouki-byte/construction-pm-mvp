import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { MoodBoardRepository } from './MoodBoardRepository.js';
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

describe('MoodBoardRepository — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSupabase=true の getAsync が mood_boards を参照し camelCase に変換', async () => {
    const now = '2026-05-28T10:00:00.000Z';
    const row = {
      id: 'mb-1',
      project_id: 'p-1',
      title: 'リビング提案',
      items: [],
      created_at: now,
      updated_at: now,
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new MoodBoardRepository(true);
    const result = await repo.getAsync('mb-1');
    expect(mockFrom).toHaveBeenCalledWith('mood_boards');
    expect(result?.title).toBe('リビング提案');
    expect(result?.projectId).toBe('p-1');
    expect(result?.items).toEqual([]);
  });

  it('items が null のとき空配列に変換される', async () => {
    const now = '2026-05-28T10:00:00.000Z';
    const row = {
      id: 'mb-2',
      project_id: 'p-1',
      title: 'テスト',
      items: null,
      created_at: now,
      updated_at: now,
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new MoodBoardRepository(true);
    const result = await repo.getAsync('mb-2');
    expect(result?.items).toEqual([]);
  });

  it('useSupabase=true の listByProjectAsync が mood_boards を参照する', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [], error: null }));
    const repo = new MoodBoardRepository(true);
    const result = await repo.listByProjectAsync('p-1');
    expect(mockFrom).toHaveBeenCalledWith('mood_boards');
    expect(result).toEqual([]);
  });

  it('useSupabase=false で Supabase を呼ばない', async () => {
    const now = '2026-05-28T10:00:00.000Z';
    const repo = new MoodBoardRepository(false);
    await repo.saveAsync({
      id: 'mb-1',
      projectId: 'p-1',
      title: 'テスト',
      items: [],
      createdAt: now,
      updatedAt: now,
    });
    await repo.listByProjectAsync('p-1');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
