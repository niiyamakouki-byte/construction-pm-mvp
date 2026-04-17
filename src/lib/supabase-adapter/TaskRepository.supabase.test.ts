/**
 * TaskRepository — Phase B (Supabase mode) ルーティングテスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { TaskRepository, type Task } from './TaskRepository.js';
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

function makeTask(id = 't-1'): Task {
  const now = '2025-04-17T00:00:00.000Z';
  return {
    id,
    projectId: 'p-1',
    name: '基礎工事',
    description: 'コンクリ打設',
    status: 'todo',
    progress: 0,
    isMilestone: false,
    createdAt: now,
    updatedAt: now,
  };
}

describe('TaskRepository Phase B — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSupabase=true で getAsync は tasks テーブルを参照', async () => {
    const row = {
      id: 't-1',
      project_id: 'p-1',
      name: '基礎工事',
      description: 'コンクリ打設',
      status: 'todo',
      progress: 0,
      start_date: null,
      due_date: null,
      assignee_id: null,
      created_at: '2025-04-17T00:00:00.000Z',
      updated_at: '2025-04-17T00:00:00.000Z',
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new TaskRepository(true);
    const result = await repo.getAsync('t-1');
    expect(mockFrom).toHaveBeenCalledWith('tasks');
    expect(result?.projectId).toBe('p-1');
    expect(result?.status).toBe('todo');
  });

  it('useSupabase=true で listByProjectAsync が project_id でフィルタする', async () => {
    const rows = [
      {
        id: 't-1', project_id: 'p-1', name: 'A', description: '', status: 'todo',
        progress: 0, start_date: null, due_date: null, assignee_id: null,
        created_at: '', updated_at: '',
      },
      {
        id: 't-2', project_id: 'p-2', name: 'B', description: '', status: 'todo',
        progress: 0, start_date: null, due_date: null, assignee_id: null,
        created_at: '', updated_at: '',
      },
    ];
    mockFrom.mockReturnValue(makeBuilder({ data: rows, error: null }));

    const repo = new TaskRepository(true);
    const result = await repo.listByProjectAsync('p-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t-1');
  });

  it('useSupabase=false で async はインメモリ', async () => {
    const repo = new TaskRepository(false);
    await repo.saveAsync(makeTask());
    const found = await repo.getAsync('t-1');
    expect(found?.name).toBe('基礎工事');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
