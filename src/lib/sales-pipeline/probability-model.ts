/**
 * ProbabilityModel — ステージ別確度とウェイテッド金額の計算.
 *
 * Sprint 16-B: 営業パイプライン可視化
 */

import type { Deal, DealStage } from "./types.js";

// ── Default probabilities by stage ────────────────────────────────────────

export const DEFAULT_STAGE_PROBABILITY: Record<DealStage, number> = {
  inquiry: 5,
  first_reply: 15,
  site_survey: 30,
  proposal: 50,
  contract: 80,
  kickoff: 95,
  won: 100,
  lost: 0,
};

// ── Stall penalty thresholds (days) ───────────────────────────────────────

const STALL_PENALTY_DAYS: Partial<Record<DealStage, number>> = {
  proposal: 14,
  contract: 7,
  site_survey: 14,
};

const STALL_PENALTY_PCT = 10;

/**
 * ステージ + 滞留日数から確度を推薦する。
 * ステージのデフォルト確度から、超過滞留がある場合に減算する。
 * won/lost は常に 100/0 で固定。
 */
export function recommendProbability(deal: Deal): number {
  if (deal.currentStage === "won") return 100;
  if (deal.currentStage === "lost") return 0;

  const base = DEFAULT_STAGE_PROBABILITY[deal.currentStage];
  const stallThreshold = STALL_PENALTY_DAYS[deal.currentStage];

  if (!stallThreshold) return base;

  // 現ステージでの滞留日数を計算
  const lastTransition = deal.stageHistory[deal.stageHistory.length - 1];
  const stageStart = lastTransition
    ? new Date(lastTransition.transitionedAt)
    : new Date(deal.createdAt);
  const daysInCurrentStage = Math.floor(
    (Date.now() - stageStart.getTime()) / 86400000,
  );

  if (daysInCurrentStage >= stallThreshold) {
    return Math.max(0, base - STALL_PENALTY_PCT);
  }

  return base;
}

/**
 * ウェイテッド金額 = expectedAmountJpy × probabilityPct / 100
 */
export function weightedAmount(deal: Deal): number {
  return Math.round((deal.expectedAmountJpy * deal.probabilityPct) / 100);
}
