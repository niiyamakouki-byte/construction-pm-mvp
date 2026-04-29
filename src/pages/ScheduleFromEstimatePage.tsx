/**
 * ScheduleFromEstimatePage — estimate確定 → 工程タスク自動展開 (Sprint 3-7)
 * v2-cozy: 装飾削減・余白とフォント階層・セージグリーン1色・絵文字最小
 */

import { useCallback, useMemo, useState } from "react";
import {
  estimateToTasks,
  groupTasksByCategory,
} from "../lib/estimate-to-tasks.js";
import type { ProjectTask } from "../lib/estimate-to-tasks.js";
import type { EstimateLine } from "../estimate/types.js";

// ── サンプル見積行（デモ用）──────────────────────────────────────────────────

const SAMPLE_LINES: EstimateLine[] = [
  { code: "DIS-001", name: "解体撤去工事",       unit: "式", quantity: 1, unitPrice: 150000, amount: 150000, note: "" },
  { code: "LGS-001", name: "LGS間仕切下地工事",  unit: "㎡", quantity: 30, unitPrice: 3500,  amount: 105000, note: "" },
  { code: "PB-001",  name: "石膏ボード張り工事", unit: "㎡", quantity: 60, unitPrice: 1800,  amount: 108000, note: "" },
  { code: "ELE-001", name: "電気配線工事",        unit: "式", quantity: 1, unitPrice: 120000, amount: 120000, note: "100V/200V" },
  { code: "PT-001",  name: "AEP塗装仕上げ",       unit: "㎡", quantity: 60, unitPrice: 1200,  amount: 72000,  note: "" },
  { code: "FL-001",  name: "フローリング張り",     unit: "㎡", quantity: 25, unitPrice: 8000,  amount: 200000, note: "オーク" },
  { code: "CL-001",  name: "クロス張り工事",       unit: "㎡", quantity: 80, unitPrice: 900,   amount: 72000,  note: "" },
  { code: "DR-001",  name: "建具取付工事",         unit: "箇所", quantity: 3, unitPrice: 25000, amount: 75000, note: "" },
  { code: "CLN-001", name: "清掃工事",             unit: "式", quantity: 1, unitPrice: 30000, amount: 30000,  note: "" },
];

// ── ステータスラベル ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ProjectTask["status"], string> = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了",
};

const STATUS_CLASS: Record<ProjectTask["status"], string> = {
  todo: "bg-slate-100 text-slate-600",
  in_progress: "bg-[#7BA88A]/15 text-[#5E8A6C]",
  done: "bg-emerald-50 text-emerald-600",
};

// ── サブコンポーネント ─────────────────────────────────────────────────────────

function TaskRow({
  task,
  onStatusChange,
}: {
  task: ProjectTask;
  onStatusChange: (id: string, status: ProjectTask["status"]) => void;
}) {
  const cycleStatus = useCallback(() => {
    const next: Record<ProjectTask["status"], ProjectTask["status"]> = {
      todo: "in_progress",
      in_progress: "done",
      done: "todo",
    };
    onStatusChange(task.id, next[task.status]);
  }, [task.id, task.status, onStatusChange]);

  return (
    <tr
      data-testid="task-row"
      className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors duration-[150ms]"
    >
      {/* 工事名 */}
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-slate-800 leading-snug">{task.name}</p>
        {task.note && (
          <p className="mt-0.5 text-xs text-slate-400 leading-tight">{task.note}</p>
        )}
      </td>

      {/* 工期 */}
      <td className="px-4 py-3 whitespace-nowrap">
        <p className="text-sm text-slate-700">{task.startDate}</p>
        <p className="text-xs text-slate-400">{task.durationDays}日間</p>
      </td>

      {/* 終了日 */}
      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
        {task.endDate}
      </td>

      {/* 状態（タップで切替） */}
      <td className="px-4 py-3">
        <button
          type="button"
          data-testid={`status-btn-${task.id}`}
          onClick={cycleStatus}
          className={`inline-block rounded-full px-3 py-1 text-xs font-medium transition-colors duration-[150ms] ${STATUS_CLASS[task.status]}`}
        >
          {STATUS_LABEL[task.status]}
        </button>
      </td>
    </tr>
  );
}

// ── メインページ ──────────────────────────────────────────────────────────────

export interface ScheduleFromEstimateProps {
  projectName?: string;
  projectStartDate?: string;
  /** Provide estimate lines externally (for testing / integration) */
  initialLines?: EstimateLine[];
}

export function ScheduleFromEstimatePage({
  projectName = "施工案件",
  projectStartDate: initialStart = new Date().toISOString().slice(0, 10),
  initialLines = SAMPLE_LINES,
}: ScheduleFromEstimateProps) {
  const [startDate, setStartDate] = useState(initialStart);
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, ProjectTask["status"]>>({});

  const { tasks: baseTasks, totalDays } = useMemo(
    () => estimateToTasks({ lines: initialLines, projectStartDate: startDate, skipWeekends }),
    [initialLines, startDate, skipWeekends],
  );

  // Apply local status overrides
  const tasks: ProjectTask[] = useMemo(
    () => baseTasks.map((t) => ({ ...t, status: statuses[t.id] ?? t.status })),
    [baseTasks, statuses],
  );

  const grouped = useMemo(() => groupTasksByCategory(tasks), [tasks]);

  const doneCount = tasks.filter((t) => t.status === "done").length;

  const handleStatusChange = useCallback((id: string, status: ProjectTask["status"]) => {
    setStatuses((prev) => ({ ...prev, [id]: status }));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── ヘッダー ── */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto max-w-4xl flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-800">工程表</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {projectName}
              <span className="mx-1.5 text-slate-300">|</span>
              全{tasks.length}工程 / 約{totalDays}日
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400">{doneCount}/{tasks.length}完了</span>

            {/* 開始日 */}
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              開始
              <input
                data-testid="start-date-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded border border-slate-200 px-2 py-1 text-xs focus:border-[#7BA88A] focus:outline-none"
              />
            </label>

            {/* 土日スキップ */}
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
              <input
                data-testid="skip-weekends-checkbox"
                type="checkbox"
                checked={skipWeekends}
                onChange={(e) => setSkipWeekends(e.target.checked)}
                className="accent-[#7BA88A]"
              />
              土日除く
            </label>
          </div>
        </div>
      </header>

      {/* ── コンテンツ ── */}
      <div className="mx-auto max-w-4xl px-4 py-5 space-y-6">
        {tasks.length === 0 && (
          <p className="text-sm text-slate-400 py-12 text-center">
            見積行がありません
          </p>
        )}

        {[...grouped.entries()].map(([category, categoryTasks]) => (
          <section key={category} aria-labelledby={`cat-${category}`}>
            <h2
              id={`cat-${category}`}
              className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide"
            >
              {category}
            </h2>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full border-collapse" data-testid="schedule-table">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">工事名</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">開始日</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">終了日</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
