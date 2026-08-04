import { useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ChartDateInfo, ConnectState, DragState, GanttTask, OrderDeliveryMarker } from "./types.js";
import { daysBetween, effectiveProgress, formatScheduleDate, statusColor, statusLabel } from "./utils.js";
import { gantt } from "../../theme/index.js";

const MAJOR_CATEGORY_COLORS: Record<string, string> = {
  仮設工事: "#94a3b8",
  解体工事: "#f87171",
  "躯体・下地": "#fb923c",
  床工事: "#fbbf24",
  "壁・天井仕上げ": "#84a98c",
  建具工事: "#34d399",
  電気工事: "#38bdf8",
  給排水工事: "#818cf8",
  "空調・換気": "#8b9dc3",
  造作家具: "#f472b6",
  塗装工事: "#2dd4bf",
  クリーニング: "#bfd3ba",
  検査: "#e879f9",
};

type GanttTaskBarProps = {
  task: GanttTask;
  dragState: DragState | null;
  dragRef: React.MutableRefObject<DragState | null>;
  /** Preview dates for this task when a dependency predecessor is being dragged */
  cascadePreviewDates?: { startDate: string; endDate: string };
  connectMode: boolean;
  connectState: ConnectState | null;
  chartStart: string;
  highlightedDates: ChartDateInfo[];
  today: string;
  dayWidth: number;
  /** 票g0zed: このタスクに紐づく発注の納期マーカー（該当なしなら空配列/undefined） */
  deliveryMarkers?: OrderDeliveryMarker[];
  onTaskDragStart: (task: GanttTask, event: React.PointerEvent<HTMLDivElement>) => void;
  onTaskResizeFromStart?: (task: GanttTask, event: React.PointerEvent<HTMLDivElement>) => void;
  onTaskResizeStart: (task: GanttTask, event: React.PointerEvent<HTMLDivElement>) => void;
  onOpenTaskDetail: (task: GanttTask) => void;
  onSetConnectState: (state: ConnectState | null) => void;
  onConnectTask: (toTaskId: string) => void;
  /** バー右端ハンドルからのドラッグ接続を開始する */
  onConnectDragStart: (task: GanttTask, event: React.PointerEvent<HTMLElement>) => void;
};

function isOverdue(task: GanttTask, today: string): boolean {
  return task.endDate < today && task.status !== "done";
}

