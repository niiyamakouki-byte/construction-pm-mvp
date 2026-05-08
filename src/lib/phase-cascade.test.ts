/**
 * phase-cascade.test.ts — Phase 2.0
 * BFS DAG 伝播エンジンのユニットテスト
 */
import { describe, it, expect } from 'vitest';
import { computeCascade, applyRainDelay } from './phase-cascade.js';
import type { PhaseRecord } from './supabase-adapter/PhaseRepository.js';

function makePhase(overrides: Partial<PhaseRecord> & { id: string }): PhaseRecord {
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

describe('computeCascade — 直線 DAG', () => {
  // A -> B -> C (A=root, B=child, C=grandchild)
  const phases: PhaseRecord[] = [
    makePhase({ id: 'A', parentId: null, startDate: '2026-06-01', endDate: '2026-06-10' }),
    makePhase({ id: 'B', parentId: 'A',  startDate: '2026-06-11', endDate: '2026-06-20' }),
    makePhase({ id: 'C', parentId: 'B',  startDate: '2026-06-21', endDate: '2026-06-30' }),
  ];

  it('起点フェーズを含む全子孫が delayDays 分繰り下がる', () => {
    const result = computeCascade(phases, 'A', 3);
    expect(result.affected).toHaveLength(3);
    const a = result.affected.find((s) => s.phaseId === 'A')!;
    expect(a.newStartDate).toBe('2026-06-04');
    expect(a.newEndDate).toBe('2026-06-13');
    const c = result.affected.find((s) => s.phaseId === 'C')!;
    expect(c.newStartDate).toBe('2026-06-24');
  });

  it('delayDays=0 のときは空配列を返す', () => {
    const result = computeCascade(phases, 'A', 0);
    expect(result.affected).toHaveLength(0);
  });

  it('起点が B のとき A は影響しない', () => {
    const result = computeCascade(phases, 'B', 2);
    expect(result.affected.map((s) => s.phaseId)).not.toContain('A');
    expect(result.affected.map((s) => s.phaseId)).toContain('B');
    expect(result.affected.map((s) => s.phaseId)).toContain('C');
  });
});

describe('computeCascade — 分岐 DAG', () => {
  // R -> B1, R -> B2, B1 -> C1
  const phases: PhaseRecord[] = [
    makePhase({ id: 'R',  parentId: null, startDate: '2026-06-01', endDate: '2026-06-05' }),
    makePhase({ id: 'B1', parentId: 'R',  startDate: '2026-06-06', endDate: '2026-06-15' }),
    makePhase({ id: 'B2', parentId: 'R',  startDate: '2026-06-06', endDate: '2026-06-12' }),
    makePhase({ id: 'C1', parentId: 'B1', startDate: '2026-06-16', endDate: '2026-06-20' }),
  ];

  it('分岐ツリーで全子孫が繰り下がる', () => {
    const result = computeCascade(phases, 'R', 5);
    expect(result.affected).toHaveLength(4);
    ['R', 'B1', 'B2', 'C1'].forEach((id) => {
      expect(result.affected.map((s) => s.phaseId)).toContain(id);
    });
  });
});

describe('computeCascade — 終端ステータスのスキップ', () => {
  it('done フェーズとその子孫には伝播しない', () => {
    const phases: PhaseRecord[] = [
      makePhase({ id: 'P', parentId: null }),
      makePhase({ id: 'Q', parentId: 'P', status: 'done' }),
      makePhase({ id: 'R', parentId: 'Q' }), // Q が done なので R も除外
    ];
    const result = computeCascade(phases, 'P', 2);
    // P は含まれる、Q(done)以降はスキップ
    expect(result.affected.map((s) => s.phaseId)).toContain('P');
    expect(result.affected.map((s) => s.phaseId)).not.toContain('Q');
    expect(result.affected.map((s) => s.phaseId)).not.toContain('R');
  });

  it('canceled フェーズには伝播しない', () => {
    const phases: PhaseRecord[] = [
      makePhase({ id: 'P', parentId: null }),
      makePhase({ id: 'Q', parentId: 'P', status: 'canceled' }),
    ];
    const result = computeCascade(phases, 'P', 1);
    expect(result.affected.map((s) => s.phaseId)).not.toContain('Q');
  });
});

describe('applyRainDelay', () => {
  it('デフォルト 1 日で伝播する', () => {
    const phases: PhaseRecord[] = [
      makePhase({ id: 'X', parentId: null, status: 'blocked', startDate: '2026-07-01', endDate: '2026-07-05' }),
      makePhase({ id: 'Y', parentId: 'X',  startDate: '2026-07-06', endDate: '2026-07-10' }),
    ];
    const result = applyRainDelay(phases, 'X');
    expect(result.delayDays).toBe(1);
    const x = result.affected.find((s) => s.phaseId === 'X')!;
    expect(x.newStartDate).toBe('2026-07-02');
    const y = result.affected.find((s) => s.phaseId === 'Y')!;
    expect(y.newEndDate).toBe('2026-07-11');
  });

  it('days 引数で日数を変更できる', () => {
    const phases: PhaseRecord[] = [
      makePhase({ id: 'X', parentId: null, startDate: '2026-07-01', endDate: '2026-07-05' }),
    ];
    const result = applyRainDelay(phases, 'X', 3);
    expect(result.delayDays).toBe(3);
    const x = result.affected.find((s) => s.phaseId === 'X')!;
    expect(x.newStartDate).toBe('2026-07-04');
  });
});
