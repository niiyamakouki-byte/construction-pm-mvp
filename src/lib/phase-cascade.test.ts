/**
 * phase-cascade.test.ts — Phase 2.0 + Sprint 68
 * BFS DAG 伝播エンジンのユニットテスト
 */
import { describe, it, expect } from 'vitest';
import {
  computeCascade,
  applyRainDelay,
  cascadeDelay,
  detectCycles,
  applyCascade,
  previewCascade,
} from './phase-cascade.js';
import type { PhaseRecord } from './supabase-adapter/PhaseRepository.js';
import type { CascadeNode } from './phase-cascade.js';

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

// ─────────────────────────────────────────────────────────────────────────────
// Sprint 68: CascadeNode ベースのカスケード計算テスト
// ─────────────────────────────────────────────────────────────────────────────

/** UTC 日付文字列から Date を作るヘルパー */
function d(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** CascadeNode のファクトリ */
function makeNode(
  id: string,
  start: string,
  end: string,
  dependsOn: string[] = [],
  opts: Partial<Omit<CascadeNode, 'id' | 'start' | 'end' | 'dependsOn'>> = {},
): CascadeNode {
  const startDate = d(start);
  const endDate = d(end);
  const duration = Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000);
  return {
    id,
    start: startDate,
    end: endDate,
    duration,
    dependsOn,
    dependencyType: 'FS',
    ...opts,
  };
}

describe('detectCycles', () => {
  it('循環なしのグラフでは throw しない', () => {
    const nodes = [
      makeNode('A', '2026-06-01', '2026-06-05'),
      makeNode('B', '2026-06-06', '2026-06-10', ['A']),
      makeNode('C', '2026-06-11', '2026-06-15', ['B']),
    ];
    expect(() => detectCycles(nodes)).not.toThrow();
  });

  it('直接循環 A->B->A を検出して throw する', () => {
    const nodes = [
      makeNode('A', '2026-06-01', '2026-06-05', ['B']),
      makeNode('B', '2026-06-06', '2026-06-10', ['A']),
    ];
    expect(() => detectCycles(nodes)).toThrow(/循環依存/);
  });

  it('間接循環 A->B->C->A を検出して throw する', () => {
    const nodes = [
      makeNode('A', '2026-06-01', '2026-06-05', ['C']),
      makeNode('B', '2026-06-06', '2026-06-10', ['A']),
      makeNode('C', '2026-06-11', '2026-06-15', ['B']),
    ];
    expect(() => detectCycles(nodes)).toThrow(/循環依存/);
  });
});

describe('cascadeDelay — FS (Finish-to-Start)', () => {
  it('上流終了日が下流開始日になり duration を保つ', () => {
    // A: 1-5 → B: 6-10 (duration=4). A を 3 日遅延 → end=8
    const nodes = [
      makeNode('A', '2026-06-01', '2026-06-05'),
      makeNode('B', '2026-06-06', '2026-06-10', ['A'], { dependencyType: 'FS' }),
    ];
    const map = cascadeDelay(nodes, 'A', 3);
    // A: 4-8
    expect(map['A'].newStart).toEqual(d('2026-06-04'));
    expect(map['A'].newEnd).toEqual(d('2026-06-08'));
    // B: FS → start = A.end = 2026-06-08, end = 08 + 4 = 12
    expect(map['B'].newStart).toEqual(d('2026-06-08'));
    expect(map['B'].newEnd).toEqual(d('2026-06-12'));
    expect(map['B'].delta).toBeGreaterThan(0);
  });

  it('複数下流に分岐して伝播する', () => {
    const nodes = [
      makeNode('A', '2026-06-01', '2026-06-05'),
      makeNode('B', '2026-06-06', '2026-06-10', ['A'], { dependencyType: 'FS' }),
      makeNode('C', '2026-06-06', '2026-06-12', ['A'], { dependencyType: 'FS' }),
    ];
    const map = cascadeDelay(nodes, 'A', 2);
    expect(map['B']).toBeDefined();
    expect(map['C']).toBeDefined();
    expect(map['B'].delta).toBeGreaterThan(0);
    expect(map['C'].delta).toBeGreaterThan(0);
  });
});

