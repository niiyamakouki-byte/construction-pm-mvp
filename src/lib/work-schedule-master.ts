/**
 * work-schedule-master — 工程表3階層マスター公開API
 *
 * TASK_CATEGORIES (13大項目103エントリ) を利用しやすい形で露出する。
 * buildWBSTree / expandWBSToPhases は既存実装をそのまま使う。
 */

import { buildWBSTree } from "./work-breakdown/expansion.js";
import type { WBSCategory, WBSTask } from "./work-breakdown/types.js";

export type { WBSCategory, WBSTask };

/**
 * 大項目一覧を返す。
 */
export function getMasterCategories(): WBSCategory[] {
  return buildWBSTree();
}

/**
 * 指定大項目IDに属するタスク(小項目)一覧を返す。
 * 中項目が小項目を持たない場合は中項目自体を WBSTask として返す。
 */
export function getMasterEntries(categoryId: string): WBSTask[] {
  const tree = buildWBSTree();
  const category = tree.find((c) => c.id === categoryId);
  if (!category) return [];

  const entries: WBSTask[] = [];
  for (const group of category.groups) {
    if (group.tasks.length > 0) {
      entries.push(...group.tasks);
    } else {
      // 中項目に小項目がない → 中項目をエントリとして扱う
      entries.push({
        id: `wbs-entry-${group.id}`,
        groupId: group.id,
        categoryId: group.categoryId,
        name: group.name,
        defaultDays: group.defaultDays,
      });
    }
  }
  return entries;
}
