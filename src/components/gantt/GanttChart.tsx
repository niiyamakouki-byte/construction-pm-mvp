import type { CSSProperties, MouseEvent, MutableRefObject, RefObject } from "react";
import type { GanttTask, PhaseGroup, DragState, ConnectState, ChartLayout } from "./types.js";
import { gantt } from "../../theme/index.js";
import { daysBetween, formatDateShort } from "./utils.js";
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
  const chartShellStyle = {
    "--gantt-label-width": `${labelWidth}px`,
  } as CSSProperties;

  // Build dependency lines
  const taskRowIndexMap = new Map<string, number>();
  let rowIdx = 0;
  for (const row of visibleRows) {
    if (row.type === "task") {
      taskRowIndexMap.set(row.task.id, rowIdx);
    }
    rowIdx++;
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
      const fromTask = ganttTasks.find((t) => t.id === depId);
      if (!fromTask) continue;
      const fromRowIdx = taskRowIndexMap.get(depId);
      if (fromRowIdx === undefined) continue;

      const fromEndOffset = daysBetween(chartStart, fromTask.endDate);
      const toStartOffset = daysBetween(chartStart, task.startDate);

      const x1 = fromEndOffset * dayWidth + dayWidth / 2;
      const y1 = headerHeight + fromRowIdx * rowHeight + rowHeight / 2;
      const x2 = toStartOffset * dayWidth;
      const y2 = headerHeight + toRowIdx * rowHeight + rowHeight / 2;

      dependencyLines.push({ fromTaskId: depId, toTaskId: task.id, x1, y1, x2, y2 });
    }
  }

  return (
    <div
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      role="figure"
      aria-label={`ガントチャート: ${ganttTasks.length}タスク`}
      style={chartShellStyle}
    >
      <div className="flex">
        {/* Left: Task labels */}
        <div
          className="gantt-label-column shrink-0 border-r border-slate-200 bg-slate-50/80"
        >
          <div
            className="flex items-end border-b border-slate-200 px-3 py-2"
            style={{ height: headerHeight }}
          >
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              タスク ({ganttTasks.length})
            </span>
          </div>
          {visibleRows.map((row) => {
            if (row.type === "phase") {
              const { group } = row;
              return (
                <div
                  key={`phase-${group.projectId}`}
                  className="flex items-center border-b border-slate-200 bg-slate-100/80 px-2 select-none hover:bg-slate-100"
                  style={{ height: phaseRowHeight }}
                >
                  <button
                    className="flex flex-1 min-w-0 items-center gap-0 cursor-pointer"
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
                    <span className="ml-1.5 text-sm font-bold text-slate-700 truncate">
                      {group.projectName}
                    </span>
                    <span className="ml-1 text-xs text-slate-400 shrink-0">
                      {group.tasks.length}件
                    </span>
                  </button>
                  <button
                    className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-brand-100 hover:text-brand-600 transition-colors"
                    onClick={(e) => { e.stopPropagation(); onOpenQuickAdd(group.projectId, group.projectName); }}
                    aria-label={`${group.projectName}にタスクを追加`}
                    title="タスクを追加"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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

        {/* Right: Chart area */}
        <div ref={scrollRef} className="mobile-scroll-x flex-1 overflow-x-auto">
          <div style={{ width: totalDays * dayWidth, minWidth: "100%" }} className="relative">
            {/* Date header */}
            <div className="flex border-b border-slate-200 relative" style={{ height: headerHeight }}>
              {dateInfo.map((di) => {
                const dayNum = di.date.split("-")[2];
                const isFirstOfMonth = dayNum === "01";
                const monthLabel = isFirstOfMonth
                  ? `${Number(di.date.split("-")[1])}月`
                  : null;
                return (
                  <div
                    key={di.date}
                    data-today={di.isToday ? "true" : undefined}
                    className={`relative flex flex-col items-center justify-end border-r border-slate-100 pb-1 ${
                      di.isToday ? "bg-red-50" : di.isWeekend ? "bg-slate-50" : ""
                    }`}
                    style={{ width: dayWidth }}
                  >
                    {monthLabel && (
                      <span className="absolute top-1 left-1 text-[10px] font-bold text-brand-600 whitespace-nowrap z-10 pointer-events-none">
                        {monthLabel}
                      </span>
                    )}
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        di.isToday ? "text-red-600" : di.isWeekend ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {formatDateShort(di.date)}
                    </span>
                    {di.isToday && (
                      <span className="mt-0.5 text-[8px] font-bold text-red-600 uppercase">TODAY</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Today vertical red dashed line */}
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

            {/* SVG dependency lines overlay */}
            <DependencyLines
              lines={dependencyLines}
              totalDays={totalDays}
              dayWidth={dayWidth}
            />

            {/* Rows */}
            {visibleRows.map((row, _rowIndex) => {
              if (row.type === "phase") {
                const { group } = row;
                return (
                  <div
                    key={`phase-chart-${group.projectId}`}
                    className="relative border-b border-slate-200 bg-slate-100/50"
                    style={{ height: phaseRowHeight }}
                  >
                    {highlightedDates.map((di) => {
                      const offset = daysBetween(chartStart, di.date);
                      return (
                        <div
                          key={di.date}
                          className={`absolute top-0 h-full ${di.isToday ? "bg-red-50/30" : "bg-slate-50/50"}`}
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
