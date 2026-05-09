/**
 * portfolio-ambassador-metrics — portfolio-aggregator 向けアンバサダーメトリクス
 *
 * Sprint 18-C: 施主アンバサダー化
 */

import { ambassadorStore } from "./ambassador-store.js";
import { listAllInquiries, listAllRewards } from "./ambassador-facade.js";

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * アクティブなアンバサダー総数 (bronze以上全員)。
 */
export function totalActiveAmbassadors(): number {
  return ambassadorStore.getAll().length;
}

/**
 * ステータスが pending の問合せ数。
 */
export function pendingReferralInquiries(): number {
  return listAllInquiries().filter((i) => i.status === "pending").length;
}

/**
 * 今月の報酬支払予定合計額 (JPY) — isPaid が false のもの。
 */
export function monthlyRewardPayoutJpy(): number {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  return listAllRewards()
    .filter((r) => !r.isPaid && r.calculatedAt >= startOfMonth)
    .reduce((sum, r) => sum + r.amountJpy, 0);
}

/**
 * 最も紹介件数が多いアンバサダーの名前。
 * アンバサダーが0件の場合は null。
 */
export function mostProductiveAmbassadorName(): string | null {
  const all = ambassadorStore.getAll();
  if (all.length === 0) return null;

  const top = [...all].sort(
    (a, b) => b.contractedReferralCount - a.contractedReferralCount,
  )[0];

  return top?.ownerName ?? null;
}
