import { useEffect, useRef } from "react";
import type { QuickAddState } from "./gantt/types.js";
import { addDays } from "./gantt/utils.js";
import { WORK_CATEGORIES } from "./gantt/workCategories.js";

type Props = {
  quickAdd: QuickAddState;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (updater: (q: QuickAddState) => QuickAddState) => void;
};

export function QuickAddSheet({ quickAdd, onClose, onSubmit, onChange }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);

  // Block background scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleDragStart(e: React.TouchEvent | React.MouseEvent) {
    const y = "touches" in e ? e.touches[0].clientY : e.clientY;
    startYRef.current = y;
    dragOffsetRef.current = 0;
  }

  function handleDragMove(e: React.TouchEvent | React.MouseEvent) {
    if (startYRef.current === null) return;
    const y = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const offset = Math.max(0, y - startYRef.current);
    dragOffsetRef.current = offset;
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${offset}px)`;
    }
  }

  function handleDragEnd() {
    if (dragOffsetRef.current > 80) {
      onClose();
    } else {
      if (sheetRef.current) {
        sheetRef.current.style.transform = "translateY(0)";
      }
    }
    startYRef.current = null;
    dragOffsetRef.current = 0;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
      style={{ backdropFilter: "blur(2px)" }}
    >
      <div
        ref={sheetRef}
        className="w-full max-w-lg rounded-t-2xl bg-white shadow-2xl"
        style={{
          animation: "slideUpSheet 0.25s ease-out",
          transition: "transform 0.15s ease-out",
          maxHeight: "92dvh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          className="flex shrink-0 flex-col items-center px-4 pb-2 pt-3 touch-none select-none cursor-grab"
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <div className="h-1.5 w-10 rounded-full bg-slate-300" />
          <h3 className="mt-3 text-base font-bold text-slate-900">
            タスクを追加 — {quickAdd.projectName}
          </h3>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-1">
          <form id="quick-add-sheet-form" onSubmit={onSubmit} className="flex flex-col gap-3">
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
                  onChange((q) => ({ ...q, selectedCategory: val, name: item.name, dueDate: newDueDate }));
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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

            {/* Task name */}
            <input
              type="text"
              value={quickAdd.name}
              onChange={(e) => onChange((q) => ({ ...q, name: e.target.value }))}
              placeholder="タスク名 *"
              required
              maxLength={200}
              autoFocus
              className="rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              style={{ minHeight: 48 }}
            />

            {/* Dates */}
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
                  className="rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  style={{ minHeight: 48 }}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-sm font-medium text-slate-600">終了日</label>
                <input
                  type="date"
                  value={quickAdd.dueDate}
                  onChange={(e) => onChange((q) => ({ ...q, dueDate: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  style={{ minHeight: 48 }}
                />
              </div>
            </div>

            {/* Assignee */}
            <input
              type="text"
              value={quickAdd.assigneeId}
              onChange={(e) => onChange((q) => ({ ...q, assigneeId: e.target.value }))}
              placeholder="担当者名（任意）"
              maxLength={100}
              className="rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              style={{ minHeight: 48 }}
            />
          </form>
        </div>

        {/* Action buttons */}
        <div className="shrink-0 border-t border-slate-100 px-4 pb-8 pt-3">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-5 py-3 text-base font-medium text-slate-600 transition-colors hover:bg-slate-100"
              style={{ minHeight: 48 }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              form="quick-add-sheet-form"
              disabled={quickAdd.submitting}
              className="rounded-lg bg-brand-500 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
              style={{ minHeight: 48 }}
            >
              {quickAdd.submitting ? "追加中..." : "追加"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
