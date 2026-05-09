/**
 * PipelineSnapshotter — リアルタイムパイプラインスナップショット生成.
 *
 * Sprint 16-B: 営業パイプライン可視化
 */

import type { Deal, PipelineSnapshot } from "./types.js";
import { weightedAmount } from "./probability-model.js";
import { detectStalls, currentDwellDays } from "./stall-detector.js";
import { STANDARD_DWELL_DAYS } from "./stall-detector.js";

const SEVERITY_ORDER = { critical: 0, warn: 1, info: 2 };

/**
 * deals からリアルタイムのパイプラインスナップショットを生成する。
 */
export function snapshot(deals: Deal[]): PipelineSnapshot {
  const activeDeals = deals.filter(
    (d) => d.currentStage !== "won" && d.currentStage !== "lost",
  );

  // 加重パイプライン合計
  const weightedPipelineJpy = activeDeals.reduce(
    (sum, d) => sum + weightedAmount(d),
    0,
  );

  // 今月クローズ予定件数
  const now = new Date();
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const expectedClosesThisMonth = activeDeals.filter((d) => {
    const closeDate = new Date(d.expectedCloseDate);
    return closeDate >= thisMonthStart && closeDate <= thisMonthEnd;
  }).length;

  // 滞留商談 (標準日数を超えているもの)
  const stalledDeals = activeDeals.filter((d) => {
    const standard = STANDARD_DWELL_DAYS[d.currentStage];
    if (standard === undefined) return false;
    return currentDwellDays(d) >= standard;
  });

  // リスクアラート (severity 順)
  const riskAlerts = detectStalls(deals).sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  return {
    totalDeals: activeDeals.length,
    weightedPipelineJpy,
    stalledDeals,
    expectedClosesThisMonth,
    riskAlerts,
  };
}
