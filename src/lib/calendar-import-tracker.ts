/**
 * カレンダー予定→案件化の「案件化済み」ローカル印。
 * 設計判断(bd fyi0b): 予定→案件の連携は作成時の一回コピーのみ(この一覧での
 * ボタン出し分け用の端末ローカルな印であり、Projectエンティティ自体には
 * 予定IDを持たせない)。1案件に複数予定を後から紐づける機能・双方向同期は
 * 別票の将来対応とし、ここではYAGNIで作らない。
 */
const IMPORTED_KEY = "genbahub:calendar-imported-event-ids";

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  const storage = window.localStorage;
  if (!storage || typeof storage.getItem !== "function") return null;
  return storage;
}

export function readImportedEventIds(): Set<string> {
  const storage = getLocalStorage();
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(IMPORTED_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v) => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

export function markEventImported(eventId: string): void {
  const storage = getLocalStorage();
  if (!storage) return;
  const ids = readImportedEventIds();
  ids.add(eventId);
  storage.setItem(IMPORTED_KEY, JSON.stringify([...ids]));
}
