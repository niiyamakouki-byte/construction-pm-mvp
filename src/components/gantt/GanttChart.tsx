import { useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  RefObject,
  TouchEvent as ReactTouchEvent,
} from "react";
import type { CascadePreview } from "../../hooks/useGanttDrag.js";
import type { ChartLayout, ConnectState, DragState, GanttTask } from "./types.js";
import type { Milestone, MilestoneStatus } from "../../lib/milestone-tracker.js";
import { gantt } from "../../theme/index.js";
import { daysBetween, formatDayNumber, formatMonthLabel, formatWeekdayLabel } from "./utils.js";
import { GanttTaskBar, GanttTaskLabel } from "./GanttTaskBar.js";
import { DependencyArrows } from "./DependencyArrows.js";

type VisibleRow =
  | { type: "phase"; group: { projectId: string; projectName: string; tasks: GanttTask[]; collapsed: boolean } }
  | { type: "task"; task: GanttTask };

/** バーの接続ハンドルからのドラッグ状態（チャート内座標） */
type ConnectDragState = {
  fromTaskId: string;
  fromX: number;
  fromY: number;
  pointerX: number;
  pointerY: number;
  /** 現在ポインタが乗っている接続先タスク（自分自身は除外済み） */
  overTaskId: string | null;
};

type Props = {
  ganttTasks: GanttTask[];
  visibleRows: VisibleRow[];
  chartLayout: ChartLayout;
  dragState: DragState | null;
  dragRef: MutableRefObject<DragState | null>;
  cascadePreview?: CascadePreview;
  connectMode: boolean;
  connectState: ConnectState | null;
  milestones?: Milestone[];
  showMilestones?: boolean;
  today: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  onTaskDragStart: (task: GanttTask, event: ReactPointerEvent<HTMLDivElement>) => void;
  onTaskResizeStart: (task: GanttTask, event: ReactPointerEvent<HTMLDivElement>) => void;
  onOpenTaskDetail: (task: GanttTask) => void;
  onMoveTask?: (task: GanttTask, direction: "up" | "down") => void;
  onOpenQuickAdd: (projectId: string, projectName: string) => void;
  onTogglePhase: (projectId: string) => void;
  onSetConnectState: (state: ConnectState | null) => void;
  onConnectTask: (toTaskId: string) => void;
  /** バードラッグ接続の確定: fromTaskId=先行 / toTaskId=後続 */
  onConnectTasks: (fromTaskId: string, toTaskId: string) => void;
  onTimelineTouchStart?: (event: ReactTouchEvent<HTMLDivElement>) => void;
  onTimelineTouchMove?: (event: ReactTouchEvent<HTMLDivElement>) => void;
  onTimelineTouchEnd?: (event: ReactTouchEvent<HTMLDivElement>) => void;
  /**
   * 個人カレンダー予定が入っている日付（YYYY-MM-DD）→ 表示用ラベル配列。
   * Phase A: タイムラインヘッダー直下にマーカーを薄く表示する。
   */
  personalEventLabelsByDate?: Record<string, string[]>;
};

