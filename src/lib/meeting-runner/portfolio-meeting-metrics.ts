/**
 * portfolio-meeting-metrics — portfolio-aggregator 向け会議メトリクス
 *
 * Sprint 17-A: 工程会議自動進行AI
 */

import { meetingStore } from "./meeting-store.js";

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 今月開催された会議の件数。
 */
export function meetingsThisMonth(): number {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth(); // 0-indexed

  const sessions = meetingStore.listRecent(1000);
  return sessions.filter((s) => {
    const dt = new Date(s.scheduledAt);
    return dt.getFullYear() === thisYear && dt.getMonth() === thisMonth;
  }).length;
}

/**
 * 全セッションの平均未解決事項数。
 * minutes が記録されているセッションのみ対象。
 */
export function avgUnresolvedItemsCount(): number {
  const sessions = meetingStore.listRecent(1000);
  const withMinutes = sessions.filter((s) => s.minutes !== undefined);
  if (withMinutes.length === 0) return 0;

  const total = withMinutes.reduce(
    (sum, s) => sum + (s.minutes?.unresolvedItems.length ?? 0),
    0,
  );
  return Math.round((total / withMinutes.length) * 10) / 10;
}

/**
 * 最も会議が多いプロジェクトのID。
 * 同数の場合は直近のもの優先。
 */
export function mostActiveProjectId(): string | null {
  const sessions = meetingStore.listRecent(1000);
  if (sessions.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const s of sessions) {
    counts[s.projectId] = (counts[s.projectId] ?? 0) + 1;
  }

  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
  return sorted[0]?.[0] ?? null;
}
