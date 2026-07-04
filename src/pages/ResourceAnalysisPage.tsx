/**
 * P4: リソース分析ビュー
 * 担当者（協力会社）別の稼働時間・タスク数・稼働率を集計して表示する。
 * キャパシティ仮定: 1人1日8h固定（仕様書指示）。
 * 集計ロジックは src/lib/resource-analysis.ts に切り出してユニットテスト済み。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import { createContractorRepository } from "../stores/contractor-store.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { filterScheduleTasks } from "../lib/cost-management.js";
import { toLocalDateString } from "../components/gantt/utils.js";
import type { GanttTask } from "../components/gantt/types.js";
import type { Project } from "../domain/types.js";
import { computeResourceAnalysis } from "../lib/resource-analysis.js";

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

/** ローカルタイムのままの YYYY-MM-DD 文字列（toISOString は UTC 変換で日付ズレする） */
function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ResourceAnalysisPage() {
  const { organizationId } = useOrganizationContext();
  const projectRepository = useMemo(() => createProjectRepository(() => organizationId), [organizationId]);
  const taskRepository = useMemo(() => createTaskRepository(() => organizationId), [organizationId]);
  const contractorRepository = useMemo(() => createContractorRepository(() => organizationId), [organizationId]);

  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<PeriodUnit>("week");
  const today = useMemo(() => new Date(), []);
  const [periodStart, setPeriodStart] = useState<Date>(() => getWeekStart(new Date()));
  // 全案件（"all"）または特定案件 ID で絞り込む。P4: 案件横断/案件別の両モードを支援
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    try {
      const [allTasks, allProjects, allContractors] = await Promise.all([
        taskRepository.findAll(),
        projectRepository.findAll(),
        contractorRepository.findAll(),
      ]);
      setProjects(allProjects);

      const projectMap = new Map(allProjects.map((p) => [p.id, p]));
      const contractorMap = new Map(allContractors.map((c) => [c.id, c]));
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
          contractorName: task.contractorId ? contractorMap.get(task.contractorId)?.name : undefined,
        } satisfies GanttTask;
      });

      setGanttTasks(nextTasks);
    } finally {
      setLoading(false);
    }
  }, [taskRepository, projectRepository, contractorRepository]);

  useEffect(() => { void loadData(); }, [loadData]);

  // 期間変更時に periodStart の型に合わせて週/月起点に切り替え
  const handleUnitChange = (next: PeriodUnit) => {
    setUnit(next);
    setPeriodStart(next === "week" ? getWeekStart(today) : getMonthStart(today));
  };

  const pEnd = periodEnd(periodStart, unit);
  const periodStartStr = toYmd(periodStart);
  const periodEndStr = toYmd(pEnd);

  const scopedTasks = useMemo(
    () => (projectFilter === "all" ? ganttTasks : ganttTasks.filter((t) => t.projectId === projectFilter)),
    [ganttTasks, projectFilter],
  );

  const summary = useMemo(
    () => computeResourceAnalysis(scopedTasks, periodStartStr, periodEndStr),
    [scopedTasks, periodStartStr, periodEndStr],
  );
  const { rows: resources, totalHours, totalTasks, avgPersons } = summary;

  const isCurrentPeriod = useMemo(() => {
    const start = unit === "week" ? getWeekStart(today) : getMonthStart(today);
    return toYmd(start) === periodStartStr;
  }, [today, unit, periodStartStr]);

  const jumpToToday = () => {
    setPeriodStart(unit === "week" ? getWeekStart(today) : getMonthStart(today));
  };

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
          <button
            type="button"
            onClick={jumpToToday}
            disabled={isCurrentPeriod}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:hover:bg-white"
          >
            今日
          </button>
        </div>
      </div>

      {/* 案件フィルタ（横断 or 特定案件） */}
      {projects.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="project-filter" className="text-slate-500 shrink-0">対象案件</label>
          <select
            id="project-filter"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
          >
            <option value="all">全案件を横断</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

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
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {avgPersons.toFixed(1)} <span className="text-base font-semibold text-slate-500">名/日</span>
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">
            延べ稼働時間 ÷ (稼働日 × 8h)
          </p>
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

      {/* 担当者別稼働時間バーチャート */}
      {resources.length > 0 && (() => {
        const maxHours = Math.max(...resources.map((r) => r.hours), 1);
        return (
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
              <p className="text-xs font-semibold tracking-[0.1em] text-slate-500">担当者別稼働時間</p>
            </div>
            <div className="divide-y divide-slate-100">
              {resources.map((row) => (
                <div key={row.name} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-28 shrink-0 truncate text-sm font-medium text-slate-700">{row.name}</span>
                  <div className="flex-1 rounded-full bg-slate-100" style={{ height: "10px" }}>
                    <div
                      className={`h-full rounded-full ${row.utilizationPct > 100 ? "bg-red-500" : "bg-brand-500"}`}
                      style={{ width: `${(row.hours / maxHours) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right tabular-nums text-sm text-slate-600">
                    {row.hours.toFixed(1)} h
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <p className="text-xs text-slate-400">* 稼働率 = 期間内タスクの延べ稼働時間 ÷ キャパシティ（稼働日数 × 8h）。100%超は赤字表示。</p>
    </div>
  );
}
