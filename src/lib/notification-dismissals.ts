/**
 * 通知の既読・スヌーズ状態を localStorage に永続化する。
 * - read: 以後表示しない
 * - snooze: until(ISO日時) まで非表示。翌日5:00 JST で復帰させる
 *
 * バナーは buildNotifications() が毎回導出するため永続化はここだけで完結する。
 */

const STORAGE_KEY = "genbahub.notification.dismissals";

export type NotificationDismissal =
  | { type: "read" }
  | { type: "snooze"; until: string };

export type NotificationDismissalMap = Record<string, NotificationDismissal>;

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function isDismissal(value: unknown): value is NotificationDismissal {
  if (!value || typeof value !== "object") return false;
  const v = value as { type?: unknown; until?: unknown };
  if (v.type === "read") return true;
  if (v.type === "snooze" && typeof v.until === "string") return true;
  return false;
}

export function loadDismissals(): NotificationDismissalMap {
  const raw = safeGetItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const result: NotificationDismissalMap = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isDismissal(value)) result[id] = value;
    }
    return result;
  } catch {
    return {};
  }
}

export function saveDismissals(map: NotificationDismissalMap): void {
  safeSetItem(STORAGE_KEY, JSON.stringify(map));
}

/**
 * 通知の id が dismissal によって非表示になるべきか判定する。
 * snooze は until を過ぎたら自動的に再表示される。
 */
export function isDismissed(
  dismissal: NotificationDismissal | undefined,
  now: Date = new Date(),
): boolean {
  if (!dismissal) return false;
  if (dismissal.type === "read") return true;
  if (dismissal.type === "snooze") {
    return new Date(dismissal.until).getTime() > now.getTime();
  }
  return false;
}

/**
 * 翌日 05:00 JST の ISO 日時を返す。
 * 「明日の朝まで非表示」のスヌーズ期限として使う。
 */
export function getNextSnoozeUntil(now: Date = new Date()): string {
  // JST = UTC+9。JSTでの now を計算してから翌日5:00のUTCを組み立てる。
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
  const y = jstNow.getUTCFullYear();
  const m = jstNow.getUTCMonth();
  const d = jstNow.getUTCDate();
  // JST翌日 05:00 = UTC 当日 20:00
  const target = new Date(Date.UTC(y, m, d, 20, 0, 0, 0));
  if (target.getTime() <= now.getTime()) {
    // すでに過ぎていればさらに翌日へ
    return new Date(target.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }
  return target.toISOString();
}

/**
 * 現存する通知 id 集合に含まれないエントリを取り除く。
 * localStorage の肥大化を防ぐ。
 */
export function pruneDismissals(
  map: NotificationDismissalMap,
  liveIds: ReadonlySet<string>,
  now: Date = new Date(),
): NotificationDismissalMap {
  const result: NotificationDismissalMap = {};
  for (const [id, dismissal] of Object.entries(map)) {
    if (!liveIds.has(id)) continue;
    if (dismissal.type === "snooze" && new Date(dismissal.until).getTime() <= now.getTime()) {
      // 期限切れスヌーズも掃除
      continue;
    }
    result[id] = dismissal;
  }
  return result;
}
