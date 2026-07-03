import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { SafetyRepository } from './SafetyRepository.js';
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

describe('SafetyRepository — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSupabase=true の getKyAsync が ky_activities テーブルを参照する', async () => {
    const row = {
      id: 'ky-1',
      project_id: null,
      organization_id: null,
      activity_date: '2026-05-13',
      participants: ['山田'],
      hazards: ['転落'],
      countermeasures: ['手すり'],
      created_at: '2026-05-13T00:00:00.000Z',
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new SafetyRepository(true);
    const result = await repo.getKyAsync('ky-1');
    expect(mockFrom).toHaveBeenCalledWith('ky_activities');
    expect(result?.participants).toEqual(['山田']);
  });

  it('useSupabase=true の getNearMissAsync が near_miss_reports テーブルを参照する', async () => {
    const row = {
      id: 'nm-1',
      project_id: null,
      organization_id: null,
      occurred_at: '2026-05-13T10:30:00.000Z',
      location: '3階',
      description: '工具落下',
      severity: 'medium',
      cause: '養生不足',
      countermeasure: '養生強化',
      created_at: '2026-05-13T10:30:00.000Z',
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new SafetyRepository(true);
    const result = await repo.getNearMissAsync('nm-1');
    expect(mockFrom).toHaveBeenCalledWith('near_miss_reports');
    expect(result?.severity).toBe('medium');
    expect(result?.causeAnalysis).toBe('養生不足');
  });

  it('useSupabase=false で Supabase を呼ばない', async () => {
    const repo = new SafetyRepository(false);
    await repo.saveKyAsync({
      id: 'ky-1',
      date: '2026-05-13',
      participants: [],
      hazards: [],
      countermeasures: [],
      createdAt: '2026-05-13T00:00:00.000Z',
    });
    await repo.saveNearMissAsync({
      id: 'nm-1',
      datetime: '2026-05-13T10:30:00.000Z',
      location: '',
      description: '',
      severity: 'low',
      causeAnalysis: '',
      countermeasure: '',
      createdAt: '2026-05-13T10:30:00.000Z',
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
