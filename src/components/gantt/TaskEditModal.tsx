import type { Contractor } from "../../domain/types.js";
import { navigate } from "../../hooks/useHashRouter.js";
import type { TaskDetailState } from "./types.js";
import { statusLabel, addDays } from "./utils.js";

type Props = {
  taskDetail: TaskDetailState;
  contractors: Contractor[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (updater: (d: TaskDetailState) => TaskDetailState) => void;
  onDelete?: (taskId: string) => void;
};

export function TaskEditModal({ taskDetail, contractors, onClose, onSubmit, onChange, onDelete }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-bold text-slate-900">タスク編集</h3>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            value={taskDetail.editName}
            onChange={(e) => onChange((d) => ({ ...d, editName: e.target.value }))}
            placeholder="タスク名 *"
            required
            maxLength={200}
            autoFocus
            className="rounded-lg border border-slate-300 px-3 py-3 text-base focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
            style={{ minHeight: 48 }}
          />
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-sm font-medium text-slate-600">開始日</label>
              <input
                type="date"
                value={taskDetail.editStartDate}
                onChange={(e) => onChange((d) => ({ ...d, editStartDate: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-3 text-base focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
                style={{ minHeight: 48 }}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-sm font-medium text-slate-600">終了日</label>
              <input
                type="date"
                value={taskDetail.editDueDate}
                onChange={(e) => onChange((d) => ({ ...d, editDueDate: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-3 text-base focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
                style={{ minHeight: 48 }}
              />
            </div>
          </div>
          <input
            type="text"
            value={taskDetail.editAssigneeId}
            onChange={(e) => onChange((d) => ({ ...d, editAssigneeId: e.target.value }))}
            placeholder="担当者名（任意）"
            maxLength={100}
            className="rounded-lg border border-slate-300 px-3 py-3 text-base focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
            style={{ minHeight: 48 }}
          />
          {contractors.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-600">業者</label>
              <select
                value={taskDetail.editContractorId}
                onChange={(e) => onChange((d) => ({ ...d, editContractorId: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-3 text-base focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none bg-white"
                style={{ minHeight: 48 }}
              >
                <option value="">-- 業者なし --</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          {/* Materials */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-600">必要材料（カンマ区切り）</label>
            <input
              type="text"
              value={taskDetail.editMaterials}
              onChange={(e) => onChange((d) => ({ ...d, editMaterials: e.target.value }))}
              placeholder="例: タイル, 接着剤, グラウト"
              className="rounded-lg border border-slate-300 px-3 py-3 text-base focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
              style={{ minHeight: 48 }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-600">
              発注リードタイム（日）
              {taskDetail.editLeadTimeDays && taskDetail.editStartDate && (
                <span className="ml-2 text-brand-600">
                  → 発注期限: {addDays(taskDetail.editStartDate, -Number(taskDetail.editLeadTimeDays))}
                </span>
              )}
            </label>
            <input
              type="number"
              min={0}
              max={365}
              value={taskDetail.editLeadTimeDays}
              onChange={(e) => onChange((d) => ({ ...d, editLeadTimeDays: e.target.value }))}
              placeholder="0"
              className="rounded-lg border border-slate-300 px-3 py-3 text-base focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
              style={{ minHeight: 48 }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-600">
              進捗 {taskDetail.editProgress}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={taskDetail.editProgress}
              onChange={(e) => onChange((d) => ({ ...d, editProgress: Number(e.target.value) }))}
              className="w-full accent-brand-500"
            />
          </div>
          <div className="flex gap-2">
            {(["todo", "in_progress", "done"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange((d) => ({ ...d, editStatus: s }))}
                className={`flex-1 rounded-lg border px-2 py-3 text-sm font-semibold transition-colors ${
                  taskDetail.editStatus === s
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
                style={{ minHeight: 48 }}
              >
                {statusLabel[s]}
              </button>
            ))}
          </div>
          <div className="flex justify-between gap-2 pt-1">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate(`/project/${taskDetail.task.projectId}`)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 transition-colors"
                style={{ minHeight: 48 }}
              >
                詳細ページへ
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`「${taskDetail.task.name}」を削除しますか？この操作は取り消せません。`)) {
                      onDelete(taskDetail.task.id);
                    }
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                  style={{ minHeight: 48 }}
                >
                  削除
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-5 py-3 text-base font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                style={{ minHeight: 48 }}
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={taskDetail.saving}
                className="rounded-lg bg-brand-500 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
                style={{ minHeight: 60 }}
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
