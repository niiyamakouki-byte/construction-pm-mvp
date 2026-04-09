import { useRef } from "react";
import type { ConnectState, DragState, GanttTask } from "./types.js";
import { daysBetween, formatScheduleDate, statusColor, statusLabel } from "./utils.js";
import { gantt } from "../../theme/index.js";

type HighlightedDate = { date: string; isToday: boolean; isWeekend: boolean };

type GanttTaskBarProps = {
  task: GanttTask;
  dragState: DragState | null;
  dragRef: React.MutableRefObject<DragState | null>;
  connectMode: boolean;
  connectState: ConnectState | null;
  chartStart: string;
  highlightedDates: HighlightedDate[];
  today: string;
  dayWidth: number;
  onTaskDragStart: (task: GanttTask, event: React.PointerEvent<HTMLDivElement>) => void;
  onTaskResizeStart: (task: GanttTask, event: React.PointerEvent<HTMLDivElement>) => void;
  onOpenTaskDetail: (task: GanttTask) => void;
  onSetConnectState: (state: ConnectState | null) => void;
  onConnectTask: (toTaskId: string) => void;
};

function isOverdue(task: GanttTask, today: string): boolean {
  return task.endDate < today && task.status !== "done";
}

export function GanttTaskBar({
  task,
  dragState,
  dragRef: _dragRef,
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
  const color = statusColor[task.status];
  const labelVisible = barWidth >= 96;

  return (
    <div className="relative border-b border-slate-100 bg-white" style={{ height: rowHeight }}>
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
        aria-label={`${task.name} ${statusLabel[task.status]} ${task.progress}%${overdue ? " 期限超過" : ""}`}
        className={`absolute rounded-full border border-white/70 shadow-sm transition-transform ${
          isDragging ? "cursor-grabbing opacity-90" : "cursor-pointer active:scale-[0.99]"
        } ${connectMode ? "ring-2 ring-violet-400 ring-offset-1" : ""}`}
        style={{
          left: barLeft + 4,
          top: 14,
          width: Math.max(barWidth - 8, 24),
          height: rowHeight - 28,
          backgroundColor: color,
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
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white/18"
          style={{ width: `${Math.min(task.progress, 100)}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-between gap-2 px-3 text-white">
          <div className="min-w-0">
            {labelVisible ? <p className="truncate text-[12px] font-semibold">{task.name}</p> : null}
            {barWidth >= 144 ? (
              <p className="truncate text-[10px] text-white/80">
                {formatScheduleDate(displayStartDate)} - {formatScheduleDate(displayEndDate)}
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
                {task.progress}%
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
    </div>
  );
}

type GanttTaskLabelProps = {
  task: GanttTask;
  today: string;
  connectMode: boolean;
  onOpenTaskDetail: (task: GanttTask) => void;
};

export function GanttTaskLabel({ task, connectMode, onOpenTaskDetail }: GanttTaskLabelProps) {
  const { rowHeight } = gantt;

  return (
    <button
      type="button"
      className="flex w-full items-center border-b border-slate-100 px-3 py-2 text-left transition-colors hover:bg-slate-50/80"
      style={{ minHeight: rowHeight }}
      onClick={() => {
        if (!connectMode) onOpenTaskDetail(task);
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{task.name}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{task.contractorName ?? "協力会社未設定"}</p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-slate-200">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(task.progress, 100)}%`, backgroundColor: statusColor[task.status] }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-500">{task.progress}%</span>
        </div>
      </div>
    </button>
  );
}
