import type { Project } from "../domain/types.js";
import {
  calculateEarnedValue,
  calculateProjectProgress,
  costPerformanceIndex,
  estimateAtCompletion,
  schedulePerformanceIndex,
  type ActualCostsInput,
  type ProgressTask,
} from "../lib/progress-tracker.js";
import { criticalPath } from "../lib/schedule-validator.js";

type ProgressDashboardProps = {
  project: Project;
  tasks: ProgressTask[];
  actualCosts?: ActualCostsInput;
  asOfDate?: string;
};

function formatNumber(value: number, maximumFractionDigits = 2): string {
  if (!Number.isFinite(value)) return "N/A";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function getScheduleHealth(spi: number): {
  label: "ahead" | "on track" | "behind";
  tone: string;
  description: string;
} {
  if (spi > 1.05) {
    return {
      label: "ahead",
      tone: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      description: "Work is earning value faster than planned.",
    };
  }

  if (spi < 0.95) {
    return {
      label: "behind",
      tone: "bg-rose-50 text-rose-700 ring-rose-200",
      description: "The current plan is slipping against the baseline.",
    };
  }

  return {
    label: "on track",
    tone: "bg-blue-50 text-blue-700 ring-blue-200",
    description: "Actual progress is aligned with the planned pace.",
  };
}

export function ProgressDashboard({
  project,
  tasks,
  actualCosts,
  asOfDate,
}: ProgressDashboardProps) {
  const budget = project.budget ?? 0;
  const overallProgress = calculateProjectProgress(tasks);
  const evm = calculateEarnedValue(tasks, budget, asOfDate);
  const spi = schedulePerformanceIndex(tasks, budget, asOfDate);
  const cpi = costPerformanceIndex(tasks, actualCosts, budget, asOfDate);
  const eac = estimateAtCompletion(evm.bac, cpi);
  const health = getScheduleHealth(spi);
  const critical = criticalPath(tasks);
  const criticalTaskNames = critical.taskIds.map(
    (taskId) => tasks.find((task) => task.id === taskId)?.name ?? taskId,
  );

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" aria-label="Project progress dashboard">
      <div className="bg-[linear-gradient(135deg,#fffaf0_0%,#f8fafc_45%,#eff6ff_100%)] px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Project controls</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">{project.name}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Progress, earned value, and critical-path health in one view.
            </p>
          </div>
          <div className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${health.tone}`}>
            Schedule health: {health.label}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">Overall progress</p>
              <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900">
                {formatPercent(overallProgress)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Planned progress</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-700">
                {formatPercent(evm.plannedPercentComplete)}
              </p>
            </div>
          </div>
          <div
            className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-label="Overall project progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(overallProgress)}
          >
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b_0%,#2563eb_50%,#10b981_100%)] transition-all"
              style={{ width: `${Math.min(100, Math.max(0, overallProgress))}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-slate-600">{health.description}</p>
        </div>
      </div>

      <div className="grid gap-4 border-t border-slate-200 px-5 py-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">SPI</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{formatNumber(spi)}</p>
              <p className="mt-1 text-sm text-slate-500">EV / PV</p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">CPI</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{formatNumber(cpi)}</p>
              <p className="mt-1 text-sm text-slate-500">EV / AC</p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">EAC</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{formatNumber(eac, 0)}</p>
              <p className="mt-1 text-sm text-slate-500">Budget / CPI</p>
            </article>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Earned value</p>
                <p className="text-xs text-slate-500">Budget-weighted schedule and cost tracking.</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                BAC {formatNumber(evm.bac, 0)}
              </div>
            </div>

            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 px-3 py-3">
                <dt className="text-xs text-slate-500">EV</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{formatNumber(evm.ev, 0)}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-3">
                <dt className="text-xs text-slate-500">PV</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{formatNumber(evm.pv, 0)}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-3">
                <dt className="text-xs text-slate-500">AC</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{formatNumber(evm.ac, 0)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Critical path</p>
              <p className="text-xs text-slate-500">Longest dependency chain driving completion.</p>
            </div>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              {critical.totalDuration} days
            </span>
          </div>

          {criticalTaskNames.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Critical path tasks">
              {criticalTaskNames.map((taskName, index) => (
                <span
                  key={`${taskName}-${index}`}
                  className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm"
                >
                  {taskName}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No critical path is available until dependencies are valid.</p>
          )}

          {critical.issues.length > 0 && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
              {critical.issues[0]}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
