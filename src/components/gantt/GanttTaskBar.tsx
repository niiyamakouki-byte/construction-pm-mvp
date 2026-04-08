import type { GanttTask, DragState, ConnectState } from "./types.js";
import { addDays, daysBetween, formatScheduleDate, getAlertLevel, progressColor, statusColor, statusLabel } from "./utils.js";
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
  onTaskDragStart: (task: GanttTask, event: React.MouseEvent<HTMLDivElement>) => void;
  onTaskResizeStart: (task: GanttTask, event: React.MouseEvent<HTMLDivElement>) => void;
  onOpenTaskDetail: (task: GanttTask) => void;
  onSetConnectState: (state: ConnectState | null) => void;
  onConnectTask: (toTaskId: string) => void;
};

function getAlertDecoration(alertLevel: ReturnType<typeof getAlertLevel>) {
  if (alertLevel === "overdue") return { borderColor: "#dc2626", boxShadow: "0 0 0 1px rgba(220, 38, 38, 0.2)" };
  if (alertLevel === "urgent") return { borderColor: "#ea580c", boxShadow: "0 0 0 1px rgba(234, 88, 12, 0.18)" };
  if (alertLevel === "soon") return { borderColor: "#d97706", boxShadow: "0 0 0 1px rgba(217, 119, 6, 0.15)" };
  return { borderColor: "rgba(15, 23, 42, 0.08)", boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)" };
}

export function GanttTaskBar({
  task,
  dragState,
  dragRef,
  connectMode,
  connectState,
  chartStart,
  highlightedDates,
  today,
  dayWidth,
  onTaskDragStart,
  onTaskResizeStart,
  onOpenTaskDetail,
  onSetConnectState,
  onConnectTask,
}: GanttTaskBarProps) {
  const { rowHeight } = gantt;
  const isDragging = dragState?.taskId === task.id;
  const displayStartDate = isDragging ? dragState.previewStartDate : task.startDate;
  const displayEndDate = isDragging ? dragState.previewEndDate : task.endDate;
  const startOffset = daysBetween(chartStart, displayStartDate);
  const duration = Math.max(1, daysBetween(displayStartDate, displayEndDate));
  const left = startOffset * dayWidth;
  const width = Math.max(duration * dayWidth, dayWidth);
  const alertLevel = getAlertLevel(task, today);
  const alertDecoration = getAlertDecoration(alertLevel);
  const barColor = statusColor[task.status];
  const isConnectFrom = connectState?.fromTaskId === task.id;
  const showInlineProgress = width >= 112;

  return (
    <div className="relative border-b border-slate-100/80 bg-white" style={{ height: rowHeight }}>
      {highlightedDates.map((di) => {
        const offset = daysBetween(chartStart, di.date);
        const shade = di.isWeekend && !task.projectIncludesWeekends
          ? "bg-slate-100/90"
          : di.isToday
            ? "bg-red-50/55"
            : "bg-slate-50/40";
        return (
          <div
            key={di.date}
            className={`absolute top-0 h-full border-r border-slate-100/70 ${shade}`}
            style={{ left: offset * dayWidth, width: dayWidth }}
          />
        );
      })}

      {task.isMilestone ? (
        <div className="absolute inset-y-0" style={{ left }}>
          <button
            type="button"
            aria-label={`マイルストーン ${task.name} ${formatScheduleDate(task.startDate)} 進捗${task.progress}%`}
            className="absolute flex items-center justify-center rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            style={{ left: dayWidth / 2 - 18, top: rowHeight / 2 - 18, width: 36, height: 36 }}
            title={`${task.name}: ${formatScheduleDate(task.startDate)}`}
            onClick={() => {
              if (connectMode) {
                if (!connectState) onSetConnectState({ fromTaskId: task.id });
                else onConnectTask(task.id);
                return;
              }
              onOpenTaskDetail(task);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (!connectMode) onOpenTaskDetail(task);
              }
            }}
          >
            <svg viewBox="0 0 20 20" className="h-7 w-7 drop-shadow-sm">
              <polygon points="10,1.5 18.5,10 10,18.5 1.5,10" fill={barColor} stroke={alertDecoration.borderColor} strokeWidth="1.2" />
            </svg>
          </button>
          <div
            className="absolute top-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white shadow-sm"
            style={{ left: dayWidth / 2 + 14 }}
          >
            {task.progress}%
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label={`${task.name}: ${formatScheduleDate(displayStartDate)}から${formatScheduleDate(displayEndDate)} 進捗${task.progress}%`}
          className={`absolute rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
            isDragging ? "cursor-grabbing opacity-85" : "cursor-pointer hover:-translate-y-px"
          } ${isConnectFrom ? "ring-2 ring-violet-500 ring-offset-1" : ""}`}
          style={{
            left: left + 3,
            top: 10,
            width: Math.max(width - 6, 20),
            height: rowHeight - 20,
            background: `linear-gradient(90deg, ${barColor} 0%, ${barColor} 74%, ${barColor}dd 100%)`,
            borderColor: alertDecoration.borderColor,
            boxShadow: alertDecoration.boxShadow,
            ...(task.isDateEstimated ? { borderStyle: "dashed" as const, borderWidth: "2px" } : {}),
            userSelect: "none",
          }}
          title={`${task.name}: ${formatScheduleDate(displayStartDate)} - ${formatScheduleDate(displayEndDate)} (${task.progress}%)`}
          onMouseDown={(event) => {
            if (!connectMode) onTaskDragStart(task, event);
          }}
          onClick={(e) => {
            if (connectMode) {
              e.stopPropagation();
              if (!connectState) onSetConnectState({ fromTaskId: task.id });
              else onConnectTask(task.id);
              return;
            }
            if (!dragRef.current) onOpenTaskDetail(task);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!connectMode) onOpenTaskDetail(task);
            }
          }}
        >
          {task.progress > 0 && (
            <div className="absolute inset-y-0 left-0 rounded-l-lg bg-white/22" style={{ width: `${Math.min(task.progress, 100)}%` }} />
          )}
          <div className="absolute inset-0 flex items-center justify-between gap-2 px-3 text-white">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold">{task.name}</p>
              {width >= 148 && (
                <p className="truncate text-[10px] font-medium text-white/75">
                  {formatScheduleDate(displayStartDate)} - {formatScheduleDate(displayEndDate)}
                </p>
              )}
            </div>
            {showInlineProgress && (
              <span className="shrink-0 rounded-full border border-white/30 bg-white/18 px-2 py-1 text-[11px] font-bold tabular-nums">
                {task.progress}%
              </span>
            )}
          </div>
          {!showInlineProgress && (
            <span
              className="absolute top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold tabular-nums text-slate-700 shadow-sm"
              style={{ left: Math.max(width + 8, 52) }}
            >
              {task.progress}%
            </span>
          )}
          {!connectMode && (
            <div
              className="absolute right-0 top-0 flex h-full w-4 items-center justify-center rounded-r-lg bg-black/8"
              title="ドラッグで工期を変更"
              onMouseDown={(event) => onTaskResizeStart(task, event)}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-4 w-1 rounded-full bg-white/65" />
            </div>
          )}
          {connectMode && (
            <>
              <div
                className={`absolute left-0 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
                  connectState ? "border-violet-400 bg-violet-200" : "border-white/70 bg-white"
                }`}
                title="接続先"
              />
              <div
                className={`absolute right-0 top-1/2 h-5 w-5 translate-x-1/2 -translate-y-1/2 rounded-full border-2 cursor-pointer ${
                  isConnectFrom ? "border-violet-700 bg-violet-500" : "border-violet-300 bg-violet-100"
                }`}
                title="接続元"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!connectState) onSetConnectState({ fromTaskId: task.id });
                }}
              />
            </>
          )}
        </div>
      )}

      {task.leadTimeDays && task.startDate && (() => {
        const orderDeadline = addDays(task.startDate, -task.leadTimeDays);
        const markerOffset = daysBetween(chartStart, orderDeadline);
        if (markerOffset < 0) return null;
        return (
          <div
            key="order-marker"
            className="absolute pointer-events-none z-30"
            style={{ left: markerOffset * dayWidth + dayWidth / 2 - 6, top: 4 }}
            title={`発注期限: ${formatScheduleDate(orderDeadline)}`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <polygon
                points="6,0 12,12 0,12"
                fill={orderDeadline < today ? "#ef4444" : "#f59e0b"}
                opacity="0.95"
                style={{ transform: "rotate(180deg)", transformOrigin: "6px 6px" }}
              />
            </svg>
          </div>
        );
      })()}
    </div>
  );
}