describe('cascadeDelay — SS (Start-to-Start)', () => {
  it('下流の start が上流 start に揃い duration を保つ', () => {
    // A: 1-5 (4d). B: 3-7 (4d) SS→A. A 5日遅延: start=6
    const nodes = [
      makeNode('A', '2026-06-01', '2026-06-05'),
      makeNode('B', '2026-06-03', '2026-06-07', ['A'], { dependencyType: 'SS' }),
    ];
    const map = cascadeDelay(nodes, 'A', 5);
    // A.start = 2026-06-06
    // B.start = A.start = 2026-06-06, B duration=4, end=2026-06-10
    expect(map['B'].newStart).toEqual(map['A'].newStart);
    const bDuration = Math.floor(
      (map['B'].newEnd.getTime() - map['B'].newStart.getTime()) / 86_400_000,
    );
    expect(bDuration).toBe(4);
  });
});

describe('cascadeDelay — FF (Finish-to-Finish)', () => {
  it('下流の end が上流 end に揃い duration を保つ', () => {
    // A: 1-5 (4d). B: 2-6 (4d) FF→A. A 3日遅延: end=8
    const nodes = [
      makeNode('A', '2026-06-01', '2026-06-05'),
      makeNode('B', '2026-06-02', '2026-06-06', ['A'], { dependencyType: 'FF' }),
    ];
    const map = cascadeDelay(nodes, 'A', 3);
    // A.end = 2026-06-08
    // B.end = A.end = 2026-06-08, duration=4, start=2026-06-04
    expect(map['B'].newEnd).toEqual(map['A'].newEnd);
    const bDuration = Math.floor(
      (map['B'].newEnd.getTime() - map['B'].newStart.getTime()) / 86_400_000,
    );
    expect(bDuration).toBe(4);
  });
});

describe('cascadeDelay — SF (Start-to-Finish)', () => {
  it('下流の end が上流 start に揃い duration を保つ', () => {
    // A: 10-15. B: 5-9 (4d) SF→A. A 2日遅延: start=12
    const nodes = [
      makeNode('A', '2026-06-10', '2026-06-15'),
      makeNode('B', '2026-06-05', '2026-06-09', ['A'], { dependencyType: 'SF' }),
    ];
    const map = cascadeDelay(nodes, 'A', 2);
    // A.start = 2026-06-12
    // B.end = A.start = 2026-06-12, duration=4, start=2026-06-08
    expect(map['B'].newEnd).toEqual(map['A'].newStart);
    const bDuration = Math.floor(
      (map['B'].newEnd.getTime() - map['B'].newStart.getTime()) / 86_400_000,
    );
    expect(bDuration).toBe(4);
  });
});

describe('cascadeDelay — locked ノード吸収', () => {
  it('locked ノードは移動せず delta=0 になる', () => {
    const nodes = [
      makeNode('A', '2026-06-01', '2026-06-05'),
      makeNode('B', '2026-06-06', '2026-06-10', ['A'], { locked: true }),
      makeNode('C', '2026-06-11', '2026-06-15', ['B'], { dependencyType: 'FS' }),
    ];
    const map = cascadeDelay(nodes, 'A', 3);
    expect(map['B'].delta).toBe(0);
    expect(map['B'].newStart).toEqual(d('2026-06-06'));
    expect(map['B'].newEnd).toEqual(d('2026-06-10'));
    // C は locked な B の元日程を参照するので delta は実質 B.end=6/10 基準
    expect(map['C']).toBeDefined();
  });

  it('起点ノード自体が locked の場合も delta=0', () => {
    const nodes = [
      makeNode('A', '2026-06-01', '2026-06-05', [], { locked: true }),
      makeNode('B', '2026-06-06', '2026-06-10', ['A']),
    ];
    const map = cascadeDelay(nodes, 'A', 5);
    expect(map['A'].delta).toBe(0);
  });
});

