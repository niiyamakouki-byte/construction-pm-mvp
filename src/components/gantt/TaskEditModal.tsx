import { useEffect } from "react";
import type { Contractor } from "../../domain/types.js";
import type { TaskDetailState } from "./types.js";
import { addDays, statusLabel } from "./utils.js";

type Props = {
  taskDetail: TaskDetailState;
  contractors: Contractor[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (updater: (d: TaskDetailState) => TaskDetailState) => void;
  onDelete?: (taskId: string) => void;
};

export function TaskEditModal({
  taskDetail,
  contractors,
  onClose,
  onSubmit,
  onChange,
  onDelete,
}: Props) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="sheet-backdrop fixed inset-0 z-[70] bg-slate-950/40" onClick={onClose}>
      <div
        className="sheet-panel safe-bottom absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-[28px] bg-white px-4 pb-6 pt-3 shadow-[0_-24px_60px_rgba(15,23,42,0.22)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="タスクを編集"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">タスク編集</p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">{taskDetail.task.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500"
            aria-label="編集シートを閉じる"
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

        <form
          onSubmit={onSubmit}
          className="sheet-scroll flex max-h-[78dvh] flex-col gap-3 overflow-y-auto pr-1"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">工程名</span>
              <input
                type="text"
                value={taskDetail.editName}
                onChange={(event) => onChange((detail) => ({ ...detail, editName: event.target.value }))}
                required
                maxLength={200}
                autoFocus
                className="rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">協力会社</span>
              <select
                value={taskDetail.editContractorId}
                onChange={(event) => onChange((detail) => ({ ...detail, editContractorId: event.target.value }))}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="">未設定</option>
                {contractors.map((contractor) => (
                  <option key={contractor.id} value={contractor.id}>
                    {contractor.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">開始日</span>
              <input
                type="date"
                value={taskDetail.editStartDate}
                onChange={(event) => onChange((detail) => ({ ...detail, editStartDate: event.target.value }))}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">終了日</span>
              <input
                type="date"
                value={taskDetail.editDueDate}
                onChange={(event) => onChange((detail) => ({ ...detail, editDueDate: event.target.value }))}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">担当者</span>
              <input
                type="text"
                value={taskDetail.editAssigneeId}
                onChange={(event) => onChange((detail) => ({ ...detail, editAssigneeId: event.target.value }))}
                placeholder="任意"
                maxLength={100}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">発注リードタイム</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={365}
                value={taskDetail.editLeadTimeDays}
                onChange={(event) => onChange((detail) => ({ ...detail, editLeadTimeDays: event.target.value }))}
                placeholder="0"
                className="rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </label>
          </div>

          {taskDetail.editLeadTimeDays && taskDetail.editStartDate && (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              発注期限: {addDays(taskDetail.editStartDate, -Number(taskDetail.editLeadTimeDays))}
            </p>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">必要材料</span>
            <input
              type="text"
              value={taskDetail.editMaterials}
              onChange={(event) => onChange((detail) => ({ ...detail, editMaterials: event.target.value }))}
              placeholder="例: 軽量鉄骨, ボード, ビス"
              className="rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </label>

          <div className="rounded-3xl bg-slate-50 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-600">進捗</span>
              <span className="text-lg font-bold tabular-nums text-slate-900">
                {taskDetail.editProgress}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={taskDetail.editProgress}
              onChange={(event) => onChange((detail) => ({ ...detail, editProgress: Number(event.target.value) }))}
              className="mt-3 w-full accent-brand-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["todo", "in_progress", "done"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => onChange((detail) => ({ ...detail, editStatus: status }))}
                className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors ${
                  taskDetail.editStatus === status
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                {statusLabel[status]}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            {onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`「${taskDetail.task.name}」を削除しますか？`)) {
                    onDelete(taskDetail.task.id);
                  }
                }}
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-red-600"
              >
                削除
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={taskDetail.saving}
                className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
              >
                {taskDetail.saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
