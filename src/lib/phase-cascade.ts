/**
 * phase-cascade.ts — Phase 2.0
 * フェーズ遅延の玉突き伝播エンジン。
 * phases.parent_id による親子ツリーを BFS で走査し、
 * 起点フェーズ以下の全子孫に delayDays を加算した日程を返す。
 *
 * - done / canceled のフェーズは伝播をスキップする。
 * - startDate / endDate が null のフェーズは日程を変更しない（ID のみ含める）。
 */

import type { PhaseRecord } from './supabase-adapter/PhaseRepository.js';

export type DateShift = {
  phaseId: string;
  newStartDate: string | null;
  newEndDate: string | null;
};

export type CascadeResult = {
  originPhaseId: string;
  delayDays: number;
  affected: DateShift[];
};

/** ISO date 文字列に days 日を加算して返す */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * `phases` の配列と、起点フェーズ ID および遅延日数を受け取り、
 * 影響を受けるフェーズの新しい日程リストを返す。
 *
 * @param phases  プロジェクト内の全フェーズ（起点フェーズを含む）
 * @param delayedPhaseId  遅延が発生したフェーズの ID
 * @param delayDays  繰り下げ日数（正の整数）
 */
export function computeCascade(
  phases: PhaseRecord[],
  delayedPhaseId: string,
  delayDays: number,
): CascadeResult {
  if (delayDays <= 0) {
    return { originPhaseId: delayedPhaseId, delayDays, affected: [] };
  }

  // parent_id -> children のリバースマップを構築
  const childrenMap = new Map<string, string[]>();
  for (const p of phases) {
    if (p.parentId) {
      const siblings = childrenMap.get(p.parentId) ?? [];
      siblings.push(p.id);
      childrenMap.set(p.parentId, siblings);
    }
  }

  const phaseMap = new Map(phases.map((p) => [p.id, p]));
  const affected: DateShift[] = [];
  const visited = new Set<string>();
  const queue: string[] = [delayedPhaseId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const phase = phaseMap.get(currentId);
    if (!phase) continue;

    // done / canceled フェーズは伝播を止める
    if (phase.status === 'done' || phase.status === 'canceled') continue;

    const newStartDate =
      phase.startDate ? addDays(phase.startDate, delayDays) : null;
    const newEndDate =
      phase.endDate ? addDays(phase.endDate, delayDays) : null;

    affected.push({ phaseId: currentId, newStartDate, newEndDate });

    // 子フェーズをキューに追加
    const children = childrenMap.get(currentId) ?? [];
    for (const childId of children) {
      if (!visited.has(childId)) {
        queue.push(childId);
      }
    }
  }

  return { originPhaseId: delayedPhaseId, delayDays, affected };
}

/**
 * 雨天中止ヘルパー: blocked フェーズから 1 日（デフォルト）繰り下げる。
 */
