/**
 * portfolio-pipeline-metrics — portfolio-aggregator 向けの3指標集計.
 *
 * Sprint 16-B: 営業パイプライン可視化
 */

import { dealStore } from "./deal-store.js";
import { snapshot } from "./pipeline-snapshotter.js";

/**
 * 加重パイプライン合計 (JPY)。
 */
export function weightedPipelineJpy(): number {
  const deals = dealStore.getAll();
  return snapshot(deals).weightedPipelineJpy;
}

/**
 * critical リスクアラートを持つ商談数。
 */
export function criticalRiskDealCount(): number {
  const deals = dealStore.getAll();
  const snap = snapshot(deals);
  const criticalDealIds = new Set(
    snap.riskAlerts
      .filter((a) => a.severity === "critical")
      .map((a) => a.dealId),
  );
  return criticalDealIds.size;
}

/**
 * 今月クローズ予定の加重金額合計 (JPY)。
 */
export function expectedClosesThisMonthJpy(): number {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const deals = dealStore.getAll();
  return deals
    .filter((d) => {
      if (d.currentStage === "won" || d.currentStage === "lost") return false;
      const closeDate = new Date(d.expectedCloseDate);
      return closeDate >= thisMonthStart && closeDate <= thisMonthEnd;
    })
    .reduce((sum, d) => sum + Math.round((d.expectedAmountJpy * d.probabilityPct) / 100), 0);
}
