/**
 * Cause classifier — derives cause tags from two consecutive snapshots.
 */

import type { ProjectFinanceSnapshot } from "./types.js";

/**
 * Classify the causes of margin deterioration by comparing previous and current snapshots.
 *
 * Returns an array of cause tags (日本語).
 * Returns [] when prev is undefined (first-ever snapshot).
 */
export function classifyCause(
  prev: ProjectFinanceSnapshot | undefined,
  current: ProjectFinanceSnapshot,
): string[] {
  if (prev === undefined) return [];

  const causes: string[] = [];

  // 受注額減
  if (prev.contractAmountYen > current.contractAmountYen) {
    causes.push("受注額減");
  }

  // 原価増: current totalCost > prev totalCost * 1.1
  if (current.totalCostYen > prev.totalCostYen * 1.1) {
    causes.push("原価増");
  }

  // 予測超過: estimatedRemainingCost > (contract - totalCost)
  const remainingBudget = current.contractAmountYen - current.totalCostYen;
  if (current.estimatedRemainingCostYen > remainingBudget) {
    causes.push("予測超過");
  }

  // 単価変動: forecast 差分 > 5%
  const forecastDelta = Math.abs(
    current.forecastMarginRatioPct - prev.forecastMarginRatioPct,
  );
  if (forecastDelta > 5) {
    causes.push("単価変動");
  }

  return causes;
}