export function applyRainDelay(
  phases: PhaseRecord[],
  blockedPhaseId: string,
  days = 1,
): CascadeResult {
  return computeCascade(phases, blockedPhaseId, days);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sprint 68: CascadeNode ベースの依存タイプ別カスケード計算
// ─────────────────────────────────────────────────────────────────────────────

/** FS/SS/FF/SF の 4 依存タイプ */
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

/**
 * カスケード計算の入力ノード。
 * タスク/フェーズどちらにも使える汎用型。
 */
export type CascadeNode = {
  id: string;
  start: Date;
  end: Date;
  duration: number; // days
  dependsOn: string[]; // 上流ノード ID
  dependencyType?: DependencyType;
  locked?: boolean; // ユーザーが手動固定したノード
};

/** cascadeDelay の結果 map の各エントリ */
export type CascadeEntry = {
  newStart: Date;
  newEnd: Date;
  delta: number; // days shifted (0 if locked)
};

/** cascadeDelay の戻り値 */
export type CascadeMap = Record<string, CascadeEntry>;

/** ロックされたノードが上流遅延を完全に吸収できない場合の警告 */
export type CascadeWarning = {
  nodeId: string;
  message: string;
};

/** Date に整数日を加算して新しい Date を返す（immutable） */
function shiftDate(d: Date, days: number): Date {
  const result = new Date(d.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** ms 差を日数に変換（切り捨て） */
function msToDays(ms: number): number {
  return Math.floor(ms / 86_400_000);
}

/**
 * DFS による循環依存検出。
 * 循環が存在する場合は循環に含まれるノード ID の配列を返す。
 * 循環がなければ null を返す。
 */
function findCycle(
  id: string,
  successorMap: Map<string, string[]>,
  path: string[],
  seen: Set<string>,
  finished: Set<string>,
): string[] | null {
  seen.add(id);
  path.push(id);
  for (const next of successorMap.get(id) ?? []) {
    if (finished.has(next)) continue;
    if (seen.has(next)) {
      // 循環の起点から path を切り出す
      const cycleStart = path.indexOf(next);
      return path.slice(cycleStart);
    }
    const cycle = findCycle(next, successorMap, path, seen, finished);
    if (cycle) return cycle;
  }
  path.pop();
  finished.add(id);
  return null;
}

/**
 * ノード配列の循環依存を検出する。
 * 循環があれば循環ノード ID 配列を throw する。
 */
export function detectCycles(nodes: CascadeNode[]): void {
  // predecessorId -> successorIds
  const successorMap = new Map<string, string[]>();
  for (const node of nodes) {
    for (const depId of node.dependsOn) {
      const list = successorMap.get(depId) ?? [];
      list.push(node.id);
      successorMap.set(depId, list);
    }
  }

  const seen = new Set<string>();
  const finished = new Set<string>();
  for (const node of nodes) {
    if (finished.has(node.id)) continue;
    const cycle = findCycle(node.id, successorMap, [], seen, finished);
    if (cycle) {
      throw new Error(`循環依存が検出されました: ${cycle.join(' -> ')}`);
    }
  }
}

/**
 * `delayedId` ノードを `delayDays` 日遅延させた場合の、
 * 全下流ノードへの影響を計算して返す純粋関数。
 *
 * - `locked: true` のノードは移動しない（上流遅延を吸収）
 * - 循環依存は detectCycles で事前検出し throw
 *
 * @returns CascadeMap — { [id]: { newStart, newEnd, delta } }
 */
export function cascadeDelay(
  nodes: CascadeNode[],
  delayedId: string,
  delayDays: number,
): CascadeMap {
  detectCycles(nodes);

  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));
  const warnings: CascadeWarning[] = [];

  // successorId -> list of { predecessorId, depType }
  // predecessor -> successors の逆マップ
  const successorMap = new Map<string, Array<{ id: string; depType: DependencyType }>>();
  for (const node of nodes) {
    for (const depId of node.dependsOn) {
      const list = successorMap.get(depId) ?? [];
      list.push({ id: node.id, depType: node.dependencyType ?? 'FS' });
      successorMap.set(depId, list);
    }
  }

  // 起点ノードに遅延を適用
  const origin = nodeMap.get(delayedId);
  if (!origin) return {};

  const result: CascadeMap = {};

  if (!origin.locked) {
    const newStart = shiftDate(origin.start, delayDays);
    const newEnd = shiftDate(origin.end, delayDays);
    nodeMap.set(delayedId, { ...origin, start: newStart, end: newEnd });
    result[delayedId] = { newStart, newEnd, delta: delayDays };
  } else {
    warnings.push({ nodeId: delayedId, message: `ノード ${delayedId} はロック済みのため移動しません` });
    result[delayedId] = { newStart: origin.start, newEnd: origin.end, delta: 0 };
  }

  // BFS で下流に伝播
  const visited = new Set<string>([delayedId]);
  const queue: string[] = [delayedId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const current = nodeMap.get(currentId)!;
    const successors = successorMap.get(currentId) ?? [];

    for (const { id: succId, depType } of successors) {
      if (visited.has(succId)) continue;
      visited.add(succId);

      const succ = nodeMap.get(succId)!;
      const duration = msToDays(succ.end.getTime() - succ.start.getTime());

      let newStart: Date;
      let newEnd: Date;

      switch (depType) {
        case 'SS':
          newStart = new Date(current.start.getTime());
          newEnd = shiftDate(newStart, duration);
          break;
        case 'FF':
          newEnd = new Date(current.end.getTime());
          newStart = shiftDate(newEnd, -duration);
          break;
        case 'SF':
          newEnd = new Date(current.start.getTime());
          newStart = shiftDate(newEnd, -duration);
          break;
        case 'FS':
        default:
          newStart = new Date(current.end.getTime());
          newEnd = shiftDate(newStart, duration);
          break;
      }

      const delta = msToDays(newStart.getTime() - succ.start.getTime());

      if (succ.locked) {
        warnings.push({
          nodeId: succId,
          message: `ノード ${succId} はロック済みのため移動しません（上流から ${delta} 日の遅延を吸収）`,
        });
        result[succId] = { newStart: succ.start, newEnd: succ.end, delta: 0 };
        // ロックされたノードの先には現在の（移動しない）日程で伝播
        // nodeMap は変更しない → 下流はロック済みの元日程を参照
      } else {
        nodeMap.set(succId, { ...succ, start: newStart, end: newEnd });
        result[succId] = { newStart, newEnd, delta };
      }

      queue.push(succId);
    }
  }

  return result;
}

/**
 * cascadeDelay の結果を元ノード配列に適用し、新しい配列を返す（immutable）。
 */
export function applyCascade(
  nodes: CascadeNode[],
  cascadeMap: CascadeMap,
): CascadeNode[] {
  return nodes.map((node) => {
    const entry = cascadeMap[node.id];
    if (!entry) return { ...node };
    return {
      ...node,
      start: entry.newStart,
      end: entry.newEnd,
      duration: msToDays(entry.newEnd.getTime() - entry.newStart.getTime()),
    };
  });
}

/** previewCascade のサマリ項目 */
export type CascadePreviewItem = {
  id: string;
  delta: number; // days shifted (0 = no change / locked)
  locked: boolean;
};

/**
 * UI 向けプレビュー: 何が何日ズレるかのサマリを返す。
 * 実際に nodes を変更しない（cascadeDelay のラッパー）。
 */
export function previewCascade(
  nodes: CascadeNode[],
  delayedId: string,
  delayDays: number,
): CascadePreviewItem[] {
  const cascadeMap = cascadeDelay(nodes, delayedId, delayDays);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return Object.entries(cascadeMap).map(([id, entry]) => ({
    id,
    delta: entry.delta,
    locked: nodeMap.get(id)?.locked ?? false,
  }));
}
