import { useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  RefObject,
  TouchEvent as ReactTouchEvent,
} from "react";
import type { CascadePreview } from "../../hooks/useGanttDrag.js";
import type { ChartLayout, ConnectState, DragState, GanttTask, OrderDeliveryMarker } from "./types.js";
import type { Milestone, MilestoneStatus } from "../../lib/milestone-tracker.js";
import { gantt } from "../../theme/index.js";
import { daysBetween, formatDayNumber, formatMonthLabel, formatWeekdayLabel } from "./utils.js";
import { GanttTaskBar, GanttTaskLabel } from "./GanttTaskBar.js";
import { DependencyArrows } from "./DependencyArrows.js";

type VisibleRow =
  | { type: "phase"; group: { projectId: string; phaseName: string; projectName: string; tasks: GanttTask[]; collapsed: boolean } }
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
  /** 票g0zed: taskId紐づけ済み発注の納期マーカー（全タスク横断、行ごとに絞り込んで描画） */
  orderMarkers?: OrderDeliveryMarker[];
  today: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  /** P1: フェーズ別進捗（日数加重平均）。key=工種名 */
  phaseProgress?: Map<string, number>;
  onTaskDragStart: (task: GanttTask, event: ReactPointerEvent<HTMLDivElement>) => void;
  onTaskResizeFromStart?: (task: GanttTask, event: ReactPointerEvent<HTMLDivElement>) => void;
  onTaskResizeStart: (task: GanttTask, event: ReactPointerEvent<HTMLDivElement>) => void;
  onOpenTaskDetail: (task: GanttTask) => void;
  onMoveTask?: (task: GanttTask, direction: "up" | "down") => void;
  /** 票l7369: 行チェックボックスでの完了/未完了ワンクリックトグル */
  onToggleDone?: (task: GanttTask) => void;
  onOpenQuickAdd: (projectId: string, projectName: string) => void;
  onTogglePhase: (projectId: string) => void;
  onSetConnectState: (state: ConnectState | null) => void;
  onConnectTask: (toTaskId: string) => void;
  /** バードラッグ接続の確定: fromTaskId=先行 / toTaskId=後続 */
  onConnectTasks: (fromTaskId: string, toTaskId: string) => void;
  /** P2.5: 依存線クリックからの依存解除。fromTaskId=先行 / toTaskId=後続 */
  onRemoveDependency?: (fromTaskId: string, toTaskId: string) => void;
  onTimelineTouchStart?: (event: ReactTouchEvent<HTMLDivElement>) => void;
  onTimelineTouchMove?: (event: ReactTouchEvent<HTMLDivElement>) => void;
  onTimelineTouchEnd?: (event: ReactTouchEvent<HTMLDivElement>) => void;
  onToday?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
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
  orderMarkers = [],
  today,
  scrollRef,
  phaseProgress,
  onTaskDragStart,
  onTaskResizeFromStart,
  onTaskResizeStart,
  onOpenTaskDetail,
  onMoveTask,
  onToggleDone,
  onOpenQuickAdd,
  onTogglePhase,
  onSetConnectState,
  onConnectTask,
  onConnectTasks,
  onRemoveDependency,
  onTimelineTouchStart,
  onTimelineTouchMove,
  onTimelineTouchEnd,
  onToday,
  onZoomIn,
  onZoomOut,
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
    completed: "bg-slate-700 text-slate-700",
  };

  return (
    <div
      data-tour="gantt-chart"
      className="relative overflow-hidden rounded-md border border-[#d9e2ef] bg-white shadow-[0_2px_8px_rgba(15,38,71,0.06)]"
      role="figure"
      aria-label={`ガントチャート: ${ganttTasks.length}タスク`}
      style={chartShellStyle}
    >
      <div className="flex min-h-[420px]">
        <div className="gantt-label-column shrink-0 border-r border-[#d9e2ef] bg-white">
          {/* headerHeight(64px)固定のため縦積みにすると下の行へはみ出して重なる。1行表記で収める */}
          <div className="grid grid-cols-[minmax(0,1fr)_30px_42px] items-end border-b border-[#d9e2ef] bg-[#f7f9fc] px-2 pb-2 text-[10px] font-semibold text-[#40516b] md:grid-cols-[minmax(0,1fr)_48px_66px] md:px-3 md:text-[11px]" style={{ height: headerHeight }}>
            <span>タスク名</span>
            <span className="text-center">担当</span>
            <span className="text-right">進捗</span>
          </div>

          {visibleRows.map((row) => {
            if (row.type === "phase") {
              const progress = phaseProgress?.get(row.group.phaseName) ?? 0;
              const collapsed = row.group.collapsed;
              return (
                <div
                  key={`phase-${row.group.phaseName}`}
                  className="flex items-center gap-2 border-b border-[#d9e2ef] bg-[#f4f7fb] px-2"
                  style={{ height: phaseRowHeight }}
                >
                  <button
                    type="button"
                    aria-expanded={!collapsed}
                    aria-label={`${row.group.phaseName} ${collapsed ? "展開" : "折りたたむ"}`}
                    className="flex h-full min-w-7 shrink-0 items-center justify-center text-[#708197] hover:bg-[#e9eef5] hover:text-[#26364d] transition-colors"
                    onClick={() => onTogglePhase(row.group.phaseName)}
                  >
                    <span className="text-[10px] font-bold">{collapsed ? "▶" : "▼"}</span>
                  </button>
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => onTogglePhase(row.group.phaseName)}
                  >
                    <p className="truncate text-[12px] font-semibold text-[#26364d]">{row.group.phaseName}</p>
                  </div>
                  <span className="w-10 text-right text-[10px] font-semibold tabular-nums text-[#52647c]">{progress}%</span>
                  <button
                    type="button"
                    aria-label={`${row.group.phaseName}に工程を追加`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#d9e2ef] bg-white text-[#2855a6] hover:bg-[#eef4ff] transition-colors text-sm font-bold"
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
                allTasks={ganttTasks}
                connectMode={connectMode}
                onOpenTaskDetail={onOpenTaskDetail}
                onMoveTask={onMoveTask}
                onToggleDone={onToggleDone}
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
          {(onToday || onZoomIn || onZoomOut) ? (
            <div className="absolute right-3 top-3 z-40 flex h-9 items-center overflow-hidden rounded-full border border-[#d9e2ef] bg-white shadow-[0_2px_10px_rgba(15,38,71,0.12)]">
              <span className="flex h-full w-9 items-center justify-center border-r border-[#e6ebf2] text-[#65748a]" aria-hidden="true">≡</span>
              {onToday ? <button type="button" onClick={onToday} className="h-full border-r border-[#e6ebf2] px-4 text-xs font-semibold text-[#33445c] hover:bg-[#f4f7fb]">今日</button> : null}
              {onZoomOut ? <button type="button" onClick={onZoomOut} aria-label="縮小" className="h-full w-9 border-r border-[#e6ebf2] text-lg text-[#33445c] hover:bg-[#f4f7fb]">−</button> : null}
              {onZoomIn ? <button type="button" onClick={onZoomIn} aria-label="拡大" className="h-full w-9 text-lg text-[#33445c] hover:bg-[#f4f7fb]">＋</button> : null}
            </div>
          ) : null}
          <div ref={chartBodyRef} className="relative" style={{ width: chartWidth, minWidth: "100%" }}>
            <div className="sticky top-0 z-30 border-b border-[#d9e2ef] bg-white">
              <div className="relative border-b border-slate-200" style={{ height: monthRowHeight }}>
                {monthSegments.map((segment) => (
                  <div
                    key={segment.key}
                    className="absolute inset-y-0 flex items-center justify-center border-r border-[#d9e2ef] bg-[#f7f9fc] px-2"
                    style={{ left: segment.start * dayWidth, width: segment.span * dayWidth }}
                  >
                    <span className="text-[11px] font-semibold text-[#40516b]">{segment.label}</span>
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
                      className={`relative flex flex-col items-center justify-center border-r border-[#e3e9f1] ${
                        date.isToday
                          ? "bg-[#fff9e8]"
                          : date.isHoliday
                            ? "bg-rose-50"
                            : date.isWeekend
                              ? "bg-slate-50/90"
                              : "bg-white"
                      }`}
                      style={{ width: dayWidth }}
                    >
                      <span className={`text-[12px] font-semibold tabular-nums ${weekday === "日" || date.isHoliday ? "text-[#e64646]" : "text-[#40516b]"}`}>
                        {formatDayNumber(date.date)}
                      </span>
                      <span
                        className={`mt-0.5 text-[9px] ${
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
                    borderLeft: "1px dashed #f28c28",
                  }}
                />
              </>
            ) : null}

            {visibleMilestones.map((milestone, index) => (
              <div
                key={milestone.id}
                data-testid="milestone-marker"
                data-milestone-status={milestone.status}
                className="pointer-events-none absolute z-20 -translate-x-1/2"
                style={{
                  left: milestone.offset * dayWidth + dayWidth / 2,
                  top: headerHeight + 8 + (index % 2) * 24,
                }}
                title={`${milestone.name} (${milestone.targetDate})`}
              >
                {/* laporta-beads-mchy1: ラベルを◆の横へ逃がし、1行目のステータスバッジ帯と分離する。 */}
                <div className="relative flex flex-col items-center">
                  <span
                    aria-label={`マイルストーン: ${milestone.name}`}
                    className={`block h-4 w-4 rotate-45 border-2 border-white shadow-md ${milestoneTone[milestone.status].split(" ")[0]}`}
                  />
                  {dayWidth >= 20 ? (
                    <span
                      data-testid="milestone-label"
                      className={`absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-full bg-white/95 px-2 py-1 text-[10px] font-semibold shadow-sm ${milestoneTone[milestone.status].split(" ")[1]}`}
                    >
                      {milestone.name}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}

            {visibleRows.map((row) => {
              if (row.type === "phase") {
                // P1: フェーズ期間サマリーバー（配下タスクの最小開始〜最大終了）
                const phaseTasks = row.group.tasks;
                let phaseBarLeft: number | null = null;
                let phaseBarWidth: number | null = null;
                if (phaseTasks.length > 0) {
                  const minStart = phaseTasks.reduce((min, t) => t.startDate < min ? t.startDate : min, phaseTasks[0].startDate);
                  const maxEnd = phaseTasks.reduce((max, t) => t.endDate > max ? t.endDate : max, phaseTasks[0].endDate);
                  const startOff = daysBetween(chartStart, minStart);
                  const endOff = daysBetween(chartStart, maxEnd);
                  phaseBarLeft = startOff * dayWidth;
                  phaseBarWidth = Math.max((endOff - startOff + 1) * dayWidth, dayWidth);
                }
                const phaseProgressVal = phaseProgress?.get(row.group.phaseName) ?? 0;
                return (
                  <div
                    key={`phase-chart-${row.group.phaseName}`}
                    className="relative border-b border-[#d9e2ef] bg-[#f4f7fb]"
                    style={{ height: phaseRowHeight }}
                  >
                    {phaseBarLeft !== null && phaseBarWidth !== null && (
                      <div
                        className="absolute rounded-sm bg-slate-300/60"
                        style={{
                          left: phaseBarLeft + 4,
                          top: phaseRowHeight / 2 - 5,
                          width: phaseBarWidth - 8,
                          height: 10,
                        }}
                      >
                        <div
                          className="h-full rounded-sm bg-[#71839b]"
                          style={{ width: `${phaseProgressVal}%` }}
                        />
                      </div>
                    )}
                  </div>
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
                  deliveryMarkers={orderMarkers.filter((marker) => marker.taskId === row.task.id)}
                  onTaskDragStart={onTaskDragStart}
                  onTaskResizeFromStart={onTaskResizeFromStart}
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
              visibleRows={visibleRows}
              onRemoveDependency={onRemoveDependency}
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
