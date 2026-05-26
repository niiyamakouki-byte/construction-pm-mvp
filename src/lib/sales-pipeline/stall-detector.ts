/**
 * StallDetector — 滞留商談の検出とリスクアラート生成.
 *
 * Sprint 16-B: 営業パイプライン可視化
 */

import type { Deal, DealStage, RiskAlert } from "./types.js";

// ── Standard dwell times by stage (days) ─────────────────────────────────

export const STANDARD_DWELL_DAYS: Partial<Record<DealStage, number>> = {
  inquiry: 1,
  first_reply: 3,
  site_survey: 7,
  proposal: 14,
  contract: 7,
  kickoff: 3,
};

/**
 * 現在のステージでの滞留日数を返す。
 */
export function currentDwellDays(deal: Deal): number {
  const lastTransition = deal.stageHistory[deal.stageHistory.length - 1];
  const stageStart = lastTransition
    ? new Date(lastTransition.transitionedAt)
    : new Date(deal.createdAt);
  return Math.floor((Date.now() - stageStart.getTime()) / 86400000);
}

/**
 * deals から RiskAlert[] を生成する。
 *
 * ルール:
 * 1. 標準滞留日数超過 → warn、2倍超過 → critical (alertType: "stalled")
 * 2. expectedCloseDate が7日以内 かつ contract 未到達 → critical (alertType: "near_due_no_action")
 * 3. expectedAmountJpy >= 1000万 かつ probabilityPct <= 20% → warn (alertType: "low_probability_high_amount")
 */
export function detectStalls(deals: Deal[]): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  const now = Date.now();

  for (const deal of deals) {
    if (deal.currentStage === "won" || deal.currentStage === "lost") continue;

    const standard = STANDARD_DWELL_DAYS[deal.currentStage];
    if (standard !== undefined) {
      const dwell = currentDwellDays(deal);
      if (dwell >= standard * 2) {
        alerts.push({
          dealId: deal.id,
          alertType: "stalled",
          severity: "critical",
          message: `${deal.customerName}: ${deal.currentStage} ステージで ${dwell} 日間滞留中 (標準 ${standard} 日の2倍超)`,
        });
      } else if (dwell >= standard) {
        alerts.push({
          dealId: deal.id,
          alertType: "stalled",
          severity: "warn",
          message: `${deal.customerName}: ${deal.currentStage} ステージで ${dwell} 日間滞留中 (標準 ${standard} 日超)`,
        });
      }
    }

    // 期待クローズ日が7日以内かつ contract 未到達
    const closeDate = new Date(deal.expectedCloseDate).getTime();
    const daysToClose = Math.floor((closeDate - now) / 86400000);
    const preContractStages: DealStage[] = ["inquiry", "first_reply", "site_survey", "proposal"];
    if (daysToClose <= 7 && preContractStages.includes(deal.currentStage)) {
      alerts.push({
        dealId: deal.id,
        alertType: "near_due_no_action",
        severity: "critical",
        message: `${deal.customerName}: クローズ予定まで ${daysToClose} 日以内だが契約未到達 (現在: ${deal.currentStage})`,
      });
    }

    // 高額低確度
    if (deal.expectedAmountJpy >= 10_000_000 && deal.probabilityPct <= 20) {
      alerts.push({
        dealId: deal.id,
        alertType: "low_probability_high_amount",
        severity: "warn",
        message: `${deal.customerName}: 高額案件 (${(deal.expectedAmountJpy / 10_000).toFixed(0)}万円) で確度 ${deal.probabilityPct}% と低い`,
      });
    }
  }

  return alerts;
}
