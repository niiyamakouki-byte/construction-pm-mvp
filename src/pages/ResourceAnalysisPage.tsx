/**
 * P4: リソース分析ビュー
 * 担当者（協力会社）別の稼働時間・タスク数・稼働率を集計して表示する。
 * キャパシティ仮定: 1人1日8h固定（仕様書指示）
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { filterScheduleTasks } from "../lib/cost-management.js";
import { toLocalDateString } from "../components/gantt/utils.js";
import type { GanttTask } from "../components/gantt/types.js";
import type { Project } from "../domain/types.js";

const HOURS_PER_DAY = 8; // ponytail: 固定仮定、設定化しない

type PeriodUnit = "week" | "month";

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); // Monday
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addWeeks(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

function formatPeriodLabel(start: Date, unit: PeriodUnit): string {
  if (unit === "week") {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.getMonth() + 1}/${start.getDate()} 〜 ${end.getMonth() + 1}/${end.getDate()}`;
  }
  return `${start.getFullYear()}年${start.getMonth() + 1}月`;
}

function periodEnd(start: Date, unit: PeriodUnit): Date {
  if (unit === "week") {
    const d = new Date(start);
    d.setDate(d.getDate() + 6);
    return d;
  }
  const d = addMonths(start, 1);
  d.setDate(d.getDate() - 1);
  return d;
}

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 期間内の稼働日数（weekdays）を計算 */
function workdaysBetween(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

type ResourceRow = {
  name: string;
  hours: number;
  taskCount: number;
  capacityHours: number;
  utilizationPct: number;
};

/** タスクリストと期間から担当者別集計を計算 */
function computeResources(tasks: GanttTask[], periodStart: string, periodEnd_: string): ResourceRow[] {
  // 担当者 = contractorName（未設定は「未割当」）
  const map = new Map<string, { tasks: Set<string>; hours: number }>();

  for (const task of tasks) {
    // タスクが期間と重なるか判定
    const overlapStart = task.startDate > periodStart ? task.startDate : periodStart;
    const overlapEnd = task.endDate < periodEnd_ ? task.endDate : periodEnd_;
    if (overlapStart > overlapEnd) continue;

    const name = task.contractorName?.trim() || "未割当";
    const days = workdaysBetween(overlapStart, overlapEnd);
    const hours = days * HOURS_PER_DAY;

    const existing = map.get(name) ?? { tasks: new Set(), hours: 0 };
    existing.tasks.add(task.id);
    existing.hours += hours;
    map.set(name, existing);
  }

  // キャパシティ = 期間の稼働日数 × 8h（1人当たり）
  const totalWorkdays = workdaysBetween(periodStart, periodEnd_);
  const capacityPerPerson = totalWorkdays * HOURS_PER_DAY;

  return Array.from(map.entries())
    .map(([name, { tasks, hours }]) => ({
      name,
      hours,
      taskCount: tasks.size,
      capacityHours: capacityPerPerson,
      utilizationPct: capacityPerPerson > 0 ? Math.round((hours / capacityPerPerson) * 100) : 0,
    }))
    .sort((a, b) => b.hours - a.hours);
}

export function ResourceAnalysisPage() {
  const { organizationId } = useOrganizationContext();
  const projectRepository = useMemo(() => createProjectRepository(() => organizationId), [organizationId]);
  const taskRepository = useMemo(() => createTaskRepository(() => organizationId), [organizationId]);

  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<PeriodUnit>("week");
  const today = useMemo(() => new Date(), []);
  const [periodStart, setPeriodStart] = useState<Date>(() => getWeekStart(new Date()));

  const loadData = useCallback(async () => {
    try {
      const [allTasks, allProjects] = await Promise.all([
        taskRepository.findAll(),
        projectRepository.findAll(),
      ]);
      setProjects(allProjects);

      const projectMap = new Map(allProjects.map((p) => [p.id, p]));
      const todayStr = toLocalDateString(new Date());

      const nextTasks = filterScheduleTasks(allTasks).map((task) => {
        const project = projectMap.get(task.projectId);
        const startDate = task.startDate ?? task.dueDate ?? project?.startDate ?? todayStr;
        const endDate = task.dueDate ?? task.startDate ?? project?.endDate ?? todayStr;
        return {
          ...task,
          projectName: project?.name ?? "",
          startDate,
          endDate,
          isDateEstimated: !task.startDate,
          isMilestone: false,
          projectIncludesWeekends: project?.includeWeekends ?? true,
          contractorName: undefined as string | undefined,
        } satisfies GanttTask;
      });

      setGanttTasks(nextTasks);
    } finally {
      setLoading(false);
    }
  }, [taskRepository, projectRepository]);

  useEffect(() => { void loadData(); }, [loadData]);

  // 期間変更時に periodStart の型に合わせて週/月起点に切り替え
  const handleUnitChange = (next: PeriodUnit) => {
    setUnit(next);
    setPeriodStart(next === "week" ? getWeekStart(today) : getMonthStart(today));
  };

  const pEnd = periodEnd(periodStart, unit);
  const periodStartStr = toYmd(periodStart);
  const periodEndStr = toYmd(pEnd);

  const resources = useMemo(
    () => computeResources(ganttTasks, periodStartStr, periodEndStr),
    [ganttTasks, periodStartStr, periodEndStr],
  );

  const totalHours = resources.reduce((sum, r) => sum + r.hours, 0);
  const totalTasks = resources.reduce((sum, r) => sum + r.taskCount, 0);
  const avgPersons = resources.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">リソース分析</h1>
        <div className="flex items-center gap-2">
          {(["week", "month"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => handleUnitChange(u)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                unit === u ? "bg-brand-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {u === "week" ? "週" : "月"}
            </button>
          ))}
          <button
            type="button"
            aria-label="前の期間"
            onClick={() => setPeriodStart((p) => unit === "week" ? addWeeks(p, -1) : addMonths(p, -1))}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 text-sm"
          >
            ‹
          </button>
          <span className="min-w-[140px] text-center text-sm font-semibold text-slate-700">
            {formatPeriodLabel(periodStart, unit)}
          </span>
          <button
            type="button"
            aria-label="次の期間"
            onClick={() => setPeriodStart((p) => unit === "week" ? addWeeks(p, 1) : addMonths(p, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 text-sm"
          >
            ›
          </button>
        </div>
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-xs text-slate-500">稼働時間合計</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{totalHours.toFixed(1)} h</p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-xs text-slate-500">対象タスク数</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{totalTasks} 件</p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-xs text-slate-500">平均稼働人数</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{avgPersons} 名</p>
        </div>
      </div>

      {/* 担当者別テーブル */}
      {resources.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-slate-400 text-sm ring-1 ring-slate-200">
          この期間に稼働するタスクはありません
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-[0.1em] text-slate-500">担当</th>
                <th className="px-4 py-3 text-right text-xs font-semibold tracking-[0.1em] text-slate-500">稼働h</th>
                <th className="px-4 py-3 text-right text-xs font-semibold tracking-[0.1em] text-slate-500">タスク</th>
                <th className="px-4 py-3 text-right text-xs font-semibold tracking-[0.1em] text-slate-500">キャパ(h)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold tracking-[0.1em] text-slate-500">稼働率</th>
                <th className="w-32 px-4 py-3" aria-label="稼働率バー" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resources.map((row) => (
                <tr key={row.name} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.hours.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.taskCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">{row.capacityHours}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${row.utilizationPct > 100 ? "text-red-600" : "text-slate-700"}`}>
                    {row.utilizationPct}%
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-1.5 w-full rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${row.utilizationPct > 100 ? "bg-red-500" : "bg-brand-500"}`}
                        style={{ width: `${Math.min(row.utilizationPct, 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">* 稼働率 = 期間内タスクの延べ稼働時間 ÷ キャパシティ（稼働日数 × 8h）。100%超は赤字表示。</p>
    </div>
  );
}
