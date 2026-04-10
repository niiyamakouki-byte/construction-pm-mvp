import { useEffect, useMemo } from "react";
import type { Contractor, TaskStatus } from "../../domain/types.js";
import {
  getCategories,
  getSubCategories,
  searchCategories,
} from "../../lib/task-categories.js";
import type { QuickAddState } from "./types.js";
import { addDaysBySchedule, statusLabel } from "./utils.js";
import { WORK_CATEGORIES } from "./workCategories.js";

type Props = {
  quickAdd: QuickAddState;
  contractors: Contractor[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (updater: (q: QuickAddState) => QuickAddState) => void;
};

export function QuickAddForm({ quickAdd, contractors, onClose, onSubmit, onChange }: Props) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const majorList = useMemo(() => getCategories(), []);
  const middleList = useMemo(
    () => (quickAdd.majorCategory ? getCategories(quickAdd.majorCategory) : []),
    [quickAdd.majorCategory],
  );
  const minorList = useMemo(
    () =>
      quickAdd.majorCategory && quickAdd.middleCategory
        ? getSubCategories(quickAdd.majorCategory, quickAdd.middleCategory)
        : [],
    [quickAdd.majorCategory, quickAdd.middleCategory],
  );

  const searchResults = useMemo(
    () => (quickAdd.categorySearch.trim() ? searchCategories(quickAdd.categorySearch) : []),
    [quickAdd.categorySearch],
  );

  const applySearchResult = (major: string, middle: string, minor?: string) => {
    const label = minor ? `${middle} / ${minor}` : middle;
    onChange((state) => ({
      ...state,
      majorCategory: major,
      middleCategory: middle,
      minorCategory: minor ?? "",
      categorySearch: "",
      name: state.name || label,
    }));
  };

  return (
    <div className="sheet-backdrop fixed inset-0 z-[70] bg-slate-950/40" onClick={onClose}>
      <div
        className="sheet-panel safe-bottom absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-[28px] bg-white px-4 pb-6 pt-3 shadow-[0_-24px_60px_rgba(15,23,42,0.22)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="新しいタスクを追加"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">新規タスク</p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">{quickAdd.projectName}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500"
            aria-label="追加シートを閉じる"
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

        <form onSubmit={onSubmit} className="sheet-scroll flex max-h-[78dvh] flex-col gap-3 overflow-y-auto pr-1">
          {/* ── カテゴリ検索 ── */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">カテゴリ検索</span>
            <input
              type="text"
              value={quickAdd.categorySearch}
              onChange={(e) =>
                onChange((state) => ({ ...state, categorySearch: e.target.value }))
              }
              placeholder="例: 配線、フローリング、塗装..."
              aria-label="カテゴリ検索テキスト"
              className="rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            {searchResults.length > 0 && (
              <ul className="rounded-2xl border border-slate-200 bg-white shadow-md">
                {searchResults.slice(0, 8).map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => applySearchResult(r.major, r.middle, r.minor)}
                    >
                      <span className="font-semibold text-slate-700">{r.major}</span>
                      <span className="text-slate-400"> › </span>
                      <span className="text-slate-600">{r.middle}</span>
                      {r.minor && (
                        <>
                          <span className="text-slate-400"> › </span>
                          <span className="text-slate-500">{r.minor}</span>
                        </>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </label>

          {/* ── 3階層プルダウン ── */}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">大項目</span>
              <select
                value={quickAdd.majorCategory}
                onChange={(e) => {
                  const major = e.target.value;
                  onChange((state) => ({
                    ...state,
                    majorCategory: major,
                    middleCategory: "",
                    minorCategory: "",
                    name: state.name || major,
                  }));
                }}
                className="rounded-2xl border border-slate-300 px-3 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="">選択...</option>
                {majorList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">中項目</span>
              <select
                value={quickAdd.middleCategory}
                disabled={!quickAdd.majorCategory}
                onChange={(e) => {
                  const middle = e.target.value;
                  onChange((state) => ({
                    ...state,
                    middleCategory: middle,
                    minorCategory: "",
                    name: state.name || (middle ? `${state.majorCategory} ${middle}` : state.majorCategory),
                  }));
                }}
                className="rounded-2xl border border-slate-300 px-3 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">選択...</option>
                {middleList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">小項目</span>
              <select
                value={quickAdd.minorCategory}
                disabled={!quickAdd.middleCategory || minorList.length === 0}
                onChange={(e) => {
                  const minor = e.target.value;
                  onChange((state) => ({
                    ...state,
                    minorCategory: minor,
                    name: minor || state.name,
                  }));
                }}
                className="rounded-2xl border border-slate-300 px-3 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">{minorList.length === 0 ? "なし" : "選択..."}</option>
                {minorList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* ── 既存テンプレート ── */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">テンプレート</span>
            <select
              value={quickAdd.selectedCategory}
              onChange={(event) => {
                const value = event.target.value;
                if (!value) {
                  onChange((state) => ({ ...state, selectedCategory: "" }));
                  return;
                }
                const [categoryIndex, itemIndex] = value.split(":").map(Number);
                const item = WORK_CATEGORIES[categoryIndex]?.items[itemIndex];
                if (!item) return;
                onChange((state) => ({
                  ...state,
                  selectedCategory: value,
                  name: item.name,
                  dueDate: addDaysBySchedule(
                    state.startDate,
                    item.defaultDays,
                    state.projectIncludesWeekends,
                  ),
                }));
              }}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">選択しない</option>
              {WORK_CATEGORIES.map((category, categoryIndex) => (
                <optgroup key={category.label} label={category.label}>
                  {category.items.map((item, itemIndex) => (
                    <option key={item.name} value={`${categoryIndex}:${itemIndex}`}>
                      {item.name}（標準{item.defaultDays}日）
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">工程名</span>
            <input
              type="text"
              value={quickAdd.name}
              onChange={(event) => onChange((state) => ({ ...state, name: event.target.value }))}
              placeholder="例: 軽量下地"
              required
              maxLength={200}
              autoFocus
              className="rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">協力会社</span>
              <select
                value={quickAdd.contractorId}
                onChange={(event) => onChange((state) => ({ ...state, contractorId: event.target.value }))}
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
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">状態</span>
              <select
                value={quickAdd.status}
                onChange={(event) => onChange((state) => ({ ...state, status: event.target.value as TaskStatus }))}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                {(["todo", "in_progress", "done"] as const).map((status) => (
                  <option key={status} value={status}>
                    {statusLabel[status]}
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
                value={quickAdd.startDate}
                onChange={(event) => {
                  const nextStartDate = event.target.value;
                  onChange((state) => {
                    if (state.selectedCategory && nextStartDate) {
                      const [categoryIndex, itemIndex] = state.selectedCategory.split(":").map(Number);
                      const item = WORK_CATEGORIES[categoryIndex]?.items[itemIndex];
                      if (item) {
                        return {
                          ...state,
                          startDate: nextStartDate,
                          dueDate: addDaysBySchedule(
                            nextStartDate,
                            item.defaultDays,
                            state.projectIncludesWeekends,
                          ),
                        };
                      }
                    }
                    return { ...state, startDate: nextStartDate };
                  });
                }}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">終了日</span>
              <input
                type="date"
                value={quickAdd.dueDate}
                onChange={(event) => onChange((state) => ({ ...state, dueDate: event.target.value }))}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={quickAdd.submitting}
              className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
            >
              {quickAdd.submitting ? "追加中..." : "追加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
