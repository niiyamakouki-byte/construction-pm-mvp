/**
 * ExecutiveDashboardPage — 多現場経営ダッシュボード
 *
 * 経営者がスマホで3秒で状況を把握できる全案件サマリ。
 * v2-cozy: セージグリーン (#6B8E5A) 軸、装飾最小、アラートのみ赤 (#C53030)
 */

import { useEffect, useMemo, useState } from "react";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import {
  aggregatePortfolio,
  type ProjectPortfolioEntry,
  type PortfolioSummary,
} from "../lib/exec-dashboard/portfolio-aggregator.js";
import {
  DangerSignalKind,
  type DangerSignal,
  type DangerSignalKind as DangerSignalKindType,
} from "../lib/exec-dashboard/danger-signals.js";
import type { Project, Task } from "../domain/types.js";
import { effectiveProgress } from "./gantt/utils.js";

// ── Constants ──────────────────────────────────────────────────────────────

const SAGE_GREEN = "#6B8E5A";
const DANGER_RED = "#C53030";

const SIGNAL_LABELS: Record<DangerSignalKindType, string> = {
  delayedSchedule: "工程遅延",
  budgetOverrun: "予算超過",
  overdueInvoice: "未入金延滞",
  lowMargin: "低粗利",
  stalledChat: "チャット停滞",
  photoMissing7Days: "写真なし",
};

const ALL_SIGNAL_KINDS = Object.keys(DangerSignalKind) as DangerSignalKindType[];

// ── Formatters ─────────────────────────────────────────────────────────────

function fmtCurrency(amount: number): string {
  if (amount >= 100_000_000) return `¥${(amount / 100_000_000).toFixed(1)}億`;
  if (amount >= 10_000) return `¥${Math.round(amount / 10_000)}万`;
  return `¥${Math.round(amount).toLocaleString("ja-JP")}`;
}

function fmtProgress(pct: number): string {
  return `${Math.round(pct)}%`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

type KpiCardProps = {
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
};

function KpiCard({ label, value, sub, danger = false }: KpiCardProps) {
  return (
    <div
      className="rounded-2xl border bg-white px-5 py-4 shadow-sm"
      style={{ borderColor: danger ? DANGER_RED : "#e2e8f0" }}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p
        className="mt-1 text-2xl font-bold leading-none"
        style={{ color: danger ? DANGER_RED : SAGE_GREEN }}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

type SignalBadgeProps = {
  kind: DangerSignalKindType;
};

function SignalBadge({ kind }: SignalBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: "#FEE2E2", color: DANGER_RED }}
    >
      {SIGNAL_LABELS[kind]}
    </span>
  );
}

type SignalRowProps = {
  signal: DangerSignal;
};

function SignalRow({ signal }: SignalRowProps) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2.5 pr-3 text-sm font-medium text-slate-800">{signal.projectName}</td>
      <td className="py-2.5 pr-3">
        <SignalBadge kind={signal.kind} />
      </td>
      <td className="py-2.5 pr-3 text-xs text-slate-500">{signal.detail}</td>
      <td className="py-2.5 text-xs text-slate-400">{signal.detectedAt}</td>
    </tr>
  );
}

type ProjectRowProps = {
  entry: ProjectPortfolioEntry;
  signalCount: number;
};

