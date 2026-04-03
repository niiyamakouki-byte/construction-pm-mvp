import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { Project, Task, TaskStatus } from "../domain/types.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import { navigate } from "../hooks/useHashRouter.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";

// ── Helpers ──────────────────────────────────────────

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${Number(m)}/${Number(d)}`;
}

const statusColor: Record<TaskStatus, string> = {
  todo: "#94a3b8",
  in_progress: "#2563eb",
  done: "#10b981",
};

const statusLabel: Record<TaskStatus, string> = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了",
};

type GanttTask = Task & {
  projectName: string;
  startDate: string;
  endDate: string;
  /** True if task had no dueDate and dates were auto-assigned */
  isDateEstimated: boolean;
};

/** Cap the total chart days to prevent browser meltdown with extreme date ranges */
const MAX_CHART_DAYS = 365;

// ── Component ────────────────────────────────────────

export function GanttPage() {
  const { organizationId } = useOrganizationContext();
  const projectRepository = useMemo(
    () => createProjectRepository(() => organizationId),
    [organizationId],
  );
  const taskRepository = useMemo(
    () => createTaskRepository(() => organizationId),
    [organizationId],
  );
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => toLocalDateString(new Date()), []);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [allTasks, allProjects] = await Promise.all([
        taskRepository.findAll(),
        projectRepository.findAll(),
      ]);

      const projectMap = new Map<string, Project>();
      for (const p of allProjects) projectMap.set(p.id, p);

      // Build gantt tasks - assign start/end dates based on project start + due date
      const tasks: GanttTask[] = allTasks.map((t) => {
        const project = projectMap.get(t.projectId);
        const projectStart = project?.startDate ?? today;
        const isDateEstimated = !t.dueDate;
        const startDate = t.dueDate ? addDays(t.dueDate, -7) : projectStart;
        const endDate = t.dueDate ?? addDays(startDate, 7);

        return {
          ...t,
          projectName: project?.name ?? "不明",
          startDate: startDate < projectStart ? projectStart : startDate,
          endDate,
          isDateEstimated,
        };
      });

      // Sort by start date
      tasks.sort((a, b) => a.startDate.localeCompare(b.startDate));
      setGanttTasks(tasks);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "データの読み込みに失敗しました",
      );
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Scroll to today on mount
  useEffect(() => {
    if (!loading && scrollRef.current) {
      const todayMarker = scrollRef.current.querySelector("[data-today]");
      if (todayMarker) {
        todayMarker.scrollIntoView({ inline: "center", behavior: "smooth" });
      }
    }
  }, [loading]);

  // Memoize chart layout calculations (matters for 100+ tasks)
  const chartLayout = useMemo(() => {
    if (ganttTasks.length === 0) return null;

    const allDates = ganttTasks.flatMap((t) => [t.startDate, t.endDate]);
    allDates.push(today);
    const minDate = allDates.reduce((a, b) => (a < b ? a : b));
    const maxDate = allDates.reduce((a, b) => (a > b ? a : b));
    const chartStart = addDays(minDate, -3);
    const chartEnd = addDays(maxDate, 7);
    const rawTotalDays = daysBetween(chartStart, chartEnd);
    const totalDays = Math.min(rawTotalDays, MAX_CHART_DAYS);
    const isCapped = rawTotalDays > MAX_CHART_DAYS;

    // Generate date columns
    const dates: string[] = [];
    for (let i = 0; i <= totalDays; i++) {
      dates.push(addDays(chartStart, i));
    }

    // Pre-compute weekend/today info for each date
    const dateInfo = dates.map((d) => {
      const dateObj = new Date(d);
      const day = dateObj.getDay();
      return {
        date: d,
        isToday: d === today,
        isWeekend: day === 0 || day === 6,
      };
    });

    // Pre-compute highlighted date columns (weekends + today) to avoid per-row iteration
    const highlightedDates = dateInfo.filter((di) => di.isToday || di.isWeekend);

    return {
      chartStart,
      chartEnd,
      totalDays,
      isCapped,
      dates,
      dateInfo,
      highlightedDates,
    };
  }, [ganttTasks, today]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16" role="status" aria-label="読み込み中">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        <span className="text-sm text-slate-400">読み込み中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center" role="alert">
        <div className="rounded-2xl border-2 border-dashed border-red-200 bg-white p-8">
          <h2 className="text-lg font-bold text-slate-900">読み込みエラー</h2>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <button
            onClick={() => { setLoading(true); void loadData(); }}
            className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  if (ganttTasks.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
            <span className="text-2xl" aria-hidden="true">📊</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">ガントチャート</h2>
          <p className="mt-2 text-sm text-slate-500">
            プロジェクトにタスクを追加すると、ここにガントチャートが表示されます。
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
          >
            プロジェクト一覧へ
          </button>
        </div>
      </div>
    );
  }

  if (!chartLayout) return null;

  const { chartStart, totalDays, isCapped, dateInfo, highlightedDates } = chartLayout;
  const dayWidth = 36;
  const rowHeight = 44;
  const headerHeight = 56;
  const labelWidth = 180;

  const estimatedCount = ganttTasks.filter((t) => t.isDateEstimated).length;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">ガントチャート</h2>
        <div className="flex gap-3 text-xs" role="list" aria-label="ステータス凡例">
          {(["todo", "in_progress", "done"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5" role="listitem">
              <span
                className="inline-block h-3 w-3 rounded"
                style={{ backgroundColor: statusColor[s] }}
                aria-hidden="true"
              />
              {statusLabel[s]}
            </span>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {isCapped && (
        <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-700" role="alert">
          日付範囲が広いため、最大{MAX_CHART_DAYS}日間に制限して表示しています。
        </div>
      )}
      {estimatedCount > 0 && (
        <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-blue-700" role="status">
          {estimatedCount}件のタスクに期限が未設定のため、推定日程で表示しています（破線バー）。
        </div>
      )}

      <div
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        role="figure"
        aria-label={`ガントチャート: ${ganttTasks.length}タスク`}
      >
        <div className="flex">
          {/* Left: Task labels */}
          <div
            className="shrink-0 border-r border-slate-200 bg-slate-50/80"
            style={{ width: labelWidth }}
          >
            <div
              className="flex items-end border-b border-slate-200 px-3 py-2"
              style={{ height: headerHeight }}
            >
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                タスク ({ganttTasks.length})
              </span>
            </div>
            {ganttTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center border-b border-slate-100 px-3"
                style={{ height: rowHeight }}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800">
                    {task.name}
                  </p>
                  <p className="truncate text-[10px] text-slate-400">
                    {task.projectName}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Chart area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-x-auto"
          >
            <div style={{ width: totalDays * dayWidth, minWidth: "100%" }}>
              {/* Date header */}
              <div
                className="flex border-b border-slate-200"
                style={{ height: headerHeight }}
              >
                {dateInfo.map((di) => (
                  <div
                    key={di.date}
                    data-today={di.isToday ? "true" : undefined}
                    className={`flex flex-col items-center justify-end border-r border-slate-100 pb-1 ${
                      di.isToday
                        ? "bg-brand-50"
                        : di.isWeekend
                          ? "bg-slate-50"
                          : ""
                    }`}
                    style={{ width: dayWidth }}
                  >
                    <span
                      className={`text-[10px] font-semibold tabular-nums ${
                        di.isToday
                          ? "text-brand-600"
                          : di.isWeekend
                            ? "text-slate-400"
                            : "text-slate-500"
                      }`}
                    >
                      {formatDateShort(di.date)}
                    </span>
                    {di.isToday && (
                      <span className="mt-0.5 text-[8px] font-bold text-brand-600 uppercase">
                        TODAY
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Task rows */}
              {ganttTasks.map((task) => {
                const startOffset = daysBetween(chartStart, task.startDate);
                const duration = Math.max(
                  1,
                  daysBetween(task.startDate, task.endDate),
                );
                const left = startOffset * dayWidth;
                const width = duration * dayWidth;

                return (
                  <div
                    key={task.id}
                    className="relative border-b border-slate-50"
                    style={{ height: rowHeight }}
                  >
                    {/* Grid lines (weekend/today shading) - use pre-computed highlights */}
                    {highlightedDates.map((di) => {
                      const offset = daysBetween(chartStart, di.date);
                      return (
                        <div
                          key={di.date}
                          className={`absolute top-0 h-full ${
                            di.isToday ? "bg-brand-50/50" : "bg-slate-50/50"
                          }`}
                          style={{ left: offset * dayWidth, width: dayWidth }}
                        />
                      );
                    })}

                    {/* Today marker line */}
                    {(() => {
                      const todayOffset = daysBetween(chartStart, today);
                      if (todayOffset >= 0 && todayOffset <= totalDays) {
                        return (
                          <div
                            className="absolute top-0 h-full w-px bg-brand-400 z-10"
                            style={{ left: todayOffset * dayWidth + dayWidth / 2 }}
                          />
                        );
                      }
                      return null;
                    })()}

                    {/* Bar */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`${task.name}: ${task.startDate} から ${task.endDate}${task.isDateEstimated ? " (推定)" : ""}`}
                      className="absolute rounded-md shadow-sm transition-all hover:shadow-md hover:brightness-110 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
                      style={{
                        left: left + 2,
                        top: 8,
                        width: Math.max(width - 4, 8),
                        height: rowHeight - 16,
                        backgroundColor: statusColor[task.status],
                        opacity: task.status === "done" ? 0.6 : 0.9,
                        // Dashed border for estimated dates
                        ...(task.isDateEstimated
                          ? {
                              border: "2px dashed rgba(255,255,255,0.5)",
                              boxSizing: "border-box" as const,
                            }
                          : {}),
                      }}
                      title={`${task.name}: ${task.startDate} 〜 ${task.endDate}${task.isDateEstimated ? " (推定)" : ""}`}
                      onClick={() =>
                        navigate(`/project/${task.projectId}`)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/project/${task.projectId}`);
                        }
                      }}
                    >
                      {width > 80 && (
                        <span className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold text-white truncate">
                          {task.name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
