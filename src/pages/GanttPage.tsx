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

const progressColor = (progress: number): string => {
  if (progress >= 100) return "#10b981";
  if (progress >= 50) return "#2563eb";
  if (progress > 0) return "#f59e0b";
  return "#94a3b8";
};

type GanttTask = Task & {
  projectName: string;
  startDate: string;
  endDate: string;
  /** True if task had no dueDate and dates were auto-assigned */
  isDateEstimated: boolean;
  /** True if task is a milestone (0-1 day duration) */
  isMilestone: boolean;
};

/** A group of tasks under a project/phase heading */
type PhaseGroup = {
  projectId: string;
  projectName: string;
  tasks: GanttTask[];
  collapsed: boolean;
};

/** Cap the total chart days to prevent browser meltdown with extreme date ranges */
const MAX_CHART_DAYS = 365;

/** Get initials from an assigneeId or fallback */
function getAssigneeInitial(assigneeId?: string): string | null {
  if (!assigneeId) return null;
  // Show first 1-2 chars as initials
  return assigneeId.slice(0, 2).toUpperCase();
}

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
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
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
        const clampedStart = startDate < projectStart ? projectStart : startDate;
        const duration = daysBetween(clampedStart, endDate);
        const isMilestone = duration <= 1;

        return {
          ...t,
          projectName: project?.name ?? "不明",
          startDate: clampedStart,
          endDate,
          isDateEstimated,
          isMilestone,
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

  // Build phase groups from tasks, grouped by project
  const phaseGroups = useMemo((): PhaseGroup[] => {
    const groupMap = new Map<string, GanttTask[]>();
    const projectNameMap = new Map<string, string>();
    for (const task of ganttTasks) {
      if (!groupMap.has(task.projectId)) {
        groupMap.set(task.projectId, []);
        projectNameMap.set(task.projectId, task.projectName);
      }
      groupMap.get(task.projectId)!.push(task);
    }
    const groups: PhaseGroup[] = [];
    for (const [projectId, tasks] of groupMap) {
      groups.push({
        projectId,
        projectName: projectNameMap.get(projectId) ?? "不明",
        tasks,
        collapsed: collapsedPhases.has(projectId),
      });
    }
    return groups;
  }, [ganttTasks, collapsedPhases]);

  // Flat list of visible rows for chart rendering
  const visibleRows = useMemo((): Array<{ type: "phase"; group: PhaseGroup } | { type: "task"; task: GanttTask }> => {
    const rows: Array<{ type: "phase"; group: PhaseGroup } | { type: "task"; task: GanttTask }> = [];
    for (const group of phaseGroups) {
      rows.push({ type: "phase", group });
      if (!group.collapsed) {
        for (const task of group.tasks) {
          rows.push({ type: "task", task });
        }
      }
    }
    return rows;
  }, [phaseGroups]);

  const togglePhase = useCallback((projectId: string) => {
    setCollapsedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

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

    // Today offset for the vertical line
    const todayOffset = daysBetween(chartStart, today);

    return {
      chartStart,
      chartEnd,
      totalDays,
      isCapped,
      dates,
      dateInfo,
      highlightedDates,
      todayOffset,
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

  // ── Empty state ──────────────────────────────────────
  if (ganttTasks.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-24">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">ガントチャート</h2>
        </div>

        {/* Empty Gantt chart skeleton with empty state overlay */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Skeleton header */}
          <div className="flex border-b border-slate-200">
            <div className="shrink-0 border-r border-slate-200 bg-slate-50/80 px-3 py-3" style={{ width: 240 }}>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">タスク</span>
            </div>
            <div className="flex-1 flex">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="flex-1 border-r border-slate-100 px-1 py-3 min-w-[36px]">
                  <div className="h-3 w-6 rounded bg-slate-100 mx-auto" />
                </div>
              ))}
            </div>
          </div>

          {/* Empty area with CTA */}
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
                <svg className="h-8 w-8 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-900">タスクがありません</h3>
              <p className="mt-1.5 text-sm text-slate-500">
                プロジェクトにタスクを追加すると、ガントチャートが表示されます。
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  onClick={() => navigate("/app")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 active:bg-brand-700"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  タスクを追加
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!chartLayout) return null;

  const { chartStart, totalDays, isCapped, dateInfo, highlightedDates, todayOffset } = chartLayout;
  const dayWidth = 36;
  const rowHeight = 44;
  const phaseRowHeight = 36;
  const headerHeight = 56;
  const labelWidth = 240;

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
          {/* Milestone legend */}
          <span className="flex items-center gap-1.5" role="listitem">
            <svg className="h-3 w-3" viewBox="0 0 12 12" aria-hidden="true">
              <polygon points="6,0 12,6 6,12 0,6" fill="#f59e0b" />
            </svg>
            マイルストーン
          </span>
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
          {/* Left: Task labels with assignee & progress */}
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
            {visibleRows.map((row) => {
              if (row.type === "phase") {
                const { group } = row;
                return (
                  <div
                    key={`phase-${group.projectId}`}
                    className="flex items-center border-b border-slate-200 bg-slate-100/80 px-2 cursor-pointer select-none hover:bg-slate-100"
                    style={{ height: phaseRowHeight }}
                    onClick={() => togglePhase(group.projectId)}
                  >
                    <svg
                      className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${group.collapsed ? "" : "rotate-90"}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                    <span className="ml-1.5 text-xs font-bold text-slate-700 truncate">
                      {group.projectName}
                    </span>
                    <span className="ml-auto text-[10px] text-slate-400 shrink-0">
                      {group.tasks.length}件
                    </span>
                  </div>
                );
              }

              const { task } = row;
              const initial = getAssigneeInitial(task.assigneeId);
              return (
                <div
                  key={task.id}
                  className="flex items-center border-b border-slate-100 px-3 gap-2"
                  style={{ height: rowHeight }}
                >
                  {/* Assignee avatar */}
                  {initial ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-600">
                      {initial}
                    </span>
                  ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-400">
                      --
                    </span>
                  )}
                  {/* Task name */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">
                      {task.isMilestone && (
                        <svg className="mr-1 inline h-2.5 w-2.5 -mt-0.5" viewBox="0 0 12 12" aria-hidden="true">
                          <polygon points="6,0 12,6 6,12 0,6" fill="#f59e0b" />
                        </svg>
                      )}
                      {task.name}
                    </p>
                    <p className="truncate text-[10px] text-slate-400">
                      {task.projectName}
                    </p>
                  </div>
                  {/* Progress % */}
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                    style={{
                      backgroundColor: `${progressColor(task.progress)}15`,
                      color: progressColor(task.progress),
                    }}
                  >
                    {task.progress}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Right: Chart area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-x-auto"
          >
            <div style={{ width: totalDays * dayWidth, minWidth: "100%" }} className="relative">
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
                        ? "bg-red-50"
                        : di.isWeekend
                          ? "bg-slate-50"
                          : ""
                    }`}
                    style={{ width: dayWidth }}
                  >
                    <span
                      className={`text-[10px] font-semibold tabular-nums ${
                        di.isToday
                          ? "text-red-600"
                          : di.isWeekend
                            ? "text-slate-400"
                            : "text-slate-500"
                      }`}
                    >
                      {formatDateShort(di.date)}
                    </span>
                    {di.isToday && (
                      <span className="mt-0.5 text-[8px] font-bold text-red-600 uppercase">
                        TODAY
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Today vertical red dashed line (full height) */}
              {todayOffset >= 0 && todayOffset <= totalDays && (
                <div
                  className="absolute z-20 pointer-events-none"
                  style={{
                    left: todayOffset * dayWidth + dayWidth / 2,
                    top: 0,
                    bottom: 0,
                    width: 0,
                    borderLeft: "2px dashed #ef4444",
                  }}
                />
              )}

              {/* Rows */}
              {visibleRows.map((row) => {
                if (row.type === "phase") {
                  const { group } = row;
                  return (
                    <div
                      key={`phase-chart-${group.projectId}`}
                      className="relative border-b border-slate-200 bg-slate-100/50"
                      style={{ height: phaseRowHeight }}
                    >
                      {/* Weekend/today shading for phase row */}
                      {highlightedDates.map((di) => {
                        const offset = daysBetween(chartStart, di.date);
                        return (
                          <div
                            key={di.date}
                            className={`absolute top-0 h-full ${
                              di.isToday ? "bg-red-50/30" : "bg-slate-50/50"
                            }`}
                            style={{ left: offset * dayWidth, width: dayWidth }}
                          />
                        );
                      })}
                    </div>
                  );
                }

                const { task } = row;
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
                            di.isToday ? "bg-red-50/30" : "bg-slate-50/50"
                          }`}
                          style={{ left: offset * dayWidth, width: dayWidth }}
                        />
                      );
                    })}

                    {/* Milestone diamond marker */}
                    {task.isMilestone ? (
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`マイルストーン: ${task.name}: ${task.startDate}${task.isDateEstimated ? " (推定)" : ""}`}
                        className="absolute cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
                        style={{
                          left: left + dayWidth / 2 - 10,
                          top: rowHeight / 2 - 10,
                          width: 20,
                          height: 20,
                        }}
                        title={`${task.name}: ${task.startDate}${task.isDateEstimated ? " (推定)" : ""}`}
                        onClick={() => navigate(`/project/${task.projectId}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/project/${task.projectId}`);
                          }
                        }}
                      >
                        <svg viewBox="0 0 20 20" className="h-5 w-5 drop-shadow-sm hover:drop-shadow-md transition-all">
                          <polygon
                            points="10,1 19,10 10,19 1,10"
                            fill="#f59e0b"
                            stroke="#d97706"
                            strokeWidth="1"
                          />
                          {task.progress >= 100 && (
                            <text x="10" y="13" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">
                              &#10003;
                            </text>
                          )}
                        </svg>
                      </div>
                    ) : (
                      /* Regular bar */
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`${task.name}: ${task.startDate} から ${task.endDate}${task.isDateEstimated ? " (推定)" : ""} (${task.progress}%)`}
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
                        title={`${task.name}: ${task.startDate} ~ ${task.endDate} (${task.progress}%)${task.isDateEstimated ? " (推定)" : ""}`}
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
                        {/* Progress fill inside the bar */}
                        {task.progress > 0 && task.progress < 100 && (
                          <div
                            className="absolute left-0 top-0 h-full rounded-md opacity-30"
                            style={{
                              width: `${task.progress}%`,
                              backgroundColor: "#ffffff",
                            }}
                          />
                        )}
                        {width > 80 && (
                          <span className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold text-white truncate z-10">
                            {task.name}
                            {width > 130 && (
                              <span className="ml-auto text-[9px] opacity-80 shrink-0">
                                {task.progress}%
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    )}
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
