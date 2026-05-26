/**
 * portfolio-owner-suggestion-metrics — portfolio-aggregator 向け施主提案AIメトリクス
 *
 * Sprint 18-A: 施主提案AI
 */

import type { SuggestionPlanKind } from "./types.js";
import { ownerSuggestionStore } from "./owner-suggestion-store.js";

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 未完了提案数 (status が draft または presented のプランを含む提案)。
 */
export function pendingOwnerSuggestions(): number {
  const all = ownerSuggestionStore.getAll();
  return all.filter((s) => {
    const hasActiveStatus = s.plans.some(
      (p) => p.status === "draft" || p.status === "presented" || p.status === "in_review",
    );
    return !s.decidedPlanId && hasActiveStatus;
  }).length;
}

/**
 * 採用率 (accepted / (accepted + rejected))。
 * 分母が0の場合は 0 を返す。
 */
export function acceptedSuggestionRate(): number {
  const all = ownerSuggestionStore.getAll();
  let accepted = 0;
  let rejected = 0;

  for (const s of all) {
    for (const p of s.plans) {
      if (p.status === "accepted") accepted++;
      if (p.status === "rejected") rejected++;
    }
  }

  const total = accepted + rejected;
  if (total === 0) return 0;
  return Math.round((accepted / total) * 1000) / 1000;
}

/**
 * 最も多く採用されたプランKindを返す。
 * 採用データが0件の場合は null。
 */
export function mostPopularPlanKind(): SuggestionPlanKind | null {
  const all = ownerSuggestionStore.getAll();
  const counts: Record<string, number> = {};

  for (const s of all) {
    if (!s.decidedPlanId) continue;
    const decidedPlan = s.plans.find((p) => p.id === s.decidedPlanId);
    if (decidedPlan) {
      counts[decidedPlan.kind] = (counts[decidedPlan.kind] ?? 0) + 1;
    }
  }

  if (Object.keys(counts).length === 0) return null;

  const top = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
  return (top?.[0] ?? null) as SuggestionPlanKind | null;
}

/**
 * 採用プランの費用と施主予算の平均差分 (JPY)。
 * 採用プランが0件の場合は 0 を返す。
 * 正値 = 施主予算を超過、負値 = 予算内に収まった。
 */
export function avgBudgetGap(): number {
  const all = ownerSuggestionStore.getAll();
  let total = 0;
  let count = 0;

  for (const s of all) {
    if (!s.decidedPlanId) continue;
    const decidedPlan = s.plans.find((p) => p.id === s.decidedPlanId);
    if (decidedPlan) {
      total += decidedPlan.estimatedCost - s.ownerProfile.budget;
      count++;
    }
  }

  if (count === 0) return 0;
  return Math.round(total / count);
}
