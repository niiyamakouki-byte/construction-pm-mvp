/**
 * owner-notifier — 施主への通知ディスパッチ (mock implementation)
 *
 * Sprint 18-B: 現場ライブストリーム共有
 * 実 API は未接続 (Discord/LINE/Email/Push スタブ)
 */

import type { LivestreamSession, LivestreamPost, NotificationMethod } from "./types.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type DispatchResult = {
  dispatched: string[];
  skipped: string[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * 現在時刻が quietHours 範囲内かを判定する。
 * start/end は "HH:MM" 形式。
 */
function isInQuietHours(quietHours: { start: string; end: string }, now: Date): boolean {
  const toMinutes = (hhmm: string): number => {
    const parts = hhmm.split(":");
    const h = parseInt(parts[0] ?? "0", 10);
    const m = parseInt(parts[1] ?? "0", 10);
    return h * 60 + m;
  };

  const currentMinutes = ((now.getUTCHours() + 9) % 24) * 60 + now.getUTCMinutes();
  const startMinutes = toMinutes(quietHours.start);
  const endMinutes = toMinutes(quietHours.end);

  if (startMinutes <= endMinutes) {
    // 例: 22:00 〜 07:00 の場合は日をまたがないケース
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // 例: 22:00 〜 07:00 → 日をまたぐ
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

/** Mock: 実際の通知送信 (console.log) */
function sendMockNotification(method: NotificationMethod, ownerName: string, post: LivestreamPost): void {
  console.log(
    `[owner-notifier] ${method.toUpperCase()} → ${ownerName}: 新しい投稿「${post.title}」が届きました。`,
  );
}

// ── Notification queue (daily/weekly スタブ) ──────────────────────────────

const _notificationQueue: Array<{ method: NotificationMethod; ownerName: string; post: LivestreamPost }> = [];

/** 通知キューの内容を取得 (テスト用) */
export function _getNotificationQueue(): typeof _notificationQueue {
  return [..._notificationQueue];
}

/** 通知キューをリセット (テスト用) */
export function _clearNotificationQueue(): void {
  _notificationQueue.length = 0;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 施主への通知をディスパッチする。
 *
 * - quietHours 内: 全チャネルを skipped に追加
 * - digestFrequency='immediate': 全チャネルに即時送信 (mock)
 * - daily/weekly: キューにスタック
 */
export function dispatchNotifications(
  session: LivestreamSession,
  newPost: LivestreamPost,
  now = new Date(),
): DispatchResult {
  const { notificationPrefs } = session;
  const dispatched: string[] = [];
  const skipped: string[] = [];

  const quiet = isInQuietHours(notificationPrefs.quietHours, now);

  for (const method of notificationPrefs.channels) {
    if (quiet) {
      skipped.push(method);
      continue;
    }

    if (notificationPrefs.digestFrequency === "immediate") {
      sendMockNotification(method, notificationPrefs.ownerName, newPost);
      dispatched.push(method);
    } else {
      // daily / weekly → キューにスタック
      _notificationQueue.push({ method, ownerName: notificationPrefs.ownerName, post: newPost });
      skipped.push(`${method}(queued)`);
    }
  }

  return { dispatched, skipped };
}
