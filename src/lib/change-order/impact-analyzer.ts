/**
 * impact-analyzer — 変更指示の金額差分+工期差分+影響職種を自動算出。
 *
 * Sprint 17-B: 変更管理ワークフロー
 * コスト増加 ≥10% で危険信号フラグを立てる。
 */

import type { ChangeOrderKind, ImpactAnalysis } from "./types.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type EstimateLine = {
  id: string;
  trade: string;
  descriptionJa: string;
  unitPriceJpy: number;
  quantity: number;
  unit: string;
};

export type PhaseInfo = {
  id: string;
  nameJa: string;
  trade: string;
  durationDays: number;
};

export type ImpactAnalysisInput = {
  kind: ChangeOrderKind;
  /** 元の見積行 (変更前) */
  originalLines: EstimateLine[];
  /** 変更後の見積行 */
  newLines: EstimateLine[];
  /** 工程フェーズ一覧 */
  phases: PhaseInfo[];
  /** 変更対象フェーズID */
  targetPhaseIds?: string[];
  /** 基準コスト (元請け契約額 JPY) */
  baseContractJpy: number;
};

// ── Cost delta ─────────────────────────────────────────────────────────────

function computeLineCost(lines: EstimateLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPriceJpy * l.quantity, 0);
}

// ── Schedule delta ─────────────────────────────────────────────────────────

const SCHEDULE_DELTA_BY_KIND: Record<ChangeOrderKind, number> = {
  addition: 3,
  modification: 1,
  deletion: -1,
  materialUpgrade: 2,
  scheduleShift: 5,
};

function computeScheduleDelta(
  kind: ChangeOrderKind,
  phases: PhaseInfo[],
  targetPhaseIds: string[],
): number {
  if (targetPhaseIds.length === 0) return SCHEDULE_DELTA_BY_KIND[kind];

  const targetPhases = phases.filter((p) => targetPhaseIds.includes(p.id));
  if (targetPhases.length === 0) return SCHEDULE_DELTA_BY_KIND[kind];

  // Sum affected phase durations * kind factor
  const totalDuration = targetPhases.reduce((sum, p) => sum + p.durationDays, 0);
  const kindFactor = kind === "deletion" ? -0.1 : kind === "materialUpgrade" ? 0.2 : 0.15;
  return Math.round(totalDuration * kindFactor) || SCHEDULE_DELTA_BY_KIND[kind];
}

// ── Affected trades ────────────────────────────────────────────────────────

function collectAffectedTrades(
  originalLines: EstimateLine[],
  newLines: EstimateLine[],
  phases: PhaseInfo[],
  targetPhaseIds: string[],
): string[] {
  const trades = new Set<string>();

  for (const l of [...originalLines, ...newLines]) {
    if (l.trade) trades.add(l.trade);
  }

  const targetPhases = phases.filter((p) => targetPhaseIds.includes(p.id));
  for (const p of targetPhases) {
    if (p.trade) trades.add(p.trade);
  }

  return Array.from(trades).sort();
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 変更指示の影響分析を実行する。
 * 危険信号: costIncreaseRatioPct ≥ 10
 */
export function analyzeImpact(input: ImpactAnalysisInput): ImpactAnalysis {
  const originalCost = computeLineCost(input.originalLines);
  const newCost = computeLineCost(input.newLines);
  const costDeltaJpy = newCost - originalCost;

  const targetPhaseIds = input.targetPhaseIds ?? [];
  const scheduleDeltaDays = computeScheduleDelta(input.kind, input.phases, targetPhaseIds);

  const affectedTrades = collectAffectedTrades(
    input.originalLines,
    input.newLines,
    input.phases,
    targetPhaseIds,
  );

  const costIncreaseRatioPct =
    input.baseContractJpy > 0
      ? Math.round((costDeltaJpy / input.baseContractJpy) * 1000) / 10
      : 0;

  return {
    costDeltaJpy,
    scheduleDeltaDays,
    affectedTrades,
    dependencyChain: [], // resolved by dependency-resolver
    costIncreaseRatioPct,
  };
}

/**
 * コスト増加が危険域かどうか。
 * 10% 以上で true。
 */
export function isDangerousImpact(analysis: ImpactAnalysis): boolean {
  return analysis.costIncreaseRatioPct >= 10;
}
