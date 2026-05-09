/**
 * portfolio-local-seo-metrics — portfolio-aggregator 向け地域SEOメトリクス
 *
 * Sprint 19-B: 地域SEO自動化
 * KPI 4件: 公開記事数 / top10獲得KW数 / 月間検索流入推定 / GBPアクション数
 */

import { localSeoStore } from "./local-seo-store.js";
import { getGbpActionCount } from "./gbp-syncer.js";
import { classifyRank } from "./serp-tracker.js";

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 公開済み記事数 (status === "published")。
 */
export function publishedArticleCount(): number {
  return localSeoStore.getArticles().filter((a) => a.status === "published").length;
}

/**
 * TOP10 を獲得しているキーワード数。
 * 最新スナップショットで bucket が top3 or top10 のもの。
 */
export function top10KeywordCount(): number {
  const snapshots = localSeoStore.getSnapshots();
  // キーワードIDごとに最新スナップショット1件を使う
  const latestByKeyword = new Map<string, (typeof snapshots)[0]>();
  for (const snap of snapshots) {
    const existing = latestByKeyword.get(snap.keywordTargetId);
    if (!existing || new Date(snap.snapshotAt) > new Date(existing.snapshotAt)) {
      latestByKeyword.set(snap.keywordTargetId, snap);
    }
  }
  return Array.from(latestByKeyword.values()).filter(
    (s) => s.bucket === "top3" || s.bucket === "top10",
  ).length;
}

/**
 * 月間検索流入推定 (impressions estimate)。
 * TOP10 KW の monthlySearchVolume の合計 × CTR 推定 (top3: 30%, top10: 10%)。
 */
export function estimatedMonthlySearchImpressions(): number {
  const keywords = localSeoStore.getKeywords();
  const snapshots = localSeoStore.getSnapshots();

  const latestByKeyword = new Map<string, (typeof snapshots)[0]>();
  for (const snap of snapshots) {
    const existing = latestByKeyword.get(snap.keywordTargetId);
    if (!existing || new Date(snap.snapshotAt) > new Date(existing.snapshotAt)) {
      latestByKeyword.set(snap.keywordTargetId, snap);
    }
  }

  let total = 0;
  for (const kw of keywords) {
    const snap = latestByKeyword.get(kw.id);
    if (!snap) continue;
    const rank = snap.rank;
    const bucket = classifyRank(rank);
    if (bucket === "top3") {
      total += Math.round(kw.monthlySearchVolume * 0.3);
    } else if (bucket === "top10") {
      total += Math.round(kw.monthlySearchVolume * 0.1);
    }
  }
  return total;
}

/**
 * GBP アクション数 (投稿 + 写真 + Q&A の合計)。
 */
export function gbpActionCount(): number {
  return getGbpActionCount();
}
