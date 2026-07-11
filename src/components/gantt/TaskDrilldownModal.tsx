import { useEffect } from "react";
import type { GanttTask } from "./types.js";
import { effectiveProgress, formatScheduleDate, statusColor, statusLabel } from "./utils.js";

type Props = {
  task: GanttTask;
  onClose: () => void;
  onEdit: () => void;
};

export function TaskDrilldownModal({ task, onClose, onEdit }: Props) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const duration = (() => {
    const start = new Date(`${task.startDate}T00:00:00`);
    const end = new Date(`${task.endDate}T00:00:00`);
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    return `${days}日間`;
  })();

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="タスク詳細"
        className="safe-bottom w-full max-w-sm rounded-t-[28px] bg-white px-4 pb-6 pt-3 shadow-[0_-24px_60px_rgba(15,23,42,0.22)] sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* drag handle */}
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />

        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {task.majorCategory && (
              <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">
                {task.majorCategory}
                {task.middleCategory ? ` / ${task.middleCategory}` : ""}
              </p>
            )}
            <h3 className="mt-1 truncate text-xl font-bold text-slate-900">{task.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"
            aria-label="詳細パネルを閉じる"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          {/* Status + Progress row */}
          <div className="flex items-center gap-3">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: statusColor[task.status] }}
            >
              {statusLabel[task.status]}
            </span>
            <div className="flex flex-1 items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${effectiveProgress(task)}%`,
                    backgroundColor: statusColor[task.status],
                  }}
                />
              </div>
              <span className="text-sm font-semibold tabular-nums text-slate-700">{effectiveProgress(task)}%</span>
            </div>
          </div>

          {/* Date range */}
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500">期間</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatScheduleDate(task.startDate)}
              {" "}〜{" "}
              {formatScheduleDate(task.endDate)}
              <span className="ml-2 text-xs font-normal text-slate-500">({duration})</span>
            </p>
          </div>

          {/* Contractor */}
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500">業者</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {task.contractorName ?? "未設定"}
            </p>
          </div>

          {/* Assignee */}
          {task.assigneeId && (
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500">担当者</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{task.assigneeId}</p>
            </div>
          )}

          {/* Materials */}
          {task.materials && task.materials.length > 0 && (
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500">資材</p>
              <p className="mt-1 text-sm text-slate-900">{task.materials.join(", ")}</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="mt-5 w-full rounded-2xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          編集する
        </button>
      </div>
    </div>
  );
}
