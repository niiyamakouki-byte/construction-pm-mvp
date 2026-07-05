/**
 * gantt-phase-grouping — COMPASS基準 P1: フェーズグルーピング表示
 *
 * ガント左ペインでタスクを工種 (majorCategory) 束にまとめ、フェーズ進捗ロールアップ・
 * 期間サマリー・折りたたみ状態を扱うためのピュアなユーティリティ群。
 * GanttPage / GanttChart から表示ロジックを切り出し、単体テストで検証できるようにする。
 */
import type { GanttTask } from "../components/gantt/types.js";
import { effectiveProgress } from "../components/gantt/utils.js";

export type PhaseGroupRow = {
  projectId: string;
  /** 工種/フェーズ名。折りたたみキーであり左ペインの見出しでもある */
  phaseName: string;
  projectName: string;
  tasks: GanttTask[];
  collapsed: boolean;
};

export type GanttVisibleRow =
  | { type: "phase"; group: PhaseGroupRow }
  | { type: "task"; task: GanttTask };

const COLLAPSED_KEY_PREFIX = "genbahub:collapsed-phases:";
export const PHASE_FALLBACK_NAME = "その他";

/**
 * タスクを majorCategory ごとにグループ化する。
 * majorCategory 未設定は PHASE_FALLBACK_NAME に集約。
 * Map の挿入順を保つので、入力順が UI 表示順になる。
 */
export function groupTasksByPhase(tasks: readonly GanttTask[]): Map<string, GanttTask[]> {
  const groups = new Map<string, GanttTask[]>();
  for (const task of tasks) {
    const key = normalizePhaseKey(task.majorCategory);
    const bucket = groups.get(key);
    if (bucket) bucket.push(task);
    else groups.set(key, [task]);
  }
  return groups;
}

/**
 * フェーズ配下タスクの日数加重進捗 (0-100 の整数)。
 * duration 0 のタスクも最低 1 日として重みを持つ。
 */
export function computePhaseProgress(tasks: readonly GanttTask[]): number {
  if (tasks.length === 0) return 0;
  let totalDays = 0;
  let weighted = 0;
  for (const task of tasks) {
    const days = taskDurationDays(task);
    totalDays += days;
    weighted += clampProgress(effectiveProgress(task)) * days;
  }
  if (totalDays === 0) return 0;
  return Math.round(weighted / totalDays);
}

/** groups から phaseName → progress の Map を一括生成 */
export function computePhaseProgressMap(groups: Map<string, GanttTask[]>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [key, tasks] of groups) {
    out.set(key, computePhaseProgress(tasks));
  }
  return out;
}

/**
 * フェーズ期間 (min startDate / max endDate) を返す。空グループは null。
 */
export function computePhaseSpan(tasks: readonly GanttTask[]): { start: string; end: string } | null {
  if (tasks.length === 0) return null;
  let minStart = tasks[0].startDate;
  let maxEnd = tasks[0].endDate;
  for (const task of tasks) {
    if (task.startDate && task.startDate < minStart) minStart = task.startDate;
    if (task.endDate && task.endDate > maxEnd) maxEnd = task.endDate;
  }
  return { start: minStart, end: maxEnd };
}

/**
 * 左ペインの表示行列（フェーズヘッダ + タスク）を組み立てる。
 * groups が空のときは fallbackTasks をそのまま並べる（フィルタ結果 0 件時の互換）。
 */
export function buildGanttVisibleRows(
  groups: Map<string, GanttTask[]>,
  collapsed: ReadonlySet<string>,
  ctx: { projectId: string; projectName: string; fallbackTasks: readonly GanttTask[] },
): GanttVisibleRow[] {
  if (groups.size === 0) {
    return ctx.fallbackTasks.map((task) => ({ type: "task", task }));
  }
  const rows: GanttVisibleRow[] = [];
  for (const [phaseName, tasks] of groups) {
    const isCollapsed = collapsed.has(phaseName);
    rows.push({
      type: "phase",
      group: {
        projectId: ctx.projectId,
        phaseName,
        projectName: ctx.projectName,
        tasks,
        collapsed: isCollapsed,
      },
    });
    if (!isCollapsed) {
      for (const task of tasks) {
        rows.push({ type: "task", task });
      }
    }
  }
  return rows;
}

/** LocalStorage キー。projectId ごとに独立管理する */
export function collapsedPhasesStorageKey(projectId: string): string {
  return `${COLLAPSED_KEY_PREFIX}${projectId}`;
}

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem" | "removeItem">;

/**
 * LocalStorage から折りたたみ状態を復元。読めない/パースできない/型が違う場合は空集合。
 */
export function readCollapsedPhases(
  projectId: string,
  storage: ReadableStorage | null = safeStorage(),
): Set<string> {
  if (!projectId || !storage) return new Set();
  try {
    const raw = storage.getItem(collapsedPhasesStorageKey(projectId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set();
  }
}

/**
 * LocalStorage に折りたたみ状態を保存。空集合はキーごと削除して噪音を減らす。
 */
export function writeCollapsedPhases(
  projectId: string,
  collapsed: ReadonlySet<string>,
  storage: WritableStorage | null = safeStorage(),
): void {
  if (!projectId || !storage) return;
  const key = collapsedPhasesStorageKey(projectId);
  try {
    if (collapsed.size === 0) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, JSON.stringify(Array.from(collapsed)));
    }
  } catch {
    // Safari プライベート等で setItem が投げるケースは無視
  }
}

function normalizePhaseKey(value: string | null | undefined): string {
  if (typeof value !== "string") return PHASE_FALLBACK_NAME;
  const trimmed = value.trim();
  return trimmed.length === 0 ? PHASE_FALLBACK_NAME : trimmed;
}

function taskDurationDays(task: GanttTask): number {
  if (!task.startDate || !task.endDate) return 1;
  const start = Date.parse(`${task.startDate}T00:00:00Z`);
  const end = Date.parse(`${task.endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 1;
  const days = Math.round((end - start) / 86400000) + 1;
  return Math.max(1, days);
}

function clampProgress(progress: number | null | undefined): number {
  if (typeof progress !== "number" || Number.isNaN(progress)) return 0;
  if (progress < 0) return 0;
  if (progress > 100) return 100;
  return progress;
}

function safeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}
