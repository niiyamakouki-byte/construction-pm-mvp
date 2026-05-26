/**
 * Margin calculator — computes actual/forecast gross margin and alert level.
 */

import type { ProjectFinanceSnapshot, MarginWatchConfig, MarginAlertLevel } from "./types.js";
import { DEFAULT_MARGIN_WATCH_CONFIG } from "./types.js";

export type MarginCalculationResult = {
  actual: number;
  forecast: number;
  level: MarginAlertLevel;
};

/**
 * Calculate gross margin ratios and determine the alert level.
 *
 * actual   = (contract - totalCost) / contract * 100
 * forecast = (contract - totalCost - estimatedRemainingCost) / contract * 100
 *
 * Level is determined from the forecast value.
 * 0-division guard: contractAmountYen === 0 → level "safe", ratios 0.
 */
export function calculateMargin(
  snapshot: ProjectFinanceSnapshot,
  config: MarginWatchConfig = DEFAULT_MARGIN_WATCH_CONFIG,
): MarginCalculationResult {
  const { contractAmountYen, totalCostYen, estimatedRemainingCostYen } = snapshot;

  if (contractAmountYen === 0) {
    return { actual: 0, forecast: 0, level: "safe" };
  }

  const actual = ((contractAmountYen - totalCostYen) / contractAmountYen) * 100;
  const forecast =
    ((contractAmountYen - totalCostYen - estimatedRemainingCostYen) / contractAmountYen) * 100;

  const level = resolveLevel(forecast, config);

  return { actual, forecast, level };
}

function resolveLevel(
  forecastPct: number,
  config: MarginWatchConfig,
): MarginAlertLevel {
  if (forecastPct < config.criticalMarginPct) return "critical";
  if (forecastPct < config.targetMarginPct) return "warning";
  if (forecastPct < config.cautionMarginPct) return "caution";
  return "safe";
}
