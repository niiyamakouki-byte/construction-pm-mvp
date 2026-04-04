import type { GanttTask, DragState, ConnectState } from "./types.js";
import { getAlertLevel, statusColor, progressColor, getAssigneeInitial, daysBetween, addDays } from "./utils.js";
import { gantt, colors } from "../../theme/index.js";

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
  onSetDragState: (state: DragState | null) => void;
  onOpenTaskDetail: (task: GanttTask) => void;
  onSetConnectState: (state: ConnectState | null) => void;
  onConnectTask: (toTaskId: string) => void;
};

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
  onSetDragState,
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
  const width = duration * dayWidth;
  const alertLevel = getAlertLevel(task, today);

  let barBg = statusColor[task.status];
  if (alertLevel === "overdue") barBg = colors.danger;
  else if (alertLevel === "urgent") barBg = "#f97316";
  else if (alertLevel === "soon") barBg = colors.warning;

  const isConnectFrom = connectState?.fromTaskId === task.id;

  return (
    <div
      className="relative border-b border-slate-50"
      style={{ height: rowHeight }}
    >
      {/* Grid column highlights */}
      {highlightedDates.map((di) => {
        const offset = daysBetween(chartStart, di.date);
        const weekendClass =
          di.isWeekend && !task.projectIncludesWeekends
            ? "bg-slate-200/70"
            : di.isToday
              ? "bg-red-50/30"
              : "bg-slate-50/50";
        return (
          <div
            key={di.date}
            className={`absolute top-0 h-full ${weekendClass}`}
            style={{ left: offset * dayWidth, width: dayWidth }}
          />
        );
      })}

      {/* Milestone diamond */}
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
          title={`${task.name}: ${task.startDate}${task.isDateEstimated ? " (推定)" : ""} — クリックで編集`}
          onClick={() => {
            if (connectMode) {
              if (!connectState) {
                onSetConnectState({ fromTaskId: task.id });
              } else {
                onConnectTask(task.id);
              }
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
          <svg viewBox="0 0 20 20" className="h-5 w-5 drop-shadow-sm hover:drop-shadow-md transition-all">
            <polygon
              points="10,1 19,10 10,19 1,10"
              fill={colors.warning}
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
          aria-label={`${task.name}: ${displayStartDate} から ${displayEndDate}${task.isDateEstimated ? " (推定)" : ""} (${task.progress}%)`}
          className={`absolute rounded-md shadow-sm transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 ${
            isDragging ? "opacity-80 shadow-lg cursor-grabbing" : "hover:shadow-md hover:brightness-110"
          } ${isConnectFrom ? "ring-2 ring-violet-500 ring-offset-1" : ""}`}
          style={{
            left: left + 2,
            top: 8,
            width: Math.max(width - 4, 8),
            height: rowHeight - 16,
            backgroundColor: barBg,
            opacity: task.status === "done" ? 0.6 : 0.9,
            ...(task.isDateEstimated
              ? {
                  border: "2px dashed rgba(255,255,255,0.5)",
                  boxSizing: "border-box" as const,
                }
              : {}),
            userSelect: "none",
          }}
          title={`${task.name}: ${displayStartDate} ~ ${displayEndDate} (${task.progress}%)${task.isDateEstimated ? " (推定)" : ""} — ドラッグで移動、右端をドラッグで日数変更`}
          onMouseDown={(e) => {
            if (connectMode) return;
            if (e.button !== 0) return;
            e.preventDefault();
            const newDrag: DragState = {
              taskId: task.id,
              type: "move",
              startX: e.clientX,
              originalStartDate: task.startDate,
              originalEndDate: task.endDate,
              previewStartDate: task.startDate,
              previewEndDate: task.endDate,
            };
            dragRef.current = newDrag;
            onSetDragState(newDrag);
          }}
          onClick={(e) => {
            if (connectMode) {
              e.stopPropagation();
              if (!connectState) {
                onSetConnectState({ fromTaskId: task.id });
              } else {
                onConnectTask(task.id);
              }
              return;
            }
            if (dragRef.current) return;
            onOpenTaskDetail(task);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!connectMode) onOpenTaskDetail(task);
            }
          }}
        >
          {/* Progress fill */}
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
            <span className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold text-white truncate z-10 pointer-events-none">
              {task.name}
              {width > 130 && (
                <span className="ml-auto text-[9px] opacity-80 shrink-0">
                  {task.progress}%
                </span>
              )}
            </span>
          )}

          {/* Resize handle */}
          {!connectMode && (
            <div
              className="absolute right-0 top-0 h-full w-3 cursor-ew-resize flex items-center justify-center z-20"
              title="ドラッグで工期を伸縮"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const newDrag: DragState = {
                  taskId: task.id,
                  type: "resize",
                  startX: e.clientX,
                  originalStartDate: task.startDate,
                  originalEndDate: task.endDate,
                  previewStartDate: task.startDate,
                  previewEndDate: task.endDate,
                };
                dragRef.current = newDrag;
                onSetDragState(newDrag);
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-4 w-1 rounded-full bg-white/40" />
            </div>
          )}

          {/* Connect mode connector points */}
          {connectMode && (
            <>
              <div
                className={`absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 z-30 ${
                  connectState ? "border-violet-400 bg-violet-200 cursor-pointer" : "border-slate-300 bg-white"
                }`}
                title="接続先（この点をクリック）"
              />
              <div
                className={`absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 z-30 cursor-pointer ${
                  isConnectFrom ? "border-violet-600 bg-violet-400" : "border-violet-400 bg-violet-200 hover:bg-violet-300"
                }`}
                title="接続元としてこのタスクを選択"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!connectState) {
                    onSetConnectState({ fromTaskId: task.id });
                  }
                }}
              />
            </>
          )}
        </div>
      )}

      {/* Material order deadline marker */}
      {task.leadTimeDays && task.startDate && (() => {
        const orderDeadline = addDays(task.startDate, -task.leadTimeDays);
        const markerOffset = daysBetween(chartStart, orderDeadline);
        if (markerOffset < 0) return null;
        const isOverdue = orderDeadline < today;
        return (
          <div
            key="order-marker"
            className="absolute pointer-events-none z-30"
            style={{
              left: markerOffset * dayWidth + dayWidth / 2 - 5,
              top: 2,
            }}
            title={`発注期限: ${orderDeadline}`}
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <polygon
                points="5,0 10,10 0,10"
                fill={isOverdue ? colors.danger : colors.warning}
                opacity="0.9"
                style={{ transform: "rotate(180deg)", transformOrigin: "5px 5px" }}
              />
            </svg>
          </div>
        );
      })()}
    </div>
  );
}

