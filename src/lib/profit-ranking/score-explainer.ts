/**
 * Score explainer — generates Japanese summary strings for ranking entries.
 *
 * Examples:
 *   "粗利35%・工期短縮で重点案件"
 *   "粗利12%・要注意: 赤字リスク"
 *   "粗利28%・安定推移中"
 */

import type { ProfitRankingEntry } from "./types.js";

function fmtPct(n: number): string {
  return `${Math.round(n)}%`;
}

/**
 * Generate a Japanese explanation string for a ranking entry.
 */
export function explainScore_ja(entry: ProfitRankingEntry): string {
  const { projectMetrics: m, badge, rank } = entry;

  const pct = fmtPct(m.marginRatioPct);

  if (badge === "warning") {
    if (m.forecastMarginRatioPct < m.marginRatioPct) {
      return `粗利${pct}・予測${fmtPct(m.forecastMarginRatioPct)}に低下・赤字リスク要対応`;
    }
    return `粗利${pct}・要注意: 赤字リスク`;
  }

  if (badge === "top") {
    if (m.durationMonths <= 3) {
      return `粗利${pct}・工期短縮で重点案件 (${rank}位)`;
    }
    return `粗利${pct}・高粗利重点案件 (${rank}位)`;
  }

  // stable
  const forecastDelta = m.forecastMarginRatioPct - m.marginRatioPct;
  if (forecastDelta > 2) {
    return `粗利${pct}・予測改善中 (+${fmtPct(forecastDelta)})`;
  }
  if (forecastDelta < -2) {
    return `粗利${pct}・予測悪化傾向 (${fmtPct(forecastDelta)})`;
  }
  return `粗利${pct}・安定推移中`;
}
