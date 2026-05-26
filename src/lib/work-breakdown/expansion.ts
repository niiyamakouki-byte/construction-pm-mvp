/**
 * WBS マスターから Phase[] を生成する変換レイヤー
 * TASK_CATEGORIES (大項目/中項目/小項目) → Task[] (projectId付き)
 */

import type { Task } from "../../domain/types.js";
import { TASK_CATEGORIES } from "../task-categories.js";
import type { WBSCategory, WBSExpansionOptions, WBSGroup, WBSTask } from "./types.js";

const CATEGORY_DEFAULT_DAYS = 14;
const GROUP_DEFAULT_DAYS = 7;
const TASK_DEFAULT_DAYS = 3;

/** TASK_CATEGORIES フラットリストを3階層ツリーに変換 */
export function buildWBSTree(): WBSCategory[] {
  const categoryMap = new Map<string, WBSCategory>();

  for (const cat of TASK_CATEGORIES) {
    if (!categoryMap.has(cat.major)) {
      categoryMap.set(cat.major, {
        id: `wbs-cat-${cat.major}`,
        name: cat.major,
        defaultDays: CATEGORY_DEFAULT_DAYS,
        groups: [],
      });
    }
    const category = categoryMap.get(cat.major)!;

    const groupId = `wbs-grp-${cat.major}-${cat.middle}`;
    let group = category.groups.find((g) => g.id === groupId);
    if (!group) {
      group = {
        id: groupId,
        categoryId: category.id,
        name: cat.middle,
        defaultDays: GROUP_DEFAULT_DAYS,
        tasks: [],
      };
      category.groups.push(group);
    }

    if (cat.minor) {
      const task: WBSTask = {
        id: `wbs-task-${cat.id}`,
        groupId: group.id,
        categoryId: category.id,
        name: cat.minor,
        defaultDays: TASK_DEFAULT_DAYS,
        costMasterCode: cat.costMasterCode,
      };
      group.tasks.push(task);
    }
  }

  return [...categoryMap.values()];
}

/**
 * 日付文字列に日数を加算して返す。
 * 平日のみの場合は土日をスキップ。
 */
function addDaysToDate(dateStr: string, days: number, includeWeekends = true): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  if (includeWeekends) {
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  let remaining = days;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }
  return date.toISOString().slice(0, 10);
}

/**
 * WBS マスターから指定プロジェクト向けの Task[] を生成する。
 * 大項目を順に並べ、各大項目内で中項目→小項目と続く。
 * 期間は前タスク終了日に依存する単純シーケンシャル配置。
 */
export function expandWBSToPhases(options: WBSExpansionOptions): Omit<Task, "id" | "createdAt" | "updatedAt">[] {
  const { projectId, projectStartDate, selectedMajors, includeWeekends = true } = options;
  const tree = buildWBSTree();
  const now = new Date().toISOString();

  const result: Omit<Task, "id" | "createdAt" | "updatedAt">[] = [];
  let cursor = projectStartDate;

  for (const category of tree) {
    if (selectedMajors && !selectedMajors.has(category.name)) continue;

    const categoryStart = cursor;

    for (const group of category.groups) {
      const groupStart = cursor;

      if (group.tasks.length > 0) {
        // 小項目ごとにタスクを生成
        for (const wbsTask of group.tasks) {
          const taskStart = cursor;
          const taskEnd = addDaysToDate(taskStart, wbsTask.defaultDays - 1, includeWeekends);
          result.push({
            projectId,
            name: `${wbsTask.name}`,
            description: `${category.name} / ${group.name}`,
            status: "todo",
            startDate: taskStart,
            dueDate: taskEnd,
            progress: 0,
            dependencies: [],
            majorCategory: category.name,
            middleCategory: group.name,
            minorCategory: wbsTask.name,
            includeWeekends,
            // source フィールドは Task スキーマに存在しないため majorCategory に識別子を埋め込まない
            // 代わりに description で識別可能にする
          });
          cursor = addDaysToDate(taskEnd, 1, includeWeekends);
        }
      } else {
        // 小項目なし → 中項目をそのままタスクに
        const taskEnd = addDaysToDate(groupStart, group.defaultDays - 1, includeWeekends);
        result.push({
          projectId,
          name: group.name,
          description: `${category.name}`,
          status: "todo",
          startDate: groupStart,
          dueDate: taskEnd,
          progress: 0,
          dependencies: [],
          majorCategory: category.name,
          middleCategory: group.name,
          includeWeekends,
        });
        cursor = addDaysToDate(taskEnd, 1, includeWeekends);
      }

      void groupStart; // suppress unused var warning
    }

    void categoryStart; // suppress unused var warning
  }

  void now; // suppress unused var warning
  return result;
}
