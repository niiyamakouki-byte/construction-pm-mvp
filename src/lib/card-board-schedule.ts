/**
 * card-board-schedule.ts
 * 工程カードビュー（第2弾）でカード同士を接続した直後の日程調整。
 *
 * カードの接続は常に FS（先行完了→後続開始）として保存される
 * （card-schedule-converter.ts の cardToTasks と同じ意味論）。
 * 接続の結果、後続タスクの開始日が先行タスクの終了日以前のままだと矛盾するため、
 * その場合だけ後続の開始日を先行の終了日翌日に押し出し、既存の cascade-scheduler で
 * さらに下流へ伝播させる。
 *
 * 日付が未設定のタスクや FS 以外の dependencyType は対象外（素通し・スコープ外）。
 */
import type { GanttTask } from "../components/gantt/types.js";
import { addDaysSkipWeekends, daysBetween } from "../components/gantt/utils.js";
import { cascadeSchedule } from "./cascade-scheduler.js";

export function computeConnectScheduleUpdates(
  ganttTasks: GanttTask[],
  predecessorId: string,
  successorId: string,
): Map<string, { startDate: string; endDate: string }> {
  const predecessor = ganttTasks.find((t) => t.id === predecessorId);
  const successor = ganttTasks.find((t) => t.id === successorId);
  if (!predecessor || !successor) return new Map();
  if ((successor.dependencyType ?? "FS") !== "FS") return new Map();
  if (successor.startDate > predecessor.endDate) return new Map(); // 既に矛盾なし

  const duration = daysBetween(successor.startDate, successor.endDate);
  const newStart = addDaysSkipWeekends(
    predecessor.endDate,
    1,
    successor.projectIncludesWeekends,
    successor.includeWeekends,
  );
  const newEnd = addDaysSkipWeekends(
    newStart,
    duration,
    successor.projectIncludesWeekends,
    successor.includeWeekends,
  );

  // cascadeSchedule は起点タスク自身は返さない（下流のみ）ため、後続分をこちらで追加する。
  const updates = cascadeSchedule(ganttTasks, successorId, newStart, newEnd);
  updates.set(successorId, { startDate: newStart, endDate: newEnd });
  return updates;
}
