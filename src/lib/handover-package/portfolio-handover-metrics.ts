/**
 * portfolio-handover-metrics — portfolio-aggregator 向け引渡しパッケージメトリクス
 *
 * Sprint 17-C: 引渡しパッケージ自動生成
 */

import type { HandoverDocumentKind } from "./types.js";
import { handoverPackageStore } from "./handover-package-store.js";
import { getExpiringSoon } from "./warranty-tracker.js";

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 未引渡し (delivered / archived 以外) のパッケージ数。
 */
export function pendingHandoverPackages(): number {
  const all = handoverPackageStore.listRecent(1000);
  return all.filter(
    (pkg) => pkg.status !== "delivered" && pkg.status !== "archived",
  ).length;
}

/**
 * 引渡し完了したパッケージの平均準備日数 (completedAt → deliveredAt)。
 */
export function avgHandoverPreparationDays(): number {
  const all = handoverPackageStore.listRecent(1000);
  const delivered = all.filter((pkg) => pkg.deliveredAt);
  if (delivered.length === 0) return 0;

  const total = delivered.reduce((sum, pkg) => {
    const start = new Date(pkg.completedAt).getTime();
    const end = new Date(pkg.deliveredAt!).getTime();
    const days = (end - start) / (1000 * 60 * 60 * 24);
    return sum + Math.max(0, days);
  }, 0);

  return Math.round((total / delivered.length) * 10) / 10;
}

/**
 * 全パッケージ内で保証期限が30日以内に失効する書類数。
 */
export function expiringWarranties(withinDays = 30): number {
  const all = handoverPackageStore.listRecent(1000);
  let count = 0;
  for (const pkg of all) {
    count += getExpiringSoon(pkg.documents, withinDays).length;
  }
  return count;
}

/**
 * 最も多いドキュメント種別を返す。
 * パッケージが0件の場合は null。
 */
export function mostFrequentDocumentKind(): HandoverDocumentKind | null {
  const all = handoverPackageStore.listRecent(1000);
  if (all.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const pkg of all) {
    for (const doc of pkg.documents) {
      counts[doc.kind] = (counts[doc.kind] ?? 0) + 1;
    }
  }

  if (Object.keys(counts).length === 0) return null;

  const top = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
  return (top?.[0] ?? null) as HandoverDocumentKind | null;
}
