import { statusColors, colors } from "../../theme/index.js";
import type { TaskStatus } from "../../domain/types.js";
import type { GanttTask } from "./types.js";

export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

/** Move a date by N calendar days, then skip forward past any weekends if includeWeekends=false */
export function addDaysSkipWeekends(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const dow = d.getDay();
  if (dow === 6) d.setDate(d.getDate() + 2);
  else if (dow === 0) d.setDate(d.getDate() + 1);
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
  return ["日", "月", "火", "水", "木", "金", "土"][new Date(dateStr).getDay()] ?? "";
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
