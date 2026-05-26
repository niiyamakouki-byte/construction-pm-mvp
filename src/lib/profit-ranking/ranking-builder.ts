/**
 * Ranking builder — constructs a ProfitRankingSnapshot across all projects.
 */

import type { ProfitRankingSnapshot, RankingSortKey } from "./types.js";
import { buildAllProjectMetrics } from "./metrics-builder.js";
import { rankProjects } from "./ranker.js";

/**
 * Build a ProfitRankingSnapshot for all projects in the store.
 *
 * @param sortKey  Which metric to sort by
 */
export function buildRankingSnapshot(sortKey: RankingSortKey): ProfitRankingSnapshot {
  const metrics = buildAllProjectMetrics();
  const entries = rankProjects(metrics, sortKey);

  const avgMarginRatioPct =
    metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.marginRatioPct, 0) / metrics.length
      : 0;

  return {
    entries,
    generatedAt: new Date().toISOString(),
    sortKey,
    totalProjects: metrics.length,
    avgMarginRatioPct,
  };
}
