/**
 * gantt-master-preset — マスタープリセット選択履歴の永続化
 *
 * takeoff-session / last-project と同じ localStorage パターン。
 * No DOM / No React dependencies.
 */

const STORAGE_KEY = "genbahub:gantt-master-preset";

export type MasterPresetHistory = {
  /** 最後に選択した大項目ID */
  lastCategoryId: string | null;
};

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  const storage = window.localStorage;
  if (!storage) return null;
  if (typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    return null;
  }
  return storage;
}

export function readMasterPresetHistory(): MasterPresetHistory {
  try {
    const raw = getLocalStorage()?.getItem(STORAGE_KEY);
    if (!raw) return { lastCategoryId: null };
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return { lastCategoryId: null };
    const obj = parsed as Record<string, unknown>;
    return {
      lastCategoryId: typeof obj["lastCategoryId"] === "string" ? obj["lastCategoryId"] : null,
    };
  } catch {
    return { lastCategoryId: null };
  }
}

export function writeMasterPresetHistory(history: MasterPresetHistory): void {
  try {
    getLocalStorage()?.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // localStorage unavailable or quota exceeded — silent
  }
}