function ProjectRow({ entry, signalCount }: ProjectRowProps) {
  const { project, tasks, invoices } = entry;
  const contractAmount = entry.contractAmount ?? project.budget ?? 0;
  const grossProfit = entry.grossProfit ?? 0;
  const marginPct =
    contractAmount > 0 ? Math.round((grossProfit / contractAmount) * 1000) / 10 : null;

  const progress =
    tasks.length === 0
      ? 0
      : Math.round(tasks.reduce((s, t) => s + effectiveProgress(t), 0) / tasks.length);

  const unpaid = invoices
    .filter((inv) => inv.status !== "paid" && inv.status !== "cancelled")
    .reduce((s, inv) => s + inv.amount, 0);

  const hasSignals = signalCount > 0;

  return (
    <div className="flex items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-0">
      {/* Name */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">{project.name}</p>
        {unpaid > 0 && (
          <p className="text-xs text-slate-500">未入金 {fmtCurrency(unpaid)}</p>
        )}
      </div>

      {/* Progress bar */}
      <div className="hidden w-24 sm:block">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-slate-500">進捗</span>
          <span className="text-xs font-bold text-slate-700">{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progress}%`, background: SAGE_GREEN }}
          />
        </div>
      </div>

      {/* Margin */}
      {marginPct !== null && (
        <div className="hidden w-16 text-right sm:block">
          <p
            className="text-sm font-semibold"
            style={{ color: marginPct < 10 ? DANGER_RED : SAGE_GREEN }}
          >
            {marginPct}%
          </p>
          <p className="text-xs text-slate-400">粗利率</p>
        </div>
      )}

      {/* Signal count */}
      {hasSignals && (
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: DANGER_RED }}
          aria-label={`危険シグナル ${signalCount}件`}
        >
          {signalCount}
        </span>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ExecutiveDashboardPage() {
  const { organizationId } = useOrganizationContext();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasksByProject, setTasksByProject] = useState<Map<string, Task[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<DangerSignalKindType | "">("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const projectRepo = createProjectRepository(() => organizationId);
        const taskRepo = createTaskRepository(() => organizationId);
        const [allProjects, allTasks] = await Promise.all([
          projectRepo.findAll(),
          taskRepo.findAll(),
        ]);
        if (cancelled) return;
        const byProject = new Map<string, Task[]>();
        for (const task of allTasks) {
          const arr = byProject.get(task.projectId) ?? [];
          arr.push(task);
          byProject.set(task.projectId, arr);
        }
        setProjects(allProjects);
        setTasksByProject(byProject);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [organizationId]);

  // Build entries (invoices/chats/photos empty — consumers inject via store in production)
  const entries = useMemo<ProjectPortfolioEntry[]>(
    () =>
      projects.map((project) => ({
        project,
        tasks: tasksByProject.get(project.id) ?? [],
        invoices: [],
        chatMessages: [],
        photos: [],
      })),
    [projects, tasksByProject],
  );

  const summary = useMemo<PortfolioSummary>(
    () => aggregatePortfolio(entries),
    [entries],
  );

  // Signal count per project
  const signalCountByProject = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of summary.dangerSignals) {
      map.set(s.projectId, (map.get(s.projectId) ?? 0) + 1);
    }
    return map;
  }, [summary.dangerSignals]);

  const filteredSignals = useMemo(
    () =>
      kindFilter
        ? summary.dangerSignals.filter((s) => s.kind === kindFilter)
        : summary.dangerSignals,
    [summary.dangerSignals, kindFilter],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">経営ダッシュボード</h1>
        <p className="mt-1 text-sm text-slate-500">全案件の粗利・進捗・入金・危険信号を一覧</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="粗利合計"
          value={fmtCurrency(summary.totalGrossProfit)}
          sub={`${summary.totalProjects}案件`}
        />
        <KpiCard
          label="進捗加重平均"
          value={fmtProgress(summary.weightedProgress)}
          sub="契約額加重"
        />
        <KpiCard
          label="未入金合計"
          value={fmtCurrency(summary.unpaidAmount)}
          danger={summary.unpaidAmount > 0}
        />
        <KpiCard
          label="危険案件数"
          value={`${summary.dangerProjectCount}件`}
          sub={`シグナル ${summary.dangerSignals.length}件`}
          danger={summary.dangerProjectCount > 0}
        />
      </div>

      {/* Danger signals table */}
      {summary.dangerSignals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center">
          <p className="text-sm text-slate-500">危険シグナルなし — 全案件順調です</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-800">
              危険シグナル
              <span
                className="ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold text-white"
                style={{ background: DANGER_RED }}
              >
                {summary.dangerSignals.length}
              </span>
            </h2>
            {/* Filter */}
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as DangerSignalKindType | "")}
              aria-label="シグナル種別フィルタ"
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            >
              <option value="">全種別</option>
              {ALL_SIGNAL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {SIGNAL_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto px-4">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-slate-400">
                  <th className="pb-2 pt-3 pr-3 font-medium">案件名</th>
                  <th className="pb-2 pt-3 pr-3 font-medium">種別</th>
                  <th className="pb-2 pt-3 pr-3 font-medium">詳細</th>
                  <th className="pb-2 pt-3 font-medium">検出日</th>
                </tr>
              </thead>
              <tbody>
                {filteredSignals.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-sm text-slate-400">
                      選択した種別のシグナルはありません
                    </td>
                  </tr>
                ) : (
                  filteredSignals.map((signal, i) => (
                    <SignalRow key={`${signal.projectId}-${signal.kind}-${i}`} signal={signal} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Project list */}
      {entries.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-800">案件一覧</h2>
          </div>
          {entries.map((entry) => (
            <ProjectRow
              key={entry.project.id}
              entry={entry}
              signalCount={signalCountByProject.get(entry.project.id) ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
