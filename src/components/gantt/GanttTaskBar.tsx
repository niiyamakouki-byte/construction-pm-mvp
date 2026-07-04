import { useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ChartDateInfo, ConnectState, DragState, GanttTask } from "./types.js";
import { daysBetween, effectiveProgress, formatScheduleDate, statusColor, statusLabel } from "./utils.js";
import { gantt } from "../../theme/index.js";

/** 大項目ごとの色マッピング */
const MAJOR_CATEGORY_COLORS: Record<string, string> = {
  仮設工事: "#94a3b8",
  解体工事: "#f87171",
  "躯体・下地": "#fb923c",
  床工事: "#fbbf24",
  "壁・天井仕上げ": "#a3e635",
  建具工事: "#34d399",
  電気工事: "#38bdf8",
  給排水工事: "#818cf8",
  "空調・換気": "#c084fc",
  造作家具: "#f472b6",
  塗装工事: "#2dd4bf",
  クリーニング: "#86efac",
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
  onTaskDragStart: (task: GanttTask, event: React.PointerEvent<HTMLDivElement>) => void;
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
  onTaskDragStart,
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
    <div className="group relative border-b border-slate-100 bg-white" style={{ height: rowHeight }}>
      {/* Cascade ghost bar — shown when a predecessor is being dragged */}
      {ghostLeft !== null && ghostWidth !== null && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full opacity-50"
          style={{
            left: ghostLeft + 4,
            top: 14,
            width: Math.max(ghostWidth - 8, 24),
            height: rowHeight - 28,
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
            className={`absolute top-0 h-full border-r border-slate-100/70 ${
              date.isToday ? "bg-red-50/55" : "bg-slate-50/80"
            }`}
            style={{ left: offset * dayWidth, width: dayWidth }}
          />
        );
      })}

      <div
        role="button"
        tabIndex={0}
        data-task-id={task.id}
        aria-label={`${task.name} ${statusLabel[task.status]} ${progress}%${overdue ? " 期限超過" : ""}`}
        className={`group/bar absolute rounded-full border border-white/70 shadow-sm transition-transform ${
          isDragging ? "cursor-grabbing opacity-90" : "cursor-pointer active:scale-[0.99]"
        } ${connectMode ? "ring-2 ring-violet-400 ring-offset-1" : ""}`}
        style={{
          left: barLeft + 4,
          top: 14,
          width: Math.max(barWidth - 8, 24),
          height: rowHeight - 28,
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
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${progress}%`, backgroundColor: color }}
        />
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
          className="absolute right-0 top-0 flex h-full w-5 items-center justify-center rounded-r-full bg-black/10"
          onPointerDown={(event) => {
            pointerStartXRef.current = null;
            onTaskResizeStart(task, event);
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="h-4 w-1 rounded-full bg-white/70" />
        </div>
      </div>
      {/* P2.5: 依存関係ドラッグ用ハンドル（バー右端の外側、ホバーで出現） */}
      <button
        type="button"
        aria-label={`依存関係を接続: ${task.name}`}
        className="absolute z-10 h-3 w-3 rounded-full border border-white bg-slate-400 opacity-0 shadow-sm transition-opacity hover:bg-slate-500 focus-visible:opacity-100 group-hover:opacity-100"
        style={{
          left: barLeft + 4 + Math.max(barWidth - 8, 24) + 2,
          top: 14 + (rowHeight - 28) / 2 - 6,
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
      className="flex w-full items-center gap-1 border-b border-slate-100 px-3 py-2"
      style={{ minHeight: rowHeight }}
    >
      <button
        type="button"
        className="min-w-0 flex-1 text-left transition-colors hover:bg-slate-50/80"
        onClick={() => {
          if (!connectMode) onOpenTaskDetail(task);
        }}
      >
        <div className="flex items-center gap-1.5">
          {task.majorCategory && (
            <span
              className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white"
              style={{ backgroundColor: MAJOR_CATEGORY_COLORS[task.majorCategory] ?? "#94a3b8" }}
            >
              {task.majorCategory}
            </span>
          )}
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
          <p className={`truncate text-sm font-semibold ${task.status === "done" ? "text-slate-400 line-through" : "text-slate-900"}`}>
            {task.name}
          </p>
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">{task.contractorName ?? "協力会社未設定"}</p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-slate-200">
            <div
              className="h-full rounded-full"
              style={{ width: `${effectiveProgress(task)}%`, backgroundColor: statusColor[task.status] }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-500">{effectiveProgress(task)}%</span>
        </div>
      </button>
      {onMoveTask && (
        <div className="flex shrink-0 flex-col">
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
