/**
 * Action suggester — returns a Japanese improvement action string
 * based on alert level and cause tags.
 */

import type { MarginAlertLevel } from "./types.js";

/**
 * Suggest an improvement action in Japanese.
 *
 * Priority matrix:
 *   critical + 原価増     → 緊急: 原価精査会議。発注先見直し+追加見積交渉
 *   critical + 受注額減   → 緊急: 追加変更工事の見積化を即実施
 *   critical (other)      → 緊急: 原価精査会議。発注先見直し+追加見積交渉
 *   warning               → 週次レビュー対象。粗利改善案を3つ用意
 *   caution               → 監視継続。次回更新時に再判定
 *   safe                  → 問題なし
 */
export function suggestAction_ja(
  level: MarginAlertLevel,
  causes: string[],
): string {
  if (level === "critical") {
    if (causes.includes("受注額減")) {
      return "緊急: 追加変更工事の見積化を即実施";
    }
    return "緊急: 原価精査会議。発注先見直し+追加見積交渉";
  }

  if (level === "warning") {
    return "週次レビュー対象。粗利改善案を3つ用意";
  }

  if (level === "caution") {
    return "監視継続。次回更新時に再判定";
  }

  return "問題なし";
}
