/**
 * PhaseRepository — Supabase mode ルーティングテスト
 * モック Supabase client を使い、テーブル名・camelCase マッピングを検証する。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { PhaseRepository, type PhaseRecord } from './PhaseRepository.js';
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

function makePhaseRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'phase-1',
    project_id: 'project-1',
    organization_id: null,
    parent_id: null,
    level: 1,
    name: '内装工事',
    order_index: 0,
    start_date: '2026-06-01',
    end_date: '2026-07-31',
    status: 'planned',
    created_at: '2026-05-08T00:00:00.000Z',
    updated_at: '2026-05-08T00:00:00.000Z',
    ...overrides,
  };
}

function makePhaseRecord(overrides: Partial<PhaseRecord> = {}): PhaseRecord {
  return {
    id: 'phase-1',
    projectId: 'project-1',
    organizationId: null,
    parentId: null,
    level: 1,
    name: '内装工事',
    orderIndex: 0,
    startDate: '2026-06-01',
    endDate: '2026-07-31',
    status: 'planned',
    createdAt: '2026-05-08T00:00:00.000Z',
    updatedAt: '2026-05-08T00:00:00.000Z',
    ...overrides,
  };
}

describe('PhaseRepository — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSupabase=true で getAsync は phases テーブルを参照し camelCase マッピングする', async () => {
    const row = makePhaseRow();
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new PhaseRepository(true);
    const result = await repo.getAsync('phase-1');

    expect(mockFrom).toHaveBeenCalledWith('phases');
    expect(result?.projectId).toBe('project-1');
    expect(result?.name).toBe('内装工事');
    expect(result?.level).toBe(1);
    expect(result?.orderIndex).toBe(0);
  });

  it('useSupabase=true で listAsync は全フェーズを取得して camelCase に変換する', async () => {
    const rows = [
      makePhaseRow({ id: 'phase-1', name: '内装工事', order_index: 0 }),
      makePhaseRow({ id: 'phase-2', name: '電気工事', order_index: 1, level: 2, parent_id: 'phase-1' }),
    ];
    mockFrom.mockReturnValue(makeBuilder({ data: rows, error: null }));

    const repo = new PhaseRepository(true);
    const result = await repo.listAsync();

    expect(mockFrom).toHaveBeenCalledWith('phases');
    expect(result).toHaveLength(2);
    expect(result[1].parentId).toBe('phase-1');
    expect(result[1].level).toBe(2);
  });

  it('useSupabase=true で listByProjectAsync が projectId でフィルタし orderIndex 順に返す', async () => {
    const rows = [
      makePhaseRow({ id: 'phase-2', project_id: 'project-1', order_index: 1 }),
      makePhaseRow({ id: 'phase-1', project_id: 'project-1', order_index: 0 }),
      makePhaseRow({ id: 'phase-3', project_id: 'project-2', order_index: 0 }),
    ];
    mockFrom.mockReturnValue(makeBuilder({ data: rows, error: null }));

    const repo = new PhaseRepository(true);
    const result = await repo.listByProjectAsync('project-1');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('phase-1');
    expect(result[1].id).toBe('phase-2');
  });

  it('useSupabase=true で saveAsync (新規) は phases テーブルに insert する', async () => {
    const row = makePhaseRow();
    // getById → null (新規), create → row
    mockFrom
      .mockReturnValueOnce(makeBuilder({ data: null, error: null }))
      .mockReturnValueOnce(makeBuilder({ data: row, error: null }));

    const repo = new PhaseRepository(true);
    await repo.saveAsync(makePhaseRecord());

    expect(mockFrom).toHaveBeenCalledWith('phases');
  });

  it('useSupabase=true で saveAsync (更新) は phases テーブルを update する', async () => {
    const row = makePhaseRow({ status: 'in_progress' });
    // getById → existing row, update → updated row
    mockFrom
      .mockReturnValueOnce(makeBuilder({ data: row, error: null }))
      .mockReturnValueOnce(makeBuilder({ data: row, error: null }));

    const repo = new PhaseRepository(true);
    await repo.saveAsync(makePhaseRecord({ status: 'in_progress' }));

    expect(mockFrom).toHaveBeenCalledWith('phases');
  });

  it('useSupabase=false (InMemory) で CRUD が正しく動作する', async () => {
    const repo = new PhaseRepository(false);
    const phase = makePhaseRecord({ id: 'mem-phase-1', projectId: 'proj-a', name: '仮設工事' });

    await repo.saveAsync(phase);
    const fetched = await repo.getAsync('mem-phase-1');
    expect(fetched?.name).toBe('仮設工事');

    await repo.saveAsync({ ...phase, name: '仮設工事（更新）' });
    const updated = await repo.getAsync('mem-phase-1');
    expect(updated?.name).toBe('仮設工事（更新）');

    const deleted = await repo.deleteAsync('mem-phase-1');
    expect(deleted).toBe(true);
    expect(await repo.getAsync('mem-phase-1')).toBeNull();
  });

  it('useSupabase=false (InMemory) で listByProjectAsync が projectId フィルタを適用する', async () => {
    const repo = new PhaseRepository(false);
    await repo.saveAsync(makePhaseRecord({ id: 'p1', projectId: 'proj-a', orderIndex: 1 }));
    await repo.saveAsync(makePhaseRecord({ id: 'p2', projectId: 'proj-a', orderIndex: 0 }));
    await repo.saveAsync(makePhaseRecord({ id: 'p3', projectId: 'proj-b', orderIndex: 0 }));

    const result = await repo.listByProjectAsync('proj-a');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('p2');
    expect(result[1].id).toBe('p1');
  });

  it('useSupabase=true で deleteAsync がエラー時に false を返す', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'not found' } }));

    const repo = new PhaseRepository(true);
    const result = await repo.deleteAsync('nonexistent');
    expect(result).toBe(false);
  });
});
