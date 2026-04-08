import type { CSSProperties, MouseEvent, MutableRefObject, RefObject } from "react";
import type { GanttTask, PhaseGroup, DragState, ConnectState, ChartLayout } from "./types.js";
import { gantt } from "../../theme/index.js";
import { daysBetween, formatDayNumber, formatMonthLabel, formatWeekdayLabel } from "./utils.js";
import { GanttTaskBar, GanttTaskLabel } from "./GanttTaskBar.js";
import { DependencyLines } from "./DependencyLines.js";

type VisibleRow =
  | { type: "phase"; group: PhaseGroup }
  | { type: "task"; task: GanttTask };

type Props = {
  ganttTasks: GanttTask[];
  visibleRows: VisibleRow[];
  chartLayout: ChartLayout;
  dragState: DragState | null;
  dragRef: MutableRefObject<DragState | null>;
  connectMode: boolean;
  connectState: ConnectState | null;
  today: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  onTaskDragStart: (task: GanttTask, event: MouseEvent<HTMLDivElement>) => void;
  onTaskResizeStart: (task: GanttTask, event: MouseEvent<HTMLDivElement>) => void;
  onOpenTaskDetail: (task: GanttTask) => void;
  onOpenQuickAdd: (projectId: string, projectName: string) => void;
  onTogglePhase: (projectId: string) => void;
  onSetConnectState: (state: ConnectState | null) => void;
  onConnectTask: (toTaskId: string) => void;
};

