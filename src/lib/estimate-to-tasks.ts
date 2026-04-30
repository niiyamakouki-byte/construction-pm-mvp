/**
 * EstimateToTasks — derive a project task list from confirmed estimate lines.
 * Sprint 3-7: Estimate → Schedule auto-expand.
 *
 * Pure logic, no I/O. Converts EstimateLine[] to ProjectTask[] using a
 * category-keyword → duration template table.
 */

import type { EstimateLine } from "../estimate/types.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TaskStatus = "todo" | "in_progress" | "done";

/** A derived task generated from an EstimateLine */
export type ProjectTask = {
  /** Stable id: `task-${lineCode}-${index}` */
  id: string;
  /** Human-readable task name */
  name: string;
  /** Code from the source EstimateLine */
  estimateLineCode: string;
  /** Estimated duration in working days */
  durationDays: number;
  /** ISO date string YYYY-MM-DD */
  startDate: string;
  /** ISO date string YYYY-MM-DD (inclusive) */
  endDate: string;
  /** Broad trade category */
  category: string;
  status: TaskStatus;
  /** Brief note from the estimate line */
  note: string;
};

/** Input to the generator */
export type EstimateToTasksInput = {
  lines: EstimateLine[];
  /** Project start date ISO string YYYY-MM-DD */
  projectStartDate: string;
  /** When true, weekends (Sat/Sun) are skipped when advancing dates */
  skipWeekends?: boolean;
};

export type EstimateToTasksResult = {
  tasks: ProjectTask[];
  /** Total calendar days from first task start to last task end */
  totalDays: number;
};

// ── Duration template ─────────────────────────────────────────────────────────

/**
 * Category keyword → estimated working days per task.
 * Tuned for typical interior renovation jobs.
 */
const DURATION_TEMPLATE: Array<{ keywords: string[]; days: number; category: string }> = [
  { keywords: ["解体", "撤去", "斫り"],                         days: 3,  category: "解体工事" },
  { keywords: ["躯体", "コンクリート", "型枠"],                  days: 5,  category: "躯体工事" },
  { keywords: ["防水", "シーリング", "コーキング"],              days: 2,  category: "防水工事" },
  { keywords: ["電気", "配線", "スイッチ", "コンセント", "照明"], days: 3,  category: "電気工事" },
  { keywords: ["給排水", "水道", "配管", "衛生"],                days: 3,  category: "設備工事" },
  { keywords: ["空調", "換気", "ダクト"],                        days: 2,  category: "空調工事" },
  { keywords: ["LGS", "軽鉄", "間仕切"],                        days: 4,  category: "内装下地" },
  { keywords: ["ボード", "石膏", "PB"],                          days: 3,  category: "内装下地" },
  { keywords: ["タイル", "テラコッタ"],                          days: 3,  category: "タイル工事" },
  { keywords: ["フローリング", "床材", "CF", "カーペット"],       days: 2,  category: "床工事" },
  { keywords: ["クロス", "壁紙", "クロス張"],                    days: 2,  category: "内装仕上" },
  { keywords: ["塗装", "AEP", "OP", "VP"],                       days: 3,  category: "塗装工事" },
  { keywords: ["建具", "ドア", "引き戸", "扉"],                  days: 2,  category: "建具工事" },
  { keywords: ["家具", "造作", "棚", "カウンター"],              days: 4,  category: "家具工事" },
  { keywords: ["サッシ", "窓", "アルミ"],                        days: 2,  category: "サッシ工事" },
  { keywords: ["足場", "養生"],                                  days: 1,  category: "仮設工事" },
  { keywords: ["清掃", "清掃工事"],                              days: 1,  category: "清掃工事" },
];

const DEFAULT_DURATION_DAYS = 2;
const DEFAULT_CATEGORY = "その他工事";

function matchTemplate(line: EstimateLine): { days: number; category: string } {
  const haystack = `${line.name} ${line.note}`.toLowerCase();
  for (const tmpl of DURATION_TEMPLATE) {
    if (tmpl.keywords.some((kw) => haystack.includes(kw.toLowerCase()))) {
      return { days: tmpl.days, category: tmpl.category };
    }
  }
  return { days: DEFAULT_DURATION_DAYS, category: DEFAULT_CATEGORY };
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Advance a date by N working days (skipping Sat=6, Sun=0 when skipWeekends).
 * The start date itself counts as day 1.
 */
function addWorkingDays(start: Date, days: number, skipWeekends: boolean): Date {
  if (!skipWeekends || days <= 1) {
    // +（days-1）calendar days
    const result = new Date(start);
    result.setDate(result.getDate() + Math.max(0, days - 1));
    return result;
  }
  let current = new Date(start);
  let remaining = days - 1; // start day already counted
  while (remaining > 0) {
    current.setDate(current.getDate() + 1);
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return current;
}

function nextWorkingDay(date: Date, skipWeekends: boolean): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  if (!skipWeekends) return next;
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Derive a sequential task list from confirmed estimate lines.
 *
 * Tasks are ordered as they appear in lines[]. Each task starts the day after
 * the previous one ends (sequential, no parallelism — simple enough for the
 * small interior jobs at Laporta).
 *
 * Lines with amount === 0 (e.g. note-only rows) are silently skipped.
 */
export function estimateToTasks(input: EstimateToTasksInput): EstimateToTasksResult {
  const { lines, projectStartDate, skipWeekends = false } = input;

  const tasks: ProjectTask[] = [];
  let cursor = parseDate(projectStartDate);

  // Skip weekends for cursor start
  if (skipWeekends) {
    while (cursor.getDay() === 0 || cursor.getDay() === 6) {
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const activeLines = lines.filter((l) => l.amount > 0);

  activeLines.forEach((line, idx) => {
    const { days, category } = matchTemplate(line);
    const start = new Date(cursor);
    const end = addWorkingDays(start, days, skipWeekends);

    tasks.push({
      id: `task-${line.code || idx}-${idx}`,
      name: line.name,
      estimateLineCode: line.code,
      durationDays: days,
      startDate: formatDate(start),
      endDate: formatDate(end),
      category,
      status: "todo",
      note: line.note,
    });

    // Next task starts the day after this one ends
    cursor = nextWorkingDay(end, skipWeekends);
  });

  const firstStart = tasks.length > 0 ? parseDate(tasks[0].startDate) : parseDate(projectStartDate);
  const lastEnd = tasks.length > 0 ? parseDate(tasks[tasks.length - 1].endDate) : parseDate(projectStartDate);
  const totalDays = Math.round((lastEnd.getTime() - firstStart.getTime()) / 86400000) + 1;

  return { tasks, totalDays };
}

/**
 * Group tasks by category for display (preserves insertion order).
 */
export function groupTasksByCategory(tasks: ProjectTask[]): Map<string, ProjectTask[]> {
  const map = new Map<string, ProjectTask[]>();
  for (const task of tasks) {
    const existing = map.get(task.category);
    if (existing) {
      existing.push(task);
    } else {
      map.set(task.category, [task]);
    }
  }
  return map;
}