type GanttTaskLabelProps = {
  task: GanttTask;
  today: string;
  connectMode: boolean;
  onOpenTaskDetail: (task: GanttTask) => void;
};

export function GanttTaskLabel({ task, today, connectMode, onOpenTaskDetail }: GanttTaskLabelProps) {
  const { rowHeight } = gantt;
  const alertLevel = getAlertLevel(task, today);
  const metaText = `${formatScheduleDate(task.startDate)} - ${formatScheduleDate(task.endDate)}`;
  const secondaryText = task.contractorName ? `${task.contractorName} ・ ${metaText}` : metaText;

  return (
    <div
      className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 transition-colors hover:bg-slate-50/80"
      style={{ minHeight: rowHeight }}
      onClick={() => {
        if (!connectMode) onOpenTaskDetail(task);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !connectMode) {
          e.preventDefault();
          onOpenTaskDetail(task);
        }
      }}
      aria-label={`${task.name}を編集`}
    >
      <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: statusColor[task.status] }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-800">{task.name}</p>
          {task.isMilestone && (
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">マイルストーン</span>
          )}
        </div>
        <p className="truncate text-xs text-slate-500">{secondaryText}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className="rounded-full px-2 py-1 text-[11px] font-semibold"
          style={{ backgroundColor: `${statusColor[task.status]}18`, color: statusColor[task.status] }}
        >
          {statusLabel[task.status]}
        </span>
        {alertLevel === "overdue" && <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">遅延</span>}
        {alertLevel === "urgent" && <span className="rounded-full bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-700">本日</span>}
        {alertLevel === "soon" && <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">3日以内</span>}
        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold tabular-nums shadow-sm" style={{ color: progressColor(task.progress) }}>
          {task.progress}%
        </span>
      </div>
    </div>
  );
}