export function GanttChart({
  ganttTasks,
  visibleRows,
  chartLayout,
  dragState,
  dragRef,
  connectMode,
  connectState,
  today,
  scrollRef,
  onTaskDragStart,
  onTaskResizeStart,
  onOpenTaskDetail,
  onOpenQuickAdd,
  onTogglePhase,
  onSetConnectState,
  onConnectTask,
}: Props) {
  const { rowHeight, phaseRowHeight, headerHeight, labelWidth } = gantt;
  const { chartStart, totalDays, dateInfo, highlightedDates, todayOffset, dayWidth } = chartLayout;
  const monthRowHeight = 28;
  const dayRowHeight = headerHeight - monthRowHeight;
  const chartShellStyle = { "--gantt-label-width": `${labelWidth}px` } as CSSProperties;

  const monthSegments: Array<{ key: string; label: string; start: number; span: number }> = [];
  for (let index = 0; index < dateInfo.length; index += 1) {
    const item = dateInfo[index];
    const key = item.date.slice(0, 7);
    const current = monthSegments[monthSegments.length - 1];
    if (!current || current.key !== key) {
      monthSegments.push({ key, label: formatMonthLabel(item.date), start: index, span: 1 });
    } else {
      current.span += 1;
    }
  }

  const taskRowIndexMap = new Map<string, number>();
  let rowIndex = 0;
  for (const row of visibleRows) {
    if (row.type === "task") taskRowIndexMap.set(row.task.id, rowIndex);
    rowIndex += 1;
  }

  const dependencyLines: Array<{
    fromTaskId: string;
    toTaskId: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }> = [];

  for (const task of ganttTasks) {
    if (!task.dependencies || task.dependencies.length === 0) continue;
    const toRowIdx = taskRowIndexMap.get(task.id);
    if (toRowIdx === undefined) continue;
    for (const depId of task.dependencies) {
      const fromTask = ganttTasks.find((candidate) => candidate.id === depId);
      if (!fromTask) continue;
      const fromRowIdx = taskRowIndexMap.get(depId);
      if (fromRowIdx === undefined) continue;
      const fromEndOffset = daysBetween(chartStart, fromTask.endDate);
      const toStartOffset = daysBetween(chartStart, task.startDate);
      dependencyLines.push({
        fromTaskId: depId,
        toTaskId: task.id,
        x1: fromEndOffset * dayWidth + dayWidth / 2,
        y1: headerHeight + fromRowIdx * rowHeight + rowHeight / 2,
        x2: toStartOffset * dayWidth,
        y2: headerHeight + toRowIdx * rowHeight + rowHeight / 2,
      });
    }
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
      role="figure"
      aria-label={`ガントチャート: ${ganttTasks.length}タスク`}
      style={chartShellStyle}
    >
      <div className="flex">
        <div className="gantt-label-column shrink-0 border-r border-slate-200 bg-slate-50/70">
          <div className="border-b border-slate-200 px-4 py-3" style={{ height: headerHeight }}>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">工程一覧</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">タスク名</p>
                <p className="text-xs text-slate-500">全 {ganttTasks.length} 件</p>
              </div>
              <div className="text-right text-[11px] text-slate-500">
                <div>左: 工程名</div>
                <div>右: 日程バー</div>
              </div>
            </div>
          </div>

          {visibleRows.map((row) => {
            if (row.type === "phase") {
              const { group } = row;
              return (
                <div
                  key={`phase-${group.projectId}`}
                  className="flex items-center border-b border-slate-200 bg-slate-100/70 px-3 select-none"
                  style={{ height: phaseRowHeight }}
                >
                  <button
                    className="flex min-w-0 flex-1 items-center gap-2"
                    onClick={() => onTogglePhase(group.projectId)}
                    aria-label={`${group.projectName}を${group.collapsed ? "展開" : "折りたたむ"}`}
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
                    <span className="truncate text-sm font-semibold text-slate-700">{group.projectName}</span>
                    <span className="shrink-0 text-xs text-slate-400">{group.tasks.length}件</span>
                  </button>
                  <button
                    className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-brand-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenQuickAdd(group.projectId, group.projectName);
                    }}
                    aria-label={`${group.projectName}にタスクを追加`}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </button>
                </div>
              );
            }

            return (
              <GanttTaskLabel
                key={row.task.id}
                task={row.task}
                today={today}
                connectMode={connectMode}
                onOpenTaskDetail={onOpenTaskDetail}
              />
            );
          })}
        </div>

        <div ref={scrollRef} className="mobile-scroll-x flex-1 overflow-x-auto">
          <div className="relative" style={{ width: totalDays * dayWidth, minWidth: "100%" }}>
            <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
              <div className="relative border-b border-slate-200" style={{ height: monthRowHeight }}>
                {monthSegments.map((segment) => (
                  <div
                    key={segment.key}
                    className="absolute inset-y-0 flex items-center border-r border-slate-200 bg-slate-50/70 px-3"
                    style={{ left: segment.start * dayWidth, width: segment.span * dayWidth }}
                  >
                    <span className="text-xs font-semibold text-slate-600">{segment.label}</span>
                  </div>
                ))}
              </div>

              <div className="relative flex" style={{ height: dayRowHeight }}>
                {dateInfo.map((di) => {
                  const weekday = formatWeekdayLabel(di.date);
                  const isSunday = weekday === "日";
                  const isSaturday = weekday === "土";
                  return (
                    <div
                      key={di.date}
                      data-today={di.isToday ? "true" : undefined}
                      className={`relative flex flex-col items-center justify-center border-r border-slate-100 ${
                        di.isToday ? "bg-red-50" : di.isWeekend ? "bg-slate-50/70" : "bg-white"
                      }`}
                      style={{ width: dayWidth }}
                    >
                      <span className="text-[13px] font-semibold tabular-nums text-slate-700">{formatDayNumber(di.date)}</span>
                      <span className={`mt-0.5 text-[10px] ${isSunday ? "text-red-500" : isSaturday ? "text-blue-500" : "text-slate-400"}`}>
                        {weekday}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {todayOffset >= 0 && todayOffset <= totalDays && (
              <>
                <div
                  className="pointer-events-none absolute z-20"
                  style={{
                    left: todayOffset * dayWidth + dayWidth / 2,
                    top: 0,
                    bottom: 0,
                    width: 0,
                    borderLeft: "2px dashed #dc2626",
                  }}
                />
                <div
                  className="pointer-events-none absolute z-30 -translate-x-1/2 rounded-full bg-red-600 px-2 py-1 text-[11px] font-semibold text-white shadow-sm"
                  style={{ left: todayOffset * dayWidth + dayWidth / 2, top: 8 }}
                >
                  本日
                </div>
              </>
            )}

            <DependencyLines lines={dependencyLines} totalDays={totalDays} dayWidth={dayWidth} />

            {visibleRows.map((row) => {
              if (row.type === "phase") {
                const { group } = row;
                return (
                  <div key={`phase-chart-${group.projectId}`} className="relative border-b border-slate-200 bg-slate-100/40" style={{ height: phaseRowHeight }}>
                    {highlightedDates.map((di) => {
                      const offset = daysBetween(chartStart, di.date);
                      return (
                        <div
                          key={di.date}
                          className={`absolute top-0 h-full border-r border-slate-100/70 ${di.isToday ? "bg-red-50/35" : "bg-slate-50/55"}`}
                          style={{ left: offset * dayWidth, width: dayWidth }}
                        />
                      );
                    })}
                  </div>
                );
              }

              return (
                <GanttTaskBar
                  key={row.task.id}
                  task={row.task}
                  dragState={dragState}
                  dragRef={dragRef}
                  connectMode={connectMode}
                  connectState={connectState}
                  chartStart={chartStart}
                  highlightedDates={highlightedDates}
                  today={today}
                  dayWidth={dayWidth}
                  onTaskDragStart={onTaskDragStart}
                  onTaskResizeStart={onTaskResizeStart}
                  onOpenTaskDetail={onOpenTaskDetail}
                  onSetConnectState={onSetConnectState}
                  onConnectTask={onConnectTask}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
