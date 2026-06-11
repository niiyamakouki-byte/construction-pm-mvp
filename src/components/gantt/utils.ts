import { statusColors, colors } from "../../theme/index.js";
import type { TaskStatus } from "../../domain/types.js";
import { isHoliday } from "../../lib/japanese-holidays.js";
import type { GanttTask } from "./types.js";

export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

type GanttRowOrder = { sortIndex?: number; startDate: string; endDate: string };

/**
 * 工程表の行ソート順。両方に sortIndex があれば手動並び順を優先し、
 * それ以外は従来通り startDate → endDate の昇順で比較する。
 */
export function compareGanttRows(left: GanttRowOrder, right: GanttRowOrder): number {
  if (left.sortIndex !== undefined && right.sortIndex !== undefined) {
    return left.sortIndex - right.sortIndex;
  }
  const byStart = left.startDate.localeCompare(right.startDate);
  if (byStart !== 0) return byStart;
  return left.endDate.localeCompare(right.endDate);
}

/**
 * 表示順の taskId 配列に対し、指定タスクを上/下の隣と入れ替えた
 * sortIndex 採番を返す。現在の表示順で全行を 0..n に一括採番してから
 * 対象と隣を入れ替えるため、未定義との混在状態が生じない。
 * 端の行で移動できない場合は changed:false を返す。
 */
export function computeReorder(
  orderedIds: string[],
  taskId: string,
  direction: "up" | "down",
): { sortIndexById: Map<string, number>; changed: boolean } {
  const sortIndexById = new Map(orderedIds.map((id, index) => [id, index]));
  const index = orderedIds.indexOf(taskId);
  if (index < 0) return { sortIndexById, changed: false };
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= orderedIds.length) {
    return { sortIndexById, changed: false };
  }
  const neighborId = orderedIds[targetIndex];
  sortIndexById.set(taskId, targetIndex);
  sortIndexById.set(neighborId, index);
  return { sortIndexById, changed: true };
}

export function addDays(dateStr: string, days: number): string {
  const d = toDate(dateStr);
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
}

export function daysBetween(a: string, b: string): number {
  const da = toDate(a);
  const db = toDate(b);
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

function isWeekend(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

function isNonWorkingDay(date: Date): boolean {
  return isWeekend(date) || isHoliday(toLocalDateString(date));
}

export function resolveIncludeWeekends(
  projectIncludeWeekends: boolean,
  taskIncludeWeekends?: boolean,
): boolean {
  return taskIncludeWeekends ?? projectIncludeWeekends;
}

/** Move a date by N calendar days, then skip forward past weekends and holidays. */
export function addDaysSkipWeekends(
  dateStr: string,
  days: number,
  projectIncludeWeekends = false,
  taskIncludeWeekends?: boolean,
): string {
  const includeWeekends = resolveIncludeWeekends(projectIncludeWeekends, taskIncludeWeekends);
  if (includeWeekends) return addDays(dateStr, days);

  const d = toDate(dateStr);
  d.setDate(d.getDate() + days);

  while (isNonWorkingDay(d)) {
    d.setDate(d.getDate() + 1);
  }

  return toLocalDateString(d);
}

/** Move a date by N working days when weekends are excluded. */
export function addDaysBySchedule(
  dateStr: string,
  days: number,
  projectIncludeWeekends = false,
  taskIncludeWeekends?: boolean,
): string {
  const includeWeekends = resolveIncludeWeekends(projectIncludeWeekends, taskIncludeWeekends);
  if (includeWeekends) return addDays(dateStr, days);
  if (days === 0) return addDaysSkipWeekends(dateStr, 0, false);

  const d = toDate(dateStr);
  const direction = days > 0 ? 1 : -1;
  let remaining = Math.abs(days);

  while (remaining > 0) {
    d.setDate(d.getDate() + direction);
    if (!isNonWorkingDay(d)) remaining -= 1;
  }

  return toLocalDateString(d);
}

export function formatDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function formatMonthLabel(dateStr: string): string {
  const [year, month] = dateStr.split("-");
  return `${Number(year)}年${Number(month)}月`;
}

export function formatDayNumber(dateStr: string): string {
  return String(Number(dateStr.split("-")[2]));
}

export function formatWeekdayLabel(dateStr: string): string {
  return ["日", "月", "火", "水", "木", "金", "土"][toDate(dateStr).getDay()] ?? "";
}

export function formatScheduleDate(dateStr: string): string {
  if (!dateStr) return "未設定";
  const [year, month, day] = dateStr.split("-");
  return `${Number(year)}/${Number(month)}/${Number(day)}`;
}

export const statusColor: Record<TaskStatus, string> = statusColors;

export const statusLabel: Record<TaskStatus, string> = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了",
};

export function progressColor(progress: number): string {
  if (progress >= 100) return colors.success;
  if (progress >= 50) return colors.accent;
  if (progress > 0) return colors.warning;
  return "#94a3b8";
}

export function getAlertLevel(task: GanttTask, today: string): "overdue" | "urgent" | "soon" | null {
  if (task.status === "done") return null;
  const diff = daysBetween(today, task.endDate);
  if (diff < 0) return "overdue";
  if (diff === 0) return "urgent";
  if (diff <= 3) return "soon";
  return null;
}

/**
 * Returns true if adding the edge fromId → toId would introduce a cycle
 * in the dependency graph built from tasks.
 * Uses depth-first reachability: if toId can already reach fromId, adding
 * the reverse edge creates a cycle.
 */
export function hasCycle(
  tasks: Array<{ id: string; dependencies?: string[] }>,
  fromId: string,
  toId: string,
): boolean {
  // Build adjacency: predecessorId → successors
  const successors = new Map<string, string[]>();
  for (const t of tasks) {
    for (const dep of t.dependencies ?? []) {
      if (!successors.has(dep)) successors.set(dep, []);
      successors.get(dep)!.push(t.id);
    }
  }

  // DFS from toId to see if we can reach fromId
  const visited = new Set<string>();
  const stack = [toId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === fromId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of successors.get(current) ?? []) {
      stack.push(next);
    }
  }
  return false;
}
