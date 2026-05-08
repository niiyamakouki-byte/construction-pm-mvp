/**
 * WBS展開結果をガント表示用の行構造に変換するユーティリティ。
 * GanttChart は GanttTask[] を受け取るが、WBS文脈では
 * 大項目/中項目ヘッダ行を差し込みたいため独自の行型を定義する。
 */

import type { Task } from "../../domain/types.js";

/** ガント表示用 WBS 行の種別 */
export type WBSRowKind = "category" | "group" | "task";

/** ガント表示用 WBS 行 */
export type WBSGanttRow = {
  kind: WBSRowKind;
  /** 行の表示名 */
  label: string;
  /** 大項目名 */
  majorCategory: string;
  /** 中項目名 (category行では空文字) */
  middleCategory: string;
  /** task行の場合は対応 Task */
  task?: Omit<Task, "id" | "createdAt" | "updatedAt">;
  /** この行配下の task 数 (category/group 集計用) */
  taskCount: number;
  /** 開始日 (category/group は配下タスクの最早) */
  startDate: string;
  /** 終了日 (category/group は配下タスクの最遅) */
  endDate: string;
};

type TaskLike = Omit<Task, "id" | "createdAt" | "updatedAt">;

/** expandWBSToPhases の出力 → WBSGanttRow[] */
export function convertToWBSRows(tasks: TaskLike[]): WBSGanttRow[] {
  if (tasks.length === 0) return [];

  const rows: WBSGanttRow[] = [];

  // 大項目でグループ化
  const byCategory = new Map<string, Map<string, TaskLike[]>>();
  for (const task of tasks) {
    const major = task.majorCategory ?? "その他";
    const middle = task.middleCategory ?? "その他";
    if (!byCategory.has(major)) {
      byCategory.set(major, new Map());
    }
    const groupMap = byCategory.get(major)!;
    if (!groupMap.has(middle)) {
      groupMap.set(middle, []);
    }
    groupMap.get(middle)!.push(task);
  }

  for (const [major, groupMap] of byCategory) {
    const allTasksInCategory = [...groupMap.values()].flat();
    const categoryStart = earliestDate(allTasksInCategory.map((t) => t.startDate ?? ""));
    const categoryEnd = latestDate(allTasksInCategory.map((t) => t.dueDate ?? ""));

    rows.push({
      kind: "category",
      label: major,
      majorCategory: major,
      middleCategory: "",
      taskCount: allTasksInCategory.length,
      startDate: categoryStart,
      endDate: categoryEnd,
    });

    for (const [middle, groupTasks] of groupMap) {
      const groupStart = earliestDate(groupTasks.map((t) => t.startDate ?? ""));
      const groupEnd = latestDate(groupTasks.map((t) => t.dueDate ?? ""));

      rows.push({
        kind: "group",
        label: middle,
        majorCategory: major,
        middleCategory: middle,
        taskCount: groupTasks.length,
        startDate: groupStart,
        endDate: groupEnd,
      });

      for (const task of groupTasks) {
        rows.push({
          kind: "task",
          label: task.minorCategory ?? task.name,
          majorCategory: major,
          middleCategory: middle,
          task,
          taskCount: 1,
          startDate: task.startDate ?? "",
          endDate: task.dueDate ?? "",
        });
      }
    }
  }

  return rows;
}

function earliestDate(dates: string[]): string {
  const valid = dates.filter(Boolean).sort();
  return valid[0] ?? "";
}

function latestDate(dates: string[]): string {
  const valid = dates.filter(Boolean).sort();
  return valid[valid.length - 1] ?? "";
}
