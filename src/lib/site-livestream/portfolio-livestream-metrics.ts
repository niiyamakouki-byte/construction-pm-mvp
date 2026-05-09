/**
 * portfolio-livestream-metrics — portfolio-aggregator 向けライブストリームメトリクス
 *
 * Sprint 18-B: 現場ライブストリーム共有
 */

import type { StreamChannelKind } from "./types.js";
import { livestreamStore } from "./livestream-store.js";

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 審査待ち投稿数 (status='pending_review' の post 件数 across all sessions)。
 */
export function pendingLivestreamReviews(): number {
  const all = livestreamStore.getAll();
  return all.reduce((count, session) => {
    return count + session.posts.filter((p) => p.status === "pending_review").length;
  }, 0);
}

/**
 * 過去7日間の投稿数 (capturedAt が 過去7日以内)。
 */
export function livestreamPostsThisWeek(): number {
  const all = livestreamStore.getAll();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return all.reduce((count, session) => {
    return (
      count +
      session.posts.filter((p) => new Date(p.capturedAt) >= sevenDaysAgo).length
    );
  }, 0);
}

/**
 * 1日あたりの平均視聴数 (viewCount / 7日 平均)。
 * 投稿が0件の場合は 0 を返す。
 */
export function avgDailyEngagement(): number {
  const all = livestreamStore.getAll();
  const allPosts = all.flatMap((s) => s.posts);

  if (allPosts.length === 0) return 0;

  const totalViews = allPosts.reduce((sum, p) => sum + p.viewCount, 0);
  return Math.round((totalViews / 7) * 10) / 10;
}

/**
 * 最も投稿数が多い channelKind を返す。
 * 投稿が0件の場合は null。
 */
export function mostActiveChannelKind(): StreamChannelKind | null {
  const all = livestreamStore.getAll();
  const allPosts = all.flatMap((s) => s.posts);

  if (allPosts.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const post of allPosts) {
    counts[post.channelKind] = (counts[post.channelKind] ?? 0) + 1;
  }

  const top = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
  return (top?.[0] ?? null) as StreamChannelKind | null;
}