describe('cascadeDelay — 循環依存で throw', () => {
  it('循環を含むノード配列で cascadeDelay を呼ぶと throw する', () => {
    const nodes = [
      makeNode('X', '2026-06-01', '2026-06-05', ['Y']),
      makeNode('Y', '2026-06-06', '2026-06-10', ['X']),
    ];
    expect(() => cascadeDelay(nodes, 'X', 1)).toThrow(/循環依存/);
  });
});

describe('cascadeDelay — 3 ノード直列伝播', () => {
  it('A→B→C で A 遅延が C まで伝わる', () => {
    const nodes = [
      makeNode('A', '2026-06-01', '2026-06-05'),
      makeNode('B', '2026-06-05', '2026-06-10', ['A'], { dependencyType: 'FS' }),
      makeNode('C', '2026-06-10', '2026-06-15', ['B'], { dependencyType: 'FS' }),
    ];
    const map = cascadeDelay(nodes, 'A', 3);
    expect(map['A']).toBeDefined();
    expect(map['B']).toBeDefined();
    expect(map['C']).toBeDefined();
    expect(map['C'].delta).toBeGreaterThan(0);
  });
});

describe('applyCascade', () => {
  it('cascadeMap を元ノード配列に適用して新配列を返す', () => {
    const nodes = [
      makeNode('A', '2026-06-01', '2026-06-05'),
      makeNode('B', '2026-06-06', '2026-06-10', ['A']),
    ];
    const map = cascadeDelay(nodes, 'A', 3);
    const updated = applyCascade(nodes, map);

    // immutable: 元ノードは変化しない
    expect(nodes[0].start).toEqual(d('2026-06-01'));

    // 更新後のノードは cascadeMap に従う
    const a = updated.find((n) => n.id === 'A')!;
    expect(a.start).toEqual(map['A'].newStart);
    expect(a.end).toEqual(map['A'].newEnd);

    const b = updated.find((n) => n.id === 'B')!;
    expect(b.start).toEqual(map['B'].newStart);
  });

  it('cascadeMap にないノードは変化しない', () => {
    const nodes = [
      makeNode('A', '2026-06-01', '2026-06-05'),
      makeNode('Z', '2026-07-01', '2026-07-10'), // no dependency
    ];
    const map = cascadeDelay(nodes, 'A', 2);
    const updated = applyCascade(nodes, map);
    const z = updated.find((n) => n.id === 'Z')!;
    expect(z.start).toEqual(d('2026-07-01'));
  });
});

describe('previewCascade', () => {
  it('影響するノードの delta サマリを返す', () => {
    const nodes = [
      makeNode('A', '2026-06-01', '2026-06-05'),
      makeNode('B', '2026-06-05', '2026-06-10', ['A']),
      makeNode('C', '2026-06-10', '2026-06-15', ['B']),
    ];
    const preview = previewCascade(nodes, 'A', 4);
    const ids = preview.map((p) => p.id);
    expect(ids).toContain('A');
    expect(ids).toContain('B');
    expect(ids).toContain('C');
    const aItem = preview.find((p) => p.id === 'A')!;
    expect(aItem.delta).toBe(4);
  });

  it('locked ノードは delta=0 / locked=true で返る', () => {
    const nodes = [
      makeNode('A', '2026-06-01', '2026-06-05'),
      makeNode('B', '2026-06-05', '2026-06-10', ['A'], { locked: true }),
    ];
    const preview = previewCascade(nodes, 'A', 3);
    const bItem = preview.find((p) => p.id === 'B')!;
    expect(bItem.delta).toBe(0);
    expect(bItem.locked).toBe(true);
  });
});
