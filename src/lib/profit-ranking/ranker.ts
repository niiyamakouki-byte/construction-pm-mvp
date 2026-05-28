/**
 * Ranker — sorts projects by the chosen key and assigns badges.
 *
 * Badge rules:
 *   top     — rank 1–3 (unless only warnings)
 *   warning — marginRatioPct < 15 or forecastMarginRatioPct < 15
 *   stable  — everything else
 *
 * Tie handling: entries with identical sort-key values share the same rank,
 * and the next rank is skipped (standard competition ranking, e.g. 1-1-3).
 */

import type { ProjectProfitMetrics, ProfitRankingEntry, RankingSortKey, RankingBadge } from "./types.js";

const WARNING_THRESHOLD = 15; // % — mirrors margin-watch criticalMarginPct

function getSortValue(m: ProjectProfitMetrics, sortKey: RankingSortKey): number {
  switch (sortKey) {
    case "marginRatioPct":
      return m.marginRatioPct;
    case "marginAmount":
      return m.marginAmount;
    case "marginPerMonth":
      return m.marginPerMonth;
    case "forecastDelta":
      return m.forecastMarginRatioPct - m.marginRatioPct;
  }
}

function assignBadge(
  m: ProjectProfitMetrics,
  rank: number,
): RankingBadge {
  if (m.marginRatioPct < WARNING_THRESHOLD || m.forecastMarginRatioPct < WARNING_THRESHOLD) {
    return "warning";
  }
  if (rank <= 3) return "top";
  return "stable";
}

/**
 * Rank projects by sortKey (descending) and return ProfitRankingEntry[].
 *
 * @param metrics  Array of project metrics (any length)
 * @param sortKey  Which metric to rank by
 * @param limit    Optional max entries to return (default: all)
 */
export function rankProjects(
  metrics: ProjectProfitMetrics[],
  sortKey: RankingSortKey,
  limit?: number,
): ProfitRankingEntry[] {
  if (metrics.length === 0) return [];

  // Sort descending by sort value
  const sorted = [...metrics].sort(
    (a, b) => getSortValue(b, sortKey) - getSortValue(a, sortKey),
  );

  // Compute score contributions (0–100 relative to max value)
  const values = sorted.map((m) => getSortValue(m, sortKey));
  const maxVal = Math.max(...values.map(Math.abs), 1);

  // Assign ranks with tie handling
  const entries: ProfitRankingEntry[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    // Ties: same rank if same sort value as previous
    if (i > 0 && getSortValue(m, sortKey) === getSortValue(sorted[i - 1], sortKey)) {
      // Use same rank as previous entry
      const prevRank = entries[i - 1].rank;
      const badge = assignBadge(m, prevRank);
      const scoreContribution = Math.round((Math.abs(getSortValue(m, sortKey)) / maxVal) * 100);
      entries.push({ rank: prevRank, projectMetrics: m, scoreContribution, badge });
    } else {
      const currentRank = i + 1;
      const badge = assignBadge(m, currentRank);
      const scoreContribution = Math.round((Math.abs(getSortValue(m, sortKey)) / maxVal) * 100);
      entries.push({ rank: currentRank, projectMetrics: m, scoreContribution, badge });
    }
  }

  if (limit !== undefined && limit > 0) {
    return entries.slice(0, limit);
  }
  return entries;
}
