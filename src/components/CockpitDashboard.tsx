/**
 * CockpitDashboard — 統合コックピットダッシュボード
 *
 * Inspired by Flutter dashboard/health_score_widget.dart,
 * ceo_overview_card.dart, current_workers_card.dart, etc.
 * グラスモーフィズム + カード配置。
 */

import type { HealthScore } from "../lib/project-health.js";
import type { ForecastReport } from "../lib/cost-forecaster.js";
import type { SiteEntryRecord } from "../lib/site-entry-log.js";
import type { RiskAlert } from "../lib/risk-predictor.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type CriticalPathStatus = {
  totalTasks: number;
  completedTasks: number;
  delayedTasks: number;
  progress: number; // 0-100
  maxDelayDays: number;
};

export type ProjectCockpitSummary = {
  id: string;
  name: string;
  progress: number; // 0-100
  delayDays: number;
  pendingCount: number;
  status: "on_track" | "minor_delay" | "major_delay" | "pending";
};

export type CockpitDashboardProps = {
  health: HealthScore | null;
  criticalPath: CriticalPathStatus | null;
  forecast: ForecastReport | null;
  todayEntries: SiteEntryRecord[];
  projects: ProjectCockpitSummary[];
  riskAlerts?: RiskAlert[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

function healthColor(score: number): string {
  if (score > 80) return "#4caf50";
  if (score > 50) return "#ff9800";
  return "#f44336";
}

function healthLabel(score: number): string {
  if (score > 80) return "良好";
  if (score > 50) return "注意";
  return "要対応";
}

function formatCurrency(amount: number): string {
  if (amount >= 100_000_000) return `¥${(amount / 100_000_000).toFixed(1)}億`;
  if (amount >= 10_000) return `¥${Math.round(amount / 10_000)}万`;
  if (amount >= 1_000) return `¥${Math.round(amount / 1_000)}千`;
  return `¥${Math.round(amount)}`;
}

function companySummary(entries: SiteEntryRecord[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const e of entries) {
    const company = e.company || "不明";
    map[company] = (map[company] ?? 0) + 1;
  }
  return map;
}

function statusColor(status: ProjectCockpitSummary["status"]): string {
  switch (status) {
    case "on_track": return "#4caf50";
    case "minor_delay": return "#ff9800";
    case "major_delay": return "#f44336";
    case "pending": return "#2196f3";
  }
}

function statusLabel(status: ProjectCockpitSummary["status"]): string {
  switch (status) {
    case "on_track": return "順調";
    case "minor_delay": return "軽遅延";
    case "major_delay": return "遅延";
    case "pending": return "確認待ち";
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

/** 健全性スコアゲージ（SVG 円形） */
function HealthGauge({ health }: { health: HealthScore | null }) {
  const score = health?.overall ?? 0;
  const color = healthColor(score);
  const label = healthLabel(score);

  // SVG arc: 270° sweep starting from 135° (bottom-left)
  const radius = 44;
  const cx = 60;
  const cy = 60;
  const startAngle = 135;
  const sweepTotal = 270;
  const sweep = (score / 100) * sweepTotal;

  function polarToXY(angle: number): [number, number] {
    const rad = ((angle - 90) * Math.PI) / 180;
    return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
  }

  function arcPath(endAngle: number): string {
    const [sx, sy] = polarToXY(startAngle);
    const [ex, ey] = polarToXY(startAngle + endAngle);
    const large = endAngle > 180 ? 1 : 0;
    return `M ${sx} ${sy} A ${radius} ${radius} 0 ${large} 1 ${ex} ${ey}`;
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-xs font-semibold text-slate-500">プロジェクト健全性</p>
      <div className="relative">
        <svg width="120" height="120" viewBox="0 0 120 120" aria-label={`健全性スコア ${score}`}>
          {/* Background track */}
          <path
            d={arcPath(sweepTotal)}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Score arc */}
          {score > 0 && (
            <path
              d={arcPath(sweep)}
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 4px ${color}80)` }}
            />
          )}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold leading-tight" style={{ color }}>
            {score}
          </span>
          <span className="text-[10px] font-semibold text-slate-500">{label}</span>
        </div>
      </div>
      {health && (
        <div className="flex gap-3 text-[10px] text-slate-500">
          <span>工程 {health.categories.find((c) => c.category === "schedule")?.score ?? "—"}</span>
          <span>コスト {health.categories.find((c) => c.category === "cost")?.score ?? "—"}</span>
          <span>リスク {health.categories.find((c) => c.category === "risk")?.score ?? "—"}</span>
        </div>
      )}
    </div>
  );
}

/** クリティカルパス進捗バー */
function CriticalPathBar({ cp }: { cp: CriticalPathStatus | null }) {
  if (!cp) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white/60 p-4 backdrop-blur-sm">
        <p className="text-xs font-semibold text-slate-500">クリティカルパス</p>
        <p className="mt-1 text-sm text-slate-400">データなし</p>
      </div>
    );
  }

  const hasDelay = cp.delayedTasks > 0;
  const barColor = hasDelay ? "#f44336" : "#4caf50";

  return (
    <div
      className="rounded-xl border p-4 backdrop-blur-sm"
      style={{
        background: hasDelay ? "rgba(244,67,54,0.04)" : "rgba(76,175,80,0.04)",
        borderColor: hasDelay ? "rgba(244,67,54,0.2)" : "rgba(76,175,80,0.2)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-600">クリティカルパス進捗</p>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: `${barColor}20`, color: barColor }}
        >
          {hasDelay ? `${cp.delayedTasks}件遅延` : "順調"}
        </span>
      </div>

      {/* Overall bar */}
      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${cp.progress}%`, background: barColor }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{cp.completedTasks}/{cp.totalTasks} タスク完了</span>
        <span className="font-semibold" style={{ color: barColor }}>
          {cp.progress.toFixed(1)}%
        </span>
      </div>

      {hasDelay && (
        <p className="mt-2 text-[11px] font-semibold" style={{ color: barColor }}>
          最大遅延 +{cp.maxDelayDays}日
        </p>
      )}
    </div>
  );
}

/** 遅延コストカード */
function DelayCostCard({ forecast }: { forecast: ForecastReport | null }) {
  const overUnder = forecast?.overUnder ?? 0;
  const hasCost = overUnder > 0;
  const color = hasCost ? "#f44336" : "#4caf50";

  return (
    <div
      className="rounded-xl border p-4 backdrop-blur-sm"
      style={{
        background: hasCost ? "rgba(244,67,54,0.04)" : "rgba(76,175,80,0.04)",
        borderColor: hasCost ? "rgba(244,67,54,0.2)" : "rgba(76,175,80,0.2)",
      }}
    >
      <p className="text-xs font-semibold text-slate-500">推定遅延コスト</p>
      <p className="mt-1 text-2xl font-bold" style={{ color }}>
        {forecast ? formatCurrency(Math.max(0, overUnder)) : "—"}
      </p>
      {forecast && (
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>予算</span>
            <span>{formatCurrency(forecast.totalBudget)}</span>
          </div>
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>支出</span>
            <span>{formatCurrency(forecast.spentToDate)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">リスク</span>
            <span
              className="font-semibold"
              style={{
                color:
                  forecast.riskLevel === "high"
                    ? "#f44336"
                    : forecast.riskLevel === "medium"
                      ? "#ff9800"
                      : "#4caf50",
              }}
            >
              {forecast.riskLevel === "high" ? "高" : forecast.riskLevel === "medium" ? "中" : "低"}
            </span>
          </div>
        </div>
      )}
      {!forecast && (
        <p className="mt-1 text-xs text-slate-400">案件を選択してください</p>
      )}
    </div>
  );
}

/** 現在入場者カード */
function WorkersCard({ entries }: { entries: SiteEntryRecord[] }) {
  const count = entries.length;
  const byCompany = companySummary(entries);
  const companies = Object.entries(byCompany);

  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-500">本日の入場者</p>
        <span className="text-2xl font-bold text-emerald-600">{count}<span className="text-sm font-semibold text-slate-500 ml-0.5">名</span></span>
      </div>

      {companies.length > 0 ? (
        <div className="flex flex-wrap gap-1 mt-1">
          {companies.map(([company, n]) => (
            <span
              key={company}
              className="rounded-full bg-white/80 border border-emerald-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
            >
              {company}: {n}名
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-xs text-slate-400">本日の入場記録なし</p>
      )}
    </div>
  );
}

// ── Alert helpers ──────────────────────────────────────────────────────────

function alertBgColor(severity: RiskAlert["severity"]): string {
  switch (severity) {
    case "critical": return "rgba(239,68,68,0.08)";
    case "high":     return "rgba(249,115,22,0.07)";
    case "medium":   return "rgba(234,179,8,0.07)";
    case "low":      return "rgba(34,197,94,0.06)";
  }
}

function alertBorderColor(severity: RiskAlert["severity"]): string {
  switch (severity) {
    case "critical": return "rgba(239,68,68,0.35)";
    case "high":     return "rgba(249,115,22,0.30)";
    case "medium":   return "rgba(234,179,8,0.30)";
    case "low":      return "rgba(34,197,94,0.25)";
  }
}

function alertTextColor(severity: RiskAlert["severity"]): string {
  switch (severity) {
    case "critical": return "#dc2626";
    case "high":     return "#ea580c";
    case "medium":   return "#ca8a04";
    case "low":      return "#16a34a";
  }
}

function alertSeverityLabel(severity: RiskAlert["severity"]): string {
  switch (severity) {
    case "critical": return "緊急";
    case "high":     return "高";
    case "medium":   return "中";
    case "low":      return "低";
  }
}

function alertTypeLabel(type: RiskAlert["type"]): string {
  switch (type) {
    case "budget":   return "予算";
    case "schedule": return "工程";
    case "safety":   return "安全";
    case "resource": return "資源";
  }
}

/** リスクアラートカード */
function RiskAlertsCard({ alerts }: { alerts: RiskAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 backdrop-blur-sm">
        <p className="text-xs font-semibold text-slate-500">AIリスク予測</p>
        <p className="mt-1 text-sm text-emerald-600 font-semibold">リスクなし — 順調です</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-white/60 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-slate-700">AIリスク予測</p>
        <span className="text-xs text-slate-500">{alerts.length}件</span>
      </div>
      <div className="space-y-2">
        {alerts.map((alert, i) => {
          const color = alertTextColor(alert.severity);
          return (
            <div
              key={i}
              className="rounded-lg p-3"
              style={{
                background: alertBgColor(alert.severity),
                border: `1px solid ${alertBorderColor(alert.severity)}`,
              }}
            >
              <div className="flex items-start gap-2">
                {/* Severity badge */}
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ background: `${color}18`, color }}
                >
                  {alertSeverityLabel(alert.severity)}
                </span>
                {/* Type badge */}
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600">
                  {alertTypeLabel(alert.type)}
                </span>
                {/* Message */}
                <p className="flex-1 text-xs font-semibold" style={{ color }}>
                  {alert.message}
                </p>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500 pl-1">
                {alert.recommendation}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** CEO俯瞰カード */
function CeoOverviewCard({
  projects,
}: {
  projects: ProjectCockpitSummary[];
}) {
  const onTrack = projects.filter((p) => p.status === "on_track").length;
  const delayed = projects.filter(
    (p) => p.status === "minor_delay" || p.status === "major_delay",
  ).length;
  const pending = projects.filter((p) => p.status === "pending").length;
  const total = projects.length;

  return (
    <div className="rounded-xl border border-slate-100 bg-white/60 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-slate-700">全現場ダッシュボード</p>
        <span className="text-xs text-slate-500">{total}件</span>
      </div>

      {/* Status summary bar */}
      {total > 0 && (
        <div className="flex h-2 w-full overflow-hidden rounded-full mb-2">
          {onTrack > 0 && (
            <div style={{ flex: onTrack, background: "#4caf50" }} />
          )}
          {delayed > 0 && (
            <div style={{ flex: delayed, background: "#f44336" }} />
          )}
          {pending > 0 && (
            <div style={{ flex: pending, background: "#2196f3" }} />
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-3 text-[10px] text-slate-500 mb-3">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" />
          順調 {onTrack}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-red-500" />
          遅延 {delayed}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-blue-500" />
          確認待ち {pending}
        </span>
      </div>

      {/* Project rows */}
      {projects.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">案件なし</p>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => {
            const color = statusColor(p.status);
            const label = statusLabel(p.status);
            return (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                style={{ background: `${color}08` }}
              >
                {/* Status dot */}
                <span
                  className="shrink-0 w-2 h-2 rounded-full"
                  style={{ background: color }}
                />
                {/* Name */}
                <span className="flex-1 truncate text-xs font-medium text-slate-700">
                  {p.name}
                </span>
                {/* Delay badge */}
                {p.delayDays > 0 && (
                  <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold text-white bg-red-500">
                    +{p.delayDays}日
                  </span>
                )}
                {/* Pending badge */}
                {p.pendingCount > 0 && (
                  <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold text-blue-700 bg-blue-100">
                    {p.pendingCount}件待
                  </span>
                )}
                {/* Progress */}
                <div className="shrink-0 flex flex-col items-end">
                  <span className="text-[11px] font-bold" style={{ color }}>
                    {p.progress}%
                  </span>
                  <div className="w-10 h-1 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${p.progress}%`, background: color }}
                    />
                  </div>
                </div>
                {/* Status label */}
                <span
                  className="shrink-0 text-[9px] font-semibold rounded px-1 py-0.5"
                  style={{ background: `${color}18`, color }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function CockpitDashboard({
  health,
  criticalPath,
  forecast,
  todayEntries,
  projects,
  riskAlerts = [],
}: CockpitDashboardProps) {
  return (
    <div className="space-y-3">
      {/* Top row: health gauge + critical path */}
      <div className="rounded-2xl border border-slate-100 bg-white/70 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {/* Health gauge */}
          <HealthGauge health={health} />

          {/* Critical path + delay cost stacked */}
          <div className="flex-1 w-full space-y-3">
            <CriticalPathBar cp={criticalPath} />
            <DelayCostCard forecast={forecast} />
          </div>
        </div>
      </div>

      {/* Risk alerts */}
      <RiskAlertsCard alerts={riskAlerts} />

      {/* Workers card */}
      <WorkersCard entries={todayEntries} />

      {/* CEO overview */}
      <CeoOverviewCard projects={projects} />
    </div>
  );
}
