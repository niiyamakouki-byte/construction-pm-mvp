/**
 * ProjectRepository — Phase B (Supabase mode) ルーティングテスト
 * useSupabase=true のとき async メソッドが SupabaseRepository を呼ぶことを確認。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { ProjectRepository } from './ProjectRepository.js';
import type { StoreProject } from '../store.js';
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

function makeProject(id = 'p-1'): StoreProject {
  const now = '2025-04-17T00:00:00.000Z';
  return {
    id,
    name: '南青山内装工事',
    description: 'テスト',
    status: 'planning',
    startDate: '2025-04-01',
    includeWeekends: true,
    createdAt: now,
    updatedAt: now,
  };
}

describe('ProjectRepository Phase B — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSupabase=true のとき getAsync は Supabase から取得する', async () => {
    const row = {
      id: 'p-1',
      name: '南青山内装工事',
      description: 'テスト',
      status: 'planning',
      start_date: '2025-04-01',
      end_date: null,
      address: null,
      budget: null,
      created_at: '2025-04-17T00:00:00.000Z',
      updated_at: '2025-04-17T00:00:00.000Z',
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new ProjectRepository(true);
    const result = await repo.getAsync('p-1');
    expect(mockFrom).toHaveBeenCalledWith('projects');
    expect(result?.id).toBe('p-1');
    expect(result?.startDate).toBe('2025-04-01');
    expect(result?.includeWeekends).toBe(true);
  });

  it('useSupabase=true のとき listAsync は Supabase から取得する', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [], error: null }));
    const repo = new ProjectRepository(true);
    const result = await repo.listAsync();
    expect(mockFrom).toHaveBeenCalledWith('projects');
    expect(result).toEqual([]);
  });

  it('useSupabase=false のとき async メソッドはインメモリを使う', async () => {
    const repo = new ProjectRepository(false);
    const p = makeProject();
    await repo.saveAsync(p);
    const found = await repo.getAsync('p-1');
    expect(found?.name).toBe('南青山内装工事');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('useSupabase=false で deleteAsync は同期 delete と同じ挙動', async () => {
    const repo = new ProjectRepository(false);
    repo.save(makeProject());
    expect(await repo.deleteAsync('p-1')).toBe(true);
    expect(await repo.deleteAsync('ghost')).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