export function GanttTaskBar({
  task,
  dragState,
  dragRef: _dragRef,
  cascadePreviewDates,
  chartStart,
  highlightedDates,
  today,
  dayWidth,
  connectMode,
  connectState,
  deliveryMarkers = [],
  onTaskDragStart,
  onTaskResizeFromStart,
  onTaskResizeStart,
  onOpenTaskDetail,
  onSetConnectState,
  onConnectTask,
  onConnectDragStart,
}: GanttTaskBarProps) {
  const { rowHeight } = gantt;
  const pointerStartXRef = useRef<number | null>(null);
  const isDragging = dragState?.taskId === task.id;
  const overdue = isOverdue(task, today);
  const displayStartDate = isDragging ? dragState.previewStartDate : task.startDate;
  const displayEndDate = isDragging ? dragState.previewEndDate : task.endDate;
  const startOffset = daysBetween(chartStart, displayStartDate);
  const duration = Math.max(1, daysBetween(displayStartDate, displayEndDate));
  const barLeft = startOffset * dayWidth;
  const barWidth = Math.max(duration * dayWidth, dayWidth);
  // P2: 完了タスクはグレー系で視覚的に区別
  const color = task.status === "done" ? "#94a3b8" : statusColor[task.status];
  const labelVisible = barWidth >= 96;
  const contractorVisible = barWidth >= 100 && Boolean(task.contractorName);
  const progress = effectiveProgress(task);

  // Cascade ghost bar geometry
  const ghostStartOffset = cascadePreviewDates
    ? daysBetween(chartStart, cascadePreviewDates.startDate)
    : null;
  const ghostDuration = cascadePreviewDates
    ? Math.max(1, daysBetween(cascadePreviewDates.startDate, cascadePreviewDates.endDate))
    : null;
  const ghostLeft = ghostStartOffset !== null ? ghostStartOffset * dayWidth : null;
  const ghostWidth =
    ghostDuration !== null ? Math.max(ghostDuration * dayWidth, dayWidth) : null;

  return (
    <div className="group relative border-b border-[#e3e9f1] bg-white" style={{ height: rowHeight }}>
      {/* Cascade ghost bar — shown when a predecessor is being dragged */}
      {ghostLeft !== null && ghostWidth !== null && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-md opacity-50"
          style={{
            left: ghostLeft + 4,
            top: 7,
            width: Math.max(ghostWidth - 8, 24),
            height: rowHeight - 14,
            backgroundColor: color,
            border: "2px dashed rgba(0,0,0,0.3)",
          }}
        />
      )}
      {highlightedDates.map((date) => {
        const offset = daysBetween(chartStart, date.date);
        return (
          <div
            key={date.date}
            className={`absolute top-0 h-full border-r border-[#e3e9f1] ${date.isToday ? "bg-[#fff9e8]" : "bg-[#f8fafc]"}`}
            style={{
              left: offset * dayWidth,
              width: dayWidth,
              backgroundImage: date.isWeekend && !date.isToday
                ? "repeating-linear-gradient(135deg, transparent 0 5px, rgba(148,163,184,.16) 5px 7px)"
                : undefined,
            }}
          />
        );
      })}

      {/* 票g0zed: 紐づく発注の納期マーカー。マイルストーン(◆)とは形状を分け、
          行の上端に小さな丸(セージ)で表示する。ホバーで発注業者名+納期。 */}
      {deliveryMarkers.map((marker) => (
        <div
          key={marker.orderId}
          data-testid="order-delivery-marker"
          className="pointer-events-none absolute top-0.5 z-10 -translate-x-1/2"
          style={{ left: daysBetween(chartStart, marker.deliveryDate) * dayWidth + dayWidth / 2 }}
          title={`発注: ${marker.contractorName}（納期 ${marker.deliveryDate}）`}
        >
          <span
            aria-label={`発注納期: ${marker.contractorName} (${marker.deliveryDate})`}
            className="block h-2 w-2 rounded-full border border-white bg-[#2855a6] shadow-sm"
          />
        </div>
      ))}

      <div
        role="button"
        tabIndex={0}
        data-task-id={task.id}
        data-tour="gantt-task-bar"
        aria-label={`${task.name} ${statusLabel[task.status]} ${progress}%${overdue ? " 期限超過" : ""}`}
        className={`group/bar absolute rounded-md border border-white/80 shadow-[0_1px_2px_rgba(15,38,71,0.18)] transition-transform ${
          isDragging ? "cursor-grabbing opacity-90" : "cursor-pointer active:scale-[0.99]"
        } ${connectMode ? "ring-2 ring-violet-400 ring-offset-1" : ""}`}
        style={{
          left: barLeft + 4,
          top: 7,
          width: Math.max(barWidth - 8, 24),
          height: rowHeight - 14,
          // P2: 未完了部分を透過色で薄く見せて、進捗塗り分けを明確化
          backgroundColor: `${color}80`,
          touchAction: "none",
        }}
        onPointerDown={(event) => {
          if (connectMode) return;
          pointerStartXRef.current = event.clientX;
          onTaskDragStart(task, event);
        }}
        onPointerUp={(event) => {
          if (connectMode) {
            event.stopPropagation();
            if (!connectState) {
              onSetConnectState({ fromTaskId: task.id });
            } else if (connectState.fromTaskId !== task.id) {
              onConnectTask(task.id);
            }
            return;
          }
          const startX = pointerStartXRef.current;
          pointerStartXRef.current = null;
          if (startX !== null && Math.abs(event.clientX - startX) < 6) {
            onOpenTaskDetail(task);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (connectMode) {
              if (!connectState) {
                onSetConnectState({ fromTaskId: task.id });
              } else if (connectState.fromTaskId !== task.id) {
                onConnectTask(task.id);
              }
            } else {
              onOpenTaskDetail(task);
            }
          }
        }}
      >
        {/* P2: 進捗塗り分け（左から progress% を濃色でベタ塗り） */}
        <div
          data-testid="progress-fill"
          className="absolute inset-y-0 left-0 rounded-l-md"
          style={{ width: `${progress}%`, backgroundColor: color }}
        />
        {/* [compass] 4o9m2: 遅延タスクは色だけでなく斜線ハッチングでも異常を伝える（既存の期限切バッジ色=red-500を再利用、新規カラー導入なし） */}
        {overdue ? (
          <div
            data-testid="overdue-hatch"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-md"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(239,68,68,0.35) 0px, rgba(239,68,68,0.35) 4px, transparent 4px, transparent 9px)",
            }}
          />
        ) : null}
        <div
          className="absolute inset-0 flex items-center justify-between gap-2 px-3 text-white"
          style={{ textShadow: "0 1px 2px rgba(15, 23, 42, 0.35)" }}
        >
          <div className="min-w-0">
            {labelVisible ? <p className="truncate text-[12px] font-semibold">{task.name}</p> : null}
            {contractorVisible ? (
              <p className="truncate text-[10px] text-white/85">{task.contractorName}</p>
            ) : barWidth >= 144 ? (
              <p className="truncate text-[10px] text-white/80">
                {`${formatScheduleDate(displayStartDate)} - ${formatScheduleDate(displayEndDate)}`}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {overdue ? (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                期限切
              </span>
            ) : null}
            {barWidth >= 78 ? (
              <span className="rounded-full bg-white/18 px-2 py-0.5 text-[11px] font-bold tabular-nums">
                {progress}%
              </span>
            ) : null}
          </div>
        </div>
        <div
          data-testid="resize-end-handle"
          className="absolute right-0 top-0 flex h-full w-3 cursor-ew-resize items-center justify-center rounded-r-md bg-black/10 opacity-0 transition-opacity group-hover/bar:opacity-100"
          onPointerDown={(event) => {
            pointerStartXRef.current = null;
            onTaskResizeStart(task, event);
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="h-4 w-1 rounded-full bg-white/70" />
        </div>
      </div>
      <div
        data-testid="resize-start-handle"
        aria-hidden="true"
        className="absolute z-10 flex w-3 cursor-ew-resize items-center justify-center rounded-l-md bg-black/10 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ left: barLeft + 4, top: 7, height: rowHeight - 14, touchAction: "none" }}
        onPointerDown={(event) => {
          event.stopPropagation();
          pointerStartXRef.current = null;
          onTaskResizeFromStart?.(task, event);
        }}
      >
        <div className="h-3 w-px bg-white/80" />
      </div>
      {/* P2.5: 依存関係ドラッグ用ハンドル（バー右端の外側、ホバーで出現） */}
      <button
        type="button"
        aria-label={`依存関係を接続: ${task.name}`}
        className="absolute z-10 h-3 w-3 rounded-full border border-white bg-slate-400 opacity-0 shadow-sm transition-opacity hover:bg-slate-500 focus-visible:opacity-100 group-hover:opacity-100"
        style={{
          left: barLeft + 4 + Math.max(barWidth - 8, 24) + 2,
          top: 7 + (rowHeight - 14) / 2 - 6,
          touchAction: "none",
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
          onConnectDragStart(task, event);
        }}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}

type GanttTaskLabelProps = {
  task: GanttTask;
  today: string;
  connectMode: boolean;
  /** P2.5: 同一案件内の全タスク（依存警告判定用） */
  allTasks?: GanttTask[];
  onOpenTaskDetail: (task: GanttTask) => void;
  onMoveTask?: (task: GanttTask, direction: "up" | "down") => void;
  /** 票l7369: 行チェックボックスでの完了/未完了ワンクリックトグル */
  onToggleDone?: (task: GanttTask) => void;
  isFirst?: boolean;
  isLast?: boolean;
};

export function GanttTaskLabel({
  task,
  today,
  allTasks,
  connectMode,
  onOpenTaskDetail,
  onMoveTask,
  onToggleDone,
  isFirst = false,
  isLast = false,
}: GanttTaskLabelProps) {
  const { rowHeight } = gantt;

  // P2.5: 先行タスクが未完了なのに後続の開始日を超過している場合に警告
  const hasDependencyWarning = (() => {
    if (!allTasks || !task.dependencies?.length) return false;
    if (task.startDate > today) return false; // まだ開始前なら警告不要
    for (const depId of task.dependencies) {
      const pred = allTasks.find((t) => t.id === depId);
      if (pred && pred.status !== "done" && task.startDate >= today) return true;
    }
    return false;
  })();

  return (
    <div
      className="group/label relative grid w-full grid-cols-[20px_minmax(0,1fr)_30px_42px] items-center gap-1 border-b border-[#e3e9f1] px-2 md:grid-cols-[20px_minmax(0,1fr)_48px_66px] md:gap-2"
      style={{ minHeight: rowHeight }}
    >
      {onToggleDone && (
        <input
          type="checkbox"
          data-testid={`task-done-checkbox-${task.id}`}
          aria-label={`${task.name}を${task.status === "done" ? "未完了に戻す" : "完了にする"}`}
          checked={task.status === "done"}
          onChange={() => onToggleDone(task)}
          onClick={(event) => event.stopPropagation()}
          className="h-4 w-4 shrink-0 rounded-sm border-[#b7c3d3] accent-[#6ea8ff]"
        />
      )}
      <button
        type="button"
        className="contents text-left"
        onClick={() => {
          if (!connectMode) onOpenTaskDetail(task);
        }}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {task.majorCategory ? (
            <span
              data-testid="major-category-badge"
              className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold text-white"
              style={{ backgroundColor: MAJOR_CATEGORY_COLORS[task.majorCategory] ?? "#94a3b8" }}
            >
              {task.majorCategory}
            </span>
          ) : null}
          {/* P2.5: 先行未完了警告 */}
          {hasDependencyWarning && (
            <span
              title="先行タスクが未完了です"
              className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700"
            >
              先行待
            </span>
          )}
          {/* P2: 完了タスクは名前をグレー化 */}
          <p className={`truncate text-[12px] font-medium ${task.status === "done" ? "text-[#a2adbb] line-through" : "text-[#26364d]"}`}>
            {task.name}
          </p>
        </div>
        <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-[#edf1f6] text-[10px] font-semibold text-[#65748a]" title={task.contractorName ?? "担当未設定"}>
          {task.contractorName?.trim().slice(0, 1) ?? "-"}
        </span>
        <div className="flex items-center gap-1.5">
          <div className="hidden h-1 flex-1 rounded-full bg-[#dce3ec] md:block">
            <div
              className="h-full rounded-full"
              style={{
                width: `${effectiveProgress(task)}%`,
                backgroundColor: task.status === "done" ? "#94a3b8" : statusColor[task.status],
              }}
            />
          </div>
          <span className="w-7 shrink-0 text-right text-[10px] font-semibold tabular-nums text-[#65748a]">{effectiveProgress(task)}%</span>
        </div>
      </button>
      {onMoveTask && (
        <div className="absolute right-0 top-0 hidden h-full shrink-0 flex-col justify-center bg-white px-1 group-hover/label:flex">
          <button
            type="button"
            aria-label="上へ移動"
            disabled={isFirst}
            className="flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-600 disabled:opacity-30"
            onClick={() => onMoveTask(task, "up")}
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="下へ移動"
            disabled={isLast}
            className="flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-600 disabled:opacity-30"
            onClick={() => onMoveTask(task, "down")}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