// Task label row (left panel)
type GanttTaskLabelProps = {
  task: GanttTask;
  today: string;
  connectMode: boolean;
  onOpenTaskDetail: (task: GanttTask) => void;
};

export function GanttTaskLabel({ task, today, connectMode, onOpenTaskDetail }: GanttTaskLabelProps) {
  const { rowHeight } = gantt;
  const initial = getAssigneeInitial(task.assigneeId);
  const alertLevel = getAlertLevel(task, today);

  return (
    <div
      className="flex items-center border-b border-slate-100 px-3 gap-2 cursor-pointer hover:bg-slate-50 transition-colors"
      style={{ height: rowHeight }}
      onClick={() => {
        if (connectMode) return;
        onOpenTaskDetail(task);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" && !connectMode) onOpenTaskDetail(task); }}
      aria-label={`${task.name}を編集`}
    >
      {/* Assignee avatar */}
      {initial ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">
          {initial}
        </span>
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-400">
          --
        </span>
      )}
      {/* Task name */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">
          {task.isMilestone && (
            <svg className="mr-1 inline h-2.5 w-2.5 -mt-0.5" viewBox="0 0 12 12" aria-hidden="true">
              <polygon points="6,0 12,6 6,12 0,6" fill={colors.warning} />
            </svg>
          )}
          {task.name}
        </p>
        <p className="truncate text-xs text-slate-400">
          {task.contractorName
            ? <span className="text-brand-500">{task.contractorName}</span>
            : task.projectName}
        </p>
      </div>
      {/* Alert badge */}
      {alertLevel === "overdue" && (
        <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-600">
          遅延
        </span>
      )}
      {alertLevel === "urgent" && (
        <span className="shrink-0 rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-bold text-orange-600">
          今日
        </span>
      )}
      {alertLevel === "soon" && (
        <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-600">
          3日
        </span>
      )}
      {/* Progress % */}
      {alertLevel === null && (
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums"
          style={{
            backgroundColor: `${progressColor(task.progress)}15`,
            color: progressColor(task.progress),
          }}
        >
          {task.progress}%
        </span>
      )}
    </div>
  );
}
