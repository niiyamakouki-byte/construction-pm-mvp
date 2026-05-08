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
