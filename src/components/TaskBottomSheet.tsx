import { useEffect, useRef } from "react";
import type { Contractor } from "../domain/types.js";
import { navigate } from "../hooks/useHashRouter.js";
import type { TaskDetailState } from "./gantt/types.js";
import { statusLabel, addDays } from "./gantt/utils.js";

type Props = {
  taskDetail: TaskDetailState;
  contractors: Contractor[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (updater: (d: TaskDetailState) => TaskDetailState) => void;
  onDelete?: (taskId: string) => void;
};

export function TaskBottomSheet({ taskDetail, contractors, onClose, onSubmit, onChange, onDelete }: Props) {
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

  // Drag-to-dismiss on handle
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
          <h3 className="mt-3 text-base font-bold text-slate-900">タスク編集</h3>
        </div>

        {/* Scrollable form area */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-1">
          <form id="task-bottom-sheet-form" onSubmit={onSubmit} className="flex flex-col gap-3">
            {/* Task name */}
            <input
              type="text"
              value={taskDetail.editName}
              onChange={(e) => onChange((d) => ({ ...d, editName: e.target.value }))}
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
                  value={taskDetail.editStartDate}
                  onChange={(e) => onChange((d) => ({ ...d, editStartDate: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  style={{ minHeight: 48 }}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-sm font-medium text-slate-600">終了日</label>
                <input
                  type="date"
                  value={taskDetail.editDueDate}
                  onChange={(e) => onChange((d) => ({ ...d, editDueDate: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  style={{ minHeight: 48 }}
                />
              </div>
            </div>

            {/* Contractor */}
            {contractors.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-600">業者</label>
                <select
                  value={taskDetail.editContractorId}
                  onChange={(e) => onChange((d) => ({ ...d, editContractorId: e.target.value }))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  style={{ minHeight: 48 }}
                >
                  <option value="">-- 業者なし --</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Progress slider */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-600">
                進捗 <span className="text-brand-600 font-bold">{taskDetail.editProgress}%</span>
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

            {/* Status toggle */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-600">ステータス</label>
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
            </div>

            {/* Materials */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-600">必要材料（カンマ区切り）</label>
              <input
                type="text"
                value={taskDetail.editMaterials}
                onChange={(e) => onChange((d) => ({ ...d, editMaterials: e.target.value }))}
                placeholder="例: タイル, 接着剤, グラウト"
                className="rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                style={{ minHeight: 48 }}
              />
            </div>

            {/* Lead time */}
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
                inputMode="numeric"
                min={0}
                max={365}
                value={taskDetail.editLeadTimeDays}
                onChange={(e) => onChange((d) => ({ ...d, editLeadTimeDays: e.target.value }))}
                placeholder="0"
                className="rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                style={{ minHeight: 48 }}
              />
            </div>
          </form>
        </div>

        {/* Action buttons */}
        <div className="shrink-0 border-t border-slate-100 px-4 pb-8 pt-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(`/project/${taskDetail.task.projectId}`)}
              className="rounded-lg px-3 py-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100"
              style={{ minHeight: 48 }}
            >
              詳細へ
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`「${taskDetail.task.name}」を削除しますか？この操作は取り消せません。`)) {
                    onDelete(taskDetail.task.id);
                  }
                }}
                className="rounded-lg px-3 py-3 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
                style={{ minHeight: 48 }}
              >
                削除
              </button>
            )}
            <div className="flex-1" />
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
              form="task-bottom-sheet-form"
              disabled={taskDetail.saving}
              className="rounded-lg bg-brand-500 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
              style={{ minHeight: 48 }}
            >
              {taskDetail.saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
