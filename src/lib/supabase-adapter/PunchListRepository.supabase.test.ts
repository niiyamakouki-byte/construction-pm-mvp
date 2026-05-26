import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { PunchListRepository } from './PunchListRepository.js';
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

describe('PunchListRepository — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSupabase=true の getItemAsync が punch_list_items テーブルを参照する', async () => {
    const row = {
      id: 'p-1',
      project_id: 'proj-1',
      title: 'クロス浮き',
      description: 'リビング',
      location: 'リビング',
      trade: '内装',
      priority: 'high',
      status: 'open',
      created_by: '我妻',
      due_date: null,
      assigned_contractor_id: null,
      assigned_contractor_name: null,
      resolved_at: null,
      resolved_by: null,
      resolution_notes: null,
      verified_at: null,
      verified_by: null,
      created_at: '2026-05-13T00:00:00.000Z',
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new PunchListRepository(true);
    const result = await repo.getItemAsync('p-1');
    expect(mockFrom).toHaveBeenCalledWith('punch_list_items');
    expect(result?.priority).toBe('high');
    expect(result?.dueDate).toBeUndefined();
  });

  it('useSupabase=true の listHistoryByItemAsync が punch_list_history を参照し item_id でフィルタ', async () => {
    const rows = [
      {
        id: 'h-1',
        item_id: 'p-1',
        action: 'created',
        status: 'open',
        actor: '我妻',
        notes: null,
        created_at: '2026-05-13T00:00:00.000Z',
      },
      {
        id: 'h-2',
        item_id: 'p-2',
        action: 'resolved',
        status: 'resolved',
        actor: '鈴木',
        notes: '再施工',
        created_at: '2026-05-14T00:00:00.000Z',
      },
    ];
    mockFrom.mockReturnValue(makeBuilder({ data: rows, error: null }));

    const repo = new PunchListRepository(true);
    const result = await repo.listHistoryByItemAsync('p-1');
    expect(mockFrom).toHaveBeenCalledWith('punch_list_history');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('h-1');
  });

  it('useSupabase=false で Supabase を呼ばない', async () => {
    const repo = new PunchListRepository(false);
    await repo.saveItemAsync({
      id: 'p-1',
      projectId: 'proj-1',
      title: 't',
      description: '',
      location: '',
      trade: '',
      priority: 'low',
      status: 'open',
      createdBy: 'x',
      createdAt: '2026-05-13T00:00:00.000Z',
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
