/**
 * portfolio-change-order-metrics — portfolio-aggregator 向け変更管理メトリクス
 *
 * Sprint 17-B: 変更管理ワークフロー
 */

import type { ChangeOrderKind } from "./types.js";
import { changeOrderStore } from "./change-order-store.js";
import { computeApprovalCycleDays } from "./approval-flow.js";

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 承認待ち (approved/rejected 以外) の変更指示数。
 */
export function pendingChangeOrders(): number {
  const all = changeOrderStore.listRecent(1000);
  return all.filter(
    (co) => co.status !== "approved" && co.status !== "rejected",
  ).length;
}

/**
 * 承認完了した変更指示の平均承認サイクル日数。
 */
export function avgApprovalCycleDays(): number {
  const all = changeOrderStore.listRecent(1000);
  const approved = all.filter((co) => co.approvedAt);
  if (approved.length === 0) return 0;

  const total = approved.reduce((sum, co) => {
    const days = computeApprovalCycleDays(co) ?? 0;
    return sum + days;
  }, 0);

  return Math.round((total / approved.length) * 10) / 10;
}

/**
 * 全変更指示の金額差分合計 (JPY)。
 * impactAnalysis がある変更指示のみ対象。
 */
export function costDeltaTotalJpy(): number {
  const all = changeOrderStore.listRecent(1000);
  return all.reduce((sum, co) => sum + (co.impactAnalysis?.costDeltaJpy ?? 0), 0);
}

/**
 * 最も多い変更種別を返す。
 * 変更指示が0件の場合は null。
 */
export function mostFrequentChangeKind(): ChangeOrderKind | null {
  const all = changeOrderStore.listRecent(1000);
  if (all.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const co of all) {
    counts[co.kind] = (counts[co.kind] ?? 0) + 1;
  }

  const top = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
  return (top?.[0] ?? null) as ChangeOrderKind | null;
}
