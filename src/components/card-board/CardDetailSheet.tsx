/**
 * CardDetailSheet.tsx（laporta-beads-8i1wq: カードボードのモバイル操作 Pointer Events化）
 *
 * カードのタップ、またはカード上の「⋯」メニューから開く読み取り主体のシート。
 * モバイルでは7pxの接続ポートをドラッグする代わりに、ここから
 * 「この工程の後に追加」を選んで後続タスクを一覧から選択する接続方式を既定にする。
 * 線を直接ドラッグする接続（ポート操作）はデスクトップ向け上級操作として残す。
 */
import { useState } from "react";
import type { Task, TaskStatus } from "../../domain/types.js";
import { effectiveProgress, formatDateShort, statusLabel } from "../gantt/utils.js";

type Props = {
  task: Task;
  /** 接続候補（自分自身・既存の先行工程は呼び出し元でフィルタ済み想定なし。ここでも念のため除外する） */
  otherTasks: Task[];
  onClose: () => void;
  onConnectAfter: (successorId: string) => void;
  onRemoveDependency: (predecessorId: string) => void;
};

const statusDotColor: Record<TaskStatus, string> = {
  todo: "#94a3b8",
  in_progress: "#2563eb",
  done: "#587b56",
};

export function CardDetailSheet({ task, otherTasks, onClose, onConnectAfter, onRemoveDependency }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const predecessors = (task.dependencies ?? [])
    .map((id) => otherTasks.find((t) => t.id === id))
    .filter((t): t is Task => t != null);

  const connectableTasks = otherTasks.filter((t) => t.id !== task.id);

  return (
    <div
      data-testid="card-detail-sheet"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl bg-white shadow-2xl"
        style={{ maxHeight: "85dvh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 px-4 pb-3 pt-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: statusDotColor[task.status] }}
              />
              <span className="text-sm font-semibold" style={{ color: statusDotColor[task.status] }}>
                {statusLabel[task.status]}
                {effectiveProgress(task) > 0 && ` · ${effectiveProgress(task)}%`}
              </span>
            </div>
            <h3 className="mt-1 truncate text-base font-bold text-slate-900">{task.name}</h3>
          </div>
          <button
            type="button"
            data-testid="card-detail-close"
            onClick={onClose}
            className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
            style={{ minHeight: 44, minWidth: 44 }}
          >
            閉じる
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {task.description && (
            <p className="mb-3 whitespace-pre-wrap text-sm text-slate-600">{task.description}</p>
          )}

          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            {task.startDate && task.dueDate && (
              <span>{formatDateShort(task.startDate)} 〜 {formatDateShort(task.dueDate)}</span>
            )}
            {task.leadTimeDays != null && <span className="text-amber-600">発注リードタイム {task.leadTimeDays}日</span>}
          </div>

          <div className="mb-3">
            <div className="mb-1 text-xs font-semibold text-slate-500">先行工程</div>
            {predecessors.length === 0 ? (
              <p className="text-sm text-slate-400">なし</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {predecessors.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <span className="truncate text-sm text-slate-700">{p.name}</span>
                    <button
                      type="button"
                      data-testid={`remove-dependency-${p.id}`}
                      onClick={() => onRemoveDependency(p.id)}
                      className="shrink-0 rounded-md px-2 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
                      style={{ minHeight: 44 }}
                    >
                      外す
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {pickerOpen && (
            <div className="mb-3 rounded-lg border border-slate-200 p-2">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-slate-500">後続タスクを選択</span>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100"
                >
                  キャンセル
                </button>
              </div>
              {connectableTasks.length === 0 ? (
                <p className="px-1 py-2 text-sm text-slate-400">接続できるタスクがありません</p>
              ) : (
                <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                  {connectableTasks.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        data-testid={`connect-after-target-${t.id}`}
                        onClick={() => {
                          onConnectAfter(t.id);
                          setPickerOpen(false);
                        }}
                        className="w-full truncate rounded-md px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-brand-50"
                        style={{ minHeight: 44 }}
                      >
                        {t.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-4 pb-6 pt-3">
          <button
            type="button"
            data-testid="connect-after-open"
            onClick={() => setPickerOpen((v) => !v)}
            className="w-full rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600"
            style={{ minHeight: 48 }}
          >
            この工程の後に追加
          </button>
        </div>
      </div>
    </div>
  );
}
