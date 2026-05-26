/**
 * PhaseCascadeRepository.supabase.test.ts — Phase 2.0
 * mock-supabase を使い cascade SQL 更新を検証する。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { PhaseCascadeRepository } from './PhaseCascadeRepository.js';
import { PhaseRepository } from './PhaseRepository.js';
import * as supabaseClient from '../repository/supabase-client.js';
import type { PhaseRecord } from './PhaseRepository.js';

// ── mock builder ──────────────────────────────────────────────
function makeChain(terminal: { data: unknown; error: { message: string } | null }) {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  const term = () => Promise.resolve(terminal);
  b.select = vi.fn(chain);
  b.eq = vi.fn(chain);
  b.update = vi.fn(chain);
  b.insert = vi.fn(chain);
  b.delete = vi.fn(chain);
  b.order = vi.fn(chain);
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

function makePhaseRecord(overrides: Partial<PhaseRecord> & { id: string }): PhaseRecord {
  return {
    projectId: 'proj-1',
    organizationId: null,
    parentId: null,
    level: 1,
    name: overrides.id,
    orderIndex: 0,
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    status: 'planned',
    createdAt: '2026-05-08T00:00:00.000Z',
    updatedAt: '2026-05-08T00:00:00.000Z',
    ...overrides,
  };
}

describe('PhaseCascadeRepository — InMemory モード', () => {
  let cascadeRepo: PhaseCascadeRepository;
  let phaseRepo: PhaseRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    phaseRepo = new PhaseRepository(false);
    // PhaseCascadeRepository を InMemory モードで使う
    // コンストラクタが false を受け取る
    cascadeRepo = new PhaseCascadeRepository(false);
    // phaseRepo 内部を差し替えるのでなく、cascadeRepo 経由で使う
  });

  it('applyCascade が存在しない phaseId でエラーを投げる', async () => {
    await expect(cascadeRepo.applyCascade('nonexistent', 3)).rejects.toThrow('nonexistent');
  });

  it('applyRainDelay が存在しない phaseId でエラーを投げる', async () => {
    await expect(cascadeRepo.applyRainDelay('nonexistent')).rejects.toThrow('nonexistent');
  });
});

describe('PhaseCascadeRepository — Supabase モック', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applyCascade が phases テーブルを getById → listAsync → update の順に呼ぶ', async () => {
    const phaseRow = {
      id: 'phase-A',
      project_id: 'proj-1',
      organization_id: null,
      parent_id: null,
      level: 1,
      name: 'phase-A',
      order_index: 0,
      start_date: '2026-06-01',
      end_date: '2026-06-10',
      status: 'planned',
      created_at: '2026-05-08T00:00:00.000Z',
      updated_at: '2026-05-08T00:00:00.000Z',
    };
    const childRow = {
      ...phaseRow,
      id: 'phase-B',
      parent_id: 'phase-A',
      start_date: '2026-06-11',
      end_date: '2026-06-20',
    };

    // getById(phase-A) -> phaseRow
    // listAsync (getAll) -> [phaseRow, childRow]
    // update(phase-A) -> ok
    // update(phase-B) -> ok
    mockFrom
      .mockReturnValueOnce(makeChain({ data: phaseRow, error: null }))  // getById
      .mockReturnValueOnce(makeChain({ data: [phaseRow, childRow], error: null })) // getAll
      .mockReturnValue(makeChain({ data: null, error: null })); // update calls

    const cascadeRepo = new PhaseCascadeRepository(true);
    const result = await cascadeRepo.applyCascade('phase-A', 5);

    expect(result.originPhaseId).toBe('phase-A');
    expect(result.delayDays).toBe(5);
    expect(result.affected).toHaveLength(2);
    expect(mockFrom).toHaveBeenCalledWith('phases');
  });

  it('applyRainDelay が delayDays=1 で動作する', async () => {
    const phaseRow = {
      id: 'rain-phase',
      project_id: 'proj-rain',
      organization_id: null,
      parent_id: null,
      level: 1,
      name: 'rain-phase',
      order_index: 0,
      start_date: '2026-07-01',
      end_date: '2026-07-05',
      status: 'blocked',
      created_at: '2026-05-08T00:00:00.000Z',
      updated_at: '2026-05-08T00:00:00.000Z',
    };

    mockFrom
      .mockReturnValueOnce(makeChain({ data: phaseRow, error: null }))   // getById
      .mockReturnValueOnce(makeChain({ data: [phaseRow], error: null })) // getAll
      .mockReturnValue(makeChain({ data: null, error: null }));           // update

    const cascadeRepo = new PhaseCascadeRepository(true);
    const result = await cascadeRepo.applyRainDelay('rain-phase');

    expect(result.delayDays).toBe(1);
    expect(result.affected).toHaveLength(1);
    expect(result.affected[0].newStartDate).toBe('2026-07-02');
    expect(result.affected[0].newEndDate).toBe('2026-07-06');
  });

  it('Supabase エラー時に例外を伝播する', async () => {
    const phaseRow = {
      id: 'phase-err',
      project_id: 'proj-err',
      organization_id: null,
      parent_id: null,
      level: 1,
      name: 'phase-err',
      order_index: 0,
      start_date: '2026-06-01',
      end_date: '2026-06-10',
      status: 'planned',
      created_at: '2026-05-08T00:00:00.000Z',
      updated_at: '2026-05-08T00:00:00.000Z',
    };

    mockFrom
      .mockReturnValueOnce(makeChain({ data: phaseRow, error: null }))
      .mockReturnValueOnce(makeChain({ data: [phaseRow], error: null }))
      .mockReturnValue(makeChain({ data: null, error: { message: 'DB error' } }));

    const cascadeRepo = new PhaseCascadeRepository(true);
    await expect(cascadeRepo.applyCascade('phase-err', 2)).rejects.toThrow('DB error');
  });
});
