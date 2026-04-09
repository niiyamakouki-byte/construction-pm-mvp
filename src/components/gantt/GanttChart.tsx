import type {
  CSSProperties,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  RefObject,
  TouchEvent as ReactTouchEvent,
} from "react";
import type { ChartLayout, ConnectState, DragState, GanttTask } from "./types.js";
import { gantt } from "../../theme/index.js";
import { formatDayNumber, formatMonthLabel, formatWeekdayLabel } from "./utils.js";
import { GanttTaskBar, GanttTaskLabel } from "./GanttTaskBar.js";
import { DependencyArrows } from "./DependencyArrows.js";

type VisibleRow =
  | { type: "phase"; group: { projectId: string; projectName: string; tasks: GanttTask[]; collapsed: boolean } }
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
  onTaskDragStart: (task: GanttTask, event: ReactPointerEvent<HTMLDivElement>) => void;
  onTaskResizeStart: (task: GanttTask, event: ReactPointerEvent<HTMLDivElement>) => void;
  onOpenTaskDetail: (task: GanttTask) => void;
  onOpenQuickAdd: (projectId: string, projectName: string) => void;
  onTogglePhase: (projectId: string) => void;
  onSetConnectState: (state: ConnectState | null) => void;
  onConnectTask: (toTaskId: string) => void;
  onTimelineTouchStart?: (event: ReactTouchEvent<HTMLDivElement>) => void;
  onTimelineTouchMove?: (event: ReactTouchEvent<HTMLDivElement>) => void;
  onTimelineTouchEnd?: (event: ReactTouchEvent<HTMLDivElement>) => void;
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
  onTimelineTouchStart,
  onTimelineTouchMove,
  onTimelineTouchEnd,
}: Props) {
  const { phaseRowHeight, headerHeight, labelWidth } = gantt;
  const { chartStart, totalDays, dateInfo, highlightedDates, todayOffset, dayWidth } = chartLayout;
  const monthRowHeight = 30;
  const dayRowHeight = headerHeight - monthRowHeight;
  const chartWidth = (totalDays + 1) * dayWidth;
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

  return (
    <div
      className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
      role="figure"
      aria-label={`ガントチャート: ${ganttTasks.length}タスク`}
      style={chartShellStyle}
    >
      <div className="flex min-h-[420px]">
        <div className="gantt-label-column shrink-0 border-r border-slate-200 bg-slate-50/80">
          <div className="border-b border-slate-200 px-3 py-3" style={{ height: headerHeight }}>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">工程</p>
            <div className="mt-2 grid gap-1 text-xs text-slate-500">
              <span>工程名</span>
              <span>協力会社</span>
              <span>進捗</span>
            </div>
          </div>

          {visibleRows.map((row) => {
            if (row.type === "phase") {
              return (
                <div
                  key={`phase-${row.group.projectId}`}
                  className="flex items-center border-b border-slate-200 bg-slate-100/80 px-3"
                  style={{ height: phaseRowHeight }}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left text-sm font-semibold text-slate-700"
                    onClick={() => onTogglePhase(row.group.projectId)}
                  >
                    {row.group.projectName}
                  </button>
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand-600"
                    onClick={() => onOpenQuickAdd(row.group.projectId, row.group.projectName)}
                  >
                    +
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

        <div
          ref={scrollRef}
          className="mobile-scroll-x flex-1 overflow-x-auto"
          onTouchStart={onTimelineTouchStart}
          onTouchMove={onTimelineTouchMove}
          onTouchEnd={onTimelineTouchEnd}
        >
          <div className="relative" style={{ width: chartWidth, minWidth: "100%" }}>
            <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
              <div className="relative border-b border-slate-200" style={{ height: monthRowHeight }}>
                {monthSegments.map((segment) => (
                  <div
                    key={segment.key}
                    className="absolute inset-y-0 flex items-center border-r border-slate-200 bg-slate-50/90 px-2"
                    style={{ left: segment.start * dayWidth, width: segment.span * dayWidth }}
                  >
                    <span className="text-xs font-semibold text-slate-600">{segment.label}</span>
                  </div>
                ))}
              </div>

              <div className="relative flex" style={{ height: dayRowHeight }}>
                {dateInfo.map((date) => {
                  const weekday = formatWeekdayLabel(date.date);
                  return (
                    <div
                      key={date.date}
                      data-today={date.isToday ? "true" : undefined}
                      title={date.holidayName ?? undefined}
                      className={`relative flex flex-col items-center justify-center border-r border-slate-100 ${
                        date.isToday
                          ? "bg-red-50"
                          : date.isHoliday
                            ? "bg-rose-50"
                            : date.isWeekend
                              ? "bg-slate-50/90"
                              : "bg-white"
                      }`}
                      style={{ width: dayWidth }}
                    >
                      <span className="text-[13px] font-semibold tabular-nums text-slate-700">
                        {formatDayNumber(date.date)}
                      </span>
                      <span
                        className={`mt-1 text-[10px] ${
                          weekday === "日"
                            ? "text-red-500"
                            : weekday === "土"
                              ? "text-blue-500"
                              : "text-slate-400"
                        }`}
                      >
                        {weekday}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {todayOffset >= 0 && todayOffset <= totalDays ? (
              <>
                <div
                  className="pointer-events-none absolute z-20"
                  style={{
                    left: todayOffset * dayWidth + dayWidth / 2,
                    top: 0,
                    bottom: 0,
                    width: 0,
                    borderLeft: "2px solid #dc2626",
                  }}
                />
                <div
                  className="pointer-events-none absolute z-30 -translate-x-1/2 rounded-full bg-red-600 px-2 py-1 text-[11px] font-semibold text-white"
                  style={{ left: todayOffset * dayWidth + dayWidth / 2, top: 8 }}
                >
                  今日
                </div>
              </>
            ) : null}

            {visibleRows.map((row) => {
              if (row.type === "phase") {
                return (
                  <div
                    key={`phase-chart-${row.group.projectId}`}
                    className="relative border-b border-slate-200 bg-slate-100/60"
                    style={{ height: phaseRowHeight }}
                  />
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

            <DependencyArrows
              tasks={ganttTasks}
              chartStart={chartStart}
              dayWidth={dayWidth}
              totalDays={totalDays}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