export function GanttChart({
  ganttTasks,
  visibleRows,
  chartLayout,
  dragState,
  dragRef,
  cascadePreview,
  connectMode,
  connectState,
  milestones = [],
  showMilestones = true,
  today,
  scrollRef,
  onTaskDragStart,
  onTaskResizeStart,
  onOpenTaskDetail,
  onMoveTask,
  onOpenQuickAdd,
  onTogglePhase,
  onSetConnectState,
  onConnectTask,
  onConnectTasks,
  onTimelineTouchStart,
  onTimelineTouchMove,
  onTimelineTouchEnd,
  personalEventLabelsByDate,
}: Props) {
  const { phaseRowHeight, headerHeight, labelWidth } = gantt;
  const { chartStart, totalDays, dateInfo, highlightedDates, todayOffset, dayWidth } = chartLayout;
  const monthRowHeight = 30;
  const dayRowHeight = headerHeight - monthRowHeight;
  const chartWidth = (totalDays + 1) * dayWidth;
  const chartShellStyle = { "--gantt-label-width": `${labelWidth}px` } as CSSProperties;

  // ── バードラッグによる依存関係接続 ───────────────────────────────
  const chartBodyRef = useRef<HTMLDivElement | null>(null);
  const connectDragRef = useRef<ConnectDragState | null>(null);
  const [connectDrag, setConnectDrag] = useState<ConnectDragState | null>(null);
  const onConnectTasksRef = useRef(onConnectTasks);
  onConnectTasksRef.current = onConnectTasks;
  const isConnecting = connectDrag !== null;

  const startConnectDrag = (task: GanttTask, event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    const rect = chartBodyRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const next: ConnectDragState = {
      fromTaskId: task.id,
      fromX: x,
      fromY: y,
      pointerX: x,
      pointerY: y,
      overTaskId: null,
    };
    connectDragRef.current = next;
    setConnectDrag(next);
  };

  useEffect(() => {
    if (!isConnecting) return;

    const resolveTaskAt = (clientX: number, clientY: number): string | null => {
      const el = document.elementFromPoint(clientX, clientY);
      const row = el?.closest<HTMLElement>("[data-task-id]");
      return row?.dataset.taskId ?? null;
    };

    const handleMove = (event: PointerEvent) => {
      const cur = connectDragRef.current;
      const rect = chartBodyRef.current?.getBoundingClientRect();
      if (!cur || !rect) return;
      const overTaskId = resolveTaskAt(event.clientX, event.clientY);
      const next: ConnectDragState = {
        ...cur,
        pointerX: event.clientX - rect.left,
        pointerY: event.clientY - rect.top,
        overTaskId: overTaskId && overTaskId !== cur.fromTaskId ? overTaskId : null,
      };
      connectDragRef.current = next;
      setConnectDrag(next);
    };

    const handleUp = (event: PointerEvent) => {
      const cur = connectDragRef.current;
      connectDragRef.current = null;
      setConnectDrag(null);
      if (!cur) return;
      const toTaskId = resolveTaskAt(event.clientX, event.clientY);
      if (toTaskId && toTaskId !== cur.fromTaskId) {
        onConnectTasksRef.current(cur.fromTaskId, toTaskId);
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [isConnecting]);

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

  const taskRowIds = visibleRows.filter((row) => row.type === "task").map((row) => row.task.id);

  const visibleMilestones = showMilestones
    ? milestones
      .map((milestone) => ({
        ...milestone,
        offset: daysBetween(chartStart, milestone.targetDate),
      }))
      .filter((milestone) => milestone.offset >= 0 && milestone.offset <= totalDays)
    : [];

  const milestoneTone: Record<MilestoneStatus, string> = {
    "on-track": "bg-blue-500 text-blue-700",
    "at-risk": "bg-amber-500 text-amber-700",
    missed: "bg-red-500 text-red-700",
    completed: "bg-emerald-500 text-emerald-700",
  };

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

            const taskPosition = taskRowIds.indexOf(row.task.id);
            return (
              <GanttTaskLabel
                key={row.task.id}
                task={row.task}
                today={today}
                connectMode={connectMode}
                onOpenTaskDetail={onOpenTaskDetail}
                onMoveTask={onMoveTask}
                isFirst={taskPosition === 0}
                isLast={taskPosition === taskRowIds.length - 1}
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
          <div ref={chartBodyRef} className="relative" style={{ width: chartWidth, minWidth: "100%" }}>
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
                  const personalEvents = personalEventLabelsByDate?.[date.date];
                  const hasPersonalEvent = personalEvents != null && personalEvents.length > 0;
                  const personalEventTitle = hasPersonalEvent ? `個人予定: ${personalEvents.join(", ")}` : undefined;
                  return (
                    <div
                      key={date.date}
                      data-today={date.isToday ? "true" : undefined}
                      data-has-personal-event={hasPersonalEvent ? "true" : undefined}
                      title={personalEventTitle ?? date.holidayName ?? undefined}
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
                      {hasPersonalEvent && (
                        <span
                          aria-label={personalEventTitle}
                          className="absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-amber-400"
                        />
                      )}
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

            {visibleMilestones.map((milestone, index) => (
              <div
                key={milestone.id}
                className="pointer-events-none absolute z-20 -translate-x-1/2"
                style={{
                  left: milestone.offset * dayWidth + dayWidth / 2,
                  top: headerHeight + 8 + (index % 2) * 24,
                }}
              >
                <div className="flex flex-col items-center gap-1">
                  <span
                    className={`block h-3.5 w-3.5 rotate-45 rounded-[3px] border border-white shadow-sm ${milestoneTone[milestone.status].split(" ")[0]}`}
                  />
                  {dayWidth >= 20 ? (
                    <span className={`rounded-full bg-white/95 px-2 py-1 text-[10px] font-semibold shadow-sm ${milestoneTone[milestone.status].split(" ")[1]}`}>
                      {milestone.name}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}

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
                  cascadePreviewDates={cascadePreview?.get(row.task.id)}
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
                  onConnectDragStart={startConnectDrag}
                />
              );
            })}

            <DependencyArrows
              tasks={ganttTasks}
              chartStart={chartStart}
              dayWidth={dayWidth}
              totalDays={totalDays}
            />

            {connectDrag ? (
              <svg
                data-testid="connect-drag-preview"
                className="pointer-events-none absolute inset-0 z-20"
                style={{ width: chartWidth, height: "100%" }}
                overflow="visible"
              >
                {(() => {
                  const { fromX, fromY, pointerX, pointerY, overTaskId } = connectDrag;
                  const cx = (fromX + pointerX) / 2;
                  const d = `M ${fromX} ${fromY} C ${cx} ${fromY} ${cx} ${pointerY} ${pointerX} ${pointerY}`;
                  return (
                    <>
                      <path
                        d={d}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="1.5"
                        strokeOpacity="0.85"
                        strokeDasharray="5 3"
                      />
                      <circle
                        cx={pointerX}
                        cy={pointerY}
                        r="4"
                        fill={overTaskId ? "#94a3b8" : "white"}
                        stroke="#94a3b8"
                        strokeWidth="1.5"
                      />
                    </>
                  );
                })()}
              </svg>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
