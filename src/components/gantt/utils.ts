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
