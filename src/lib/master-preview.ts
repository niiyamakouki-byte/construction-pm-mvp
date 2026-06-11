/**
 * master-preview — マスター適用前プレビュー計算純関数
 *
 * 選択エントリID集合 × エントリ一覧 → { count, totalDays }
 * DOM/React 依存なし。
 */

import type { WBSTask } from "./work-breakdown/types.js";

export type MasterPreviewResult = {
  /** 選択された工程数 */
  count: number;
  /** 選択エントリの defaultDays 合計 */
  totalDays: number;
};

/**
 * 選択エントリIDセットからプレビュー集計を計算する。
 *
 * @param selectedIds - チェック済みエントリIDの集合
 * @param allEntries  - 大項目配下の全エントリ（getMasterEntries の戻り値）
 * @returns { count, totalDays } ゼロ選択時は両値とも 0
 */
export function calcMasterPreview(
  selectedIds: ReadonlySet<string>,
  allEntries: readonly WBSTask[],
): MasterPreviewResult {
  if (selectedIds.size === 0) {
    return { count: 0, totalDays: 0 };
  }

  let count = 0;
  let totalDays = 0;

  for (const entry of allEntries) {
    if (selectedIds.has(entry.id)) {
      count++;
      // defaultDays が正の整数でない場合は 0 扱い（欠損保護）
      const days = typeof entry.defaultDays === "number" && entry.defaultDays > 0
        ? entry.defaultDays
        : 0;
      totalDays += days;
    }
  }

  return { count, totalDays };
}
