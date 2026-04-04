import type { QuickAddState } from "./types.js";
import { addDays } from "./utils.js";
import { WORK_CATEGORIES } from "./workCategories.js";

type Props = {
  quickAdd: QuickAddState;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (updater: (q: QuickAddState) => QuickAddState) => void;
};

export function QuickAddForm({ quickAdd, onClose, onSubmit, onChange }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-bold text-slate-900">
          タスクを追加 — {quickAdd.projectName}
        </h3>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          {/* Work item selector */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-600">作業項目を選ぶ（任意）</label>
            <select
              value={quickAdd.selectedCategory}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  onChange((q) => ({ ...q, selectedCategory: "" }));
                  return;
                }
                const [ci, ii] = val.split(":").map(Number);
                const category = WORK_CATEGORIES[ci];
                const item = category?.items[ii];
                if (!item) return;
                const newDueDate = addDays(quickAdd.startDate, item.defaultDays);
                onChange((q) => ({
                  ...q,
                  selectedCategory: val,
                  name: item.name,
                  dueDate: newDueDate,
                }));
              }}
              className="rounded-lg border border-slate-300 px-3 py-3 text-base focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none bg-white"
              style={{ minHeight: 48 }}
            >
              <option value="">-- カテゴリから選択 --</option>
              {WORK_CATEGORIES.map((cat, ci) => (
                <optgroup key={ci} label={cat.label}>
                  {cat.items.map((item, ii) => (
                    <option key={ii} value={`${ci}:${ii}`}>
                      {item.name}（標準{item.defaultDays}日）
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <input
            type="text"
            value={quickAdd.name}
            onChange={(e) => onChange((q) => ({ ...q, name: e.target.value }))}
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
                value={quickAdd.startDate}
                onChange={(e) => {
                  const newStart = e.target.value;
                  onChange((q) => {
                    if (q.selectedCategory && newStart) {
                      const [ci, ii] = q.selectedCategory.split(":").map(Number);
                      const item = WORK_CATEGORIES[ci]?.items[ii];
                      if (item) {
                        return { ...q, startDate: newStart, dueDate: addDays(newStart, item.defaultDays) };
                      }
                    }
                    return { ...q, startDate: newStart };
                  });
                }}
                className="rounded-lg border border-slate-300 px-3 py-3 text-base focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
                style={{ minHeight: 48 }}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-sm font-medium text-slate-600">終了日</label>
              <input
                type="date"
                value={quickAdd.dueDate}
                onChange={(e) => onChange((q) => ({ ...q, dueDate: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-3 text-base focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
                style={{ minHeight: 48 }}
              />
            </div>
          </div>
          <input
            type="text"
            value={quickAdd.assigneeId}
            onChange={(e) => onChange((q) => ({ ...q, assigneeId: e.target.value }))}
            placeholder="担当者名（任意）"
            maxLength={100}
            className="rounded-lg border border-slate-300 px-3 py-3 text-base focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
            style={{ minHeight: 48 }}
          />
          <div className="flex justify-end gap-2 pt-1">
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
              disabled={quickAdd.submitting}
              className="rounded-lg bg-brand-500 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
              style={{ minHeight: 60 }}
            >
              {quickAdd.submitting ? "追加中..." : "追加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
