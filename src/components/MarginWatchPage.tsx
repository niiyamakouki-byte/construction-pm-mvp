/**
 * MarginWatchPage — 粗利アラートダッシュボード (Sprint 13-B)
 *
 * v2-cozy: セージグリーン #6B8E5A / critical のみ #C53030
 * 粗利率25%下回り即警告、原因分類、改善提案。
 */

import { useEffect, useMemo, useState } from "react";
import { marginAlertStore, _resetMarginAlertStore as _r } from "../lib/margin-watch/margin-alert-store.js";
import type { MarginAlert, MarginAlertLevel } from "../lib/margin-watch/types.js";

// suppress unused import warning — only used via side-effect in tests
void _r;

// ── Constants ──────────────────────────────────────────────────────────────

const SAGE_GREEN = "#6B8E5A";
const DANGER_RED = "#C53030";

const LEVEL_LABELS: Record<MarginAlertLevel, string> = {
  safe: "安全",
  caution: "注意",
  warning: "警告",
  critical: "重大",
};

const LEVEL_COLORS: Record<MarginAlertLevel, string> = {
  safe: SAGE_GREEN,
  caution: "#d97706",
  warning: "#b45309",
  critical: DANGER_RED,
};

type DateFilter = "today" | "week" | "month" | "all";

const DATE_FILTER_LABELS: Record<DateFilter, string> = {
  today: "今日",
  week: "今週",
  month: "今月",
  all: "全期間",
};

// ── Formatters ─────────────────────────────────────────────────────────────

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function fmtCurrency(yen: number): string {
  if (yen >= 100_000_000) return `¥${(yen / 100_000_000).toFixed(1)}億`;
  if (yen >= 10_000) return `¥${Math.round(yen / 10_000)}万`;
  return `¥${Math.round(yen).toLocaleString("ja-JP")}`;
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

function sinceDate(filter: DateFilter): Date {
  const d = new Date();
  if (filter === "today") {
    d.setHours(0, 0, 0, 0);
  } else if (filter === "week") {
    d.setDate(d.getDate() - 7);
  } else if (filter === "month") {
    d.setMonth(d.getMonth() - 1);
  } else {
    // "all" — epoch
    return new Date(0);
  }
  return d;
}

// ── Sub-components ─────────────────────────────────────────────────────────

type LevelBadgeProps = { level: MarginAlertLevel };

function LevelBadge({ level }: LevelBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white"
      style={{ background: LEVEL_COLORS[level] }}
    >
      {LEVEL_LABELS[level]}
    </span>
  );
}

type AlertRowProps = {
  alert: MarginAlert;
  onDismiss: (id: string) => void;
};

function AlertRow({ alert, onDismiss }: AlertRowProps) {
  const deltaSign = alert.deltaFromTargetPct >= 0 ? "+" : "";
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2.5 pr-3 text-sm font-medium text-slate-800">
        {alert.projectName}
      </td>
      <td className="py-2.5 pr-3">
        <LevelBadge level={alert.level} />
      </td>
      <td
        className="py-2.5 pr-3 text-sm font-semibold tabular-nums"
        style={{ color: alert.level === "critical" ? DANGER_RED : "inherit" }}
      >
        {fmtPct(alert.marginRatioPct)}
      </td>
      <td className="py-2.5 pr-3 text-sm tabular-nums text-slate-600">
        {fmtPct(alert.forecastMarginRatioPct)}
      </td>
      <td
        className="py-2.5 pr-3 text-xs tabular-nums"
        style={{ color: alert.deltaFromTargetPct < 0 ? DANGER_RED : SAGE_GREEN }}
      >
        {deltaSign}{fmtPct(alert.deltaFromTargetPct)}
      </td>
      <td className="py-2.5 pr-3 text-xs text-slate-500">
        {alert.causeTag.length > 0 ? alert.causeTag.join(" / ") : "—"}
      </td>
      <td className="py-2.5 pr-3 text-xs text-slate-400">{fmtDate(alert.raisedAt)}</td>
      <td className="py-2.5">
        <button
          type="button"
          onClick={() => onDismiss(alert.id)}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 active:bg-slate-100"
        >
          閉じる
        </button>
      </td>
    </tr>
  );
}

// ── Hint cards ─────────────────────────────────────────────────────────────

type HintCard = { title: string; body: string };

const HINT_CARDS: HintCard[] = [
  {
    title: "原価精査",
    body: "発注明細を工種別に再集計。見積外発注と数量超過を洗い出す。",
  },
  {
    title: "追加見積",
    body: "変更工事・追加工事を速やかに見積化し、発注者承認を取得する。",
  },
  {
    title: "単価交渉",
    body: "主要資材の単価を競合他社と比較。3社見積りで値下げ余地を確認。",
  },
  {
    title: "工程短縮",
    body: "クリティカルパスを見直し、工期圧縮で固定費・労務費を削減する。",
  },
];

function HintPanel() {
  return (
    <aside className="space-y-3">
      <h2 className="text-sm font-bold text-slate-700">粗利改善のヒント</h2>
      {HINT_CARDS.map((card) => (
        <div
          key={card.title}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
        >
          <p
            className="text-xs font-bold"
            style={{ color: SAGE_GREEN }}
          >
            {card.title}
          </p>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">{card.body}</p>
        </div>
      ))}
    </aside>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function MarginWatchPage() {
  const [alerts, setAlerts] = useState<MarginAlert[]>([]);
  const [levelFilter, setLevelFilter] = useState<MarginAlertLevel | "all">("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("month");

  // Load alerts from store and subscribe to changes
  useEffect(() => {
    const reload = () => {
      setAlerts(marginAlertStore.all());
    };
    reload();
    marginAlertStore.addEventListener("alert-added", reload);
    marginAlertStore.addEventListener("alert-dismissed", reload);
    return () => {
      marginAlertStore.removeEventListener("alert-added", reload);
      marginAlertStore.removeEventListener("alert-dismissed", reload);
    };
  }, []);

  // Unique project IDs for filter
  const projectOptions = useMemo(() => {
    const ids = new Set(alerts.map((a) => a.projectId));
    return Array.from(ids);
  }, [alerts]);

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    const since = sinceDate(dateFilter);
    const threshold = since.toISOString();
    return alerts.filter((a) => {
      if (levelFilter !== "all" && a.level !== levelFilter) return false;
      if (projectFilter !== "all" && a.projectId !== projectFilter) return false;
      if (a.raisedAt < threshold) return false;
      return true;
    });
  }, [alerts, levelFilter, projectFilter, dateFilter]);

  // KPI counts
  const criticalCount = alerts.filter((a) => a.level === "critical").length;
  const avgMargin =
    alerts.length > 0
      ? alerts.reduce((s, a) => s + a.marginRatioPct, 0) / alerts.length
      : 0;
  const warningContractSum = alerts
    .filter((a) => a.level === "critical" || a.level === "warning")
    .reduce((s, a) => s + Math.max(0, -a.deltaFromTargetPct * 1_000_000), 0);

  function handleDismiss(alertId: string) {
    marginAlertStore.dismiss(alertId);
  }

  const ALL_LEVELS: MarginAlertLevel[] = ["critical", "warning", "caution", "safe"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">📊 粗利ウォッチ</h1>
        <p className="mt-0.5 text-sm text-slate-500">粗利率25%下回りを即警告。原因分類と改善提案を自動生成。</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">全案件数</p>
          <p className="mt-1 text-2xl font-bold leading-none text-slate-800">
            {new Set(alerts.map((a) => a.projectId)).size}
          </p>
        </div>
        <div
          className="rounded-2xl border bg-white px-5 py-4 shadow-sm"
          style={{ borderColor: criticalCount > 0 ? DANGER_RED : "#e2e8f0" }}
        >
          <p className="text-xs font-medium text-slate-500">重大件数</p>
          <p
            className="mt-1 text-2xl font-bold leading-none"
            style={{ color: criticalCount > 0 ? DANGER_RED : SAGE_GREEN }}
          >
            {criticalCount}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">平均粗利率</p>
          <p
            className="mt-1 text-2xl font-bold leading-none"
            style={{ color: avgMargin < 25 ? DANGER_RED : SAGE_GREEN }}
          >
            {fmtPct(avgMargin)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">警告中の発生額</p>
          <p
            className="mt-1 text-2xl font-bold leading-none"
            style={{ color: warningContractSum > 0 ? DANGER_RED : SAGE_GREEN }}
          >
            {fmtCurrency(warningContractSum)}
          </p>
        </div>
      </div>

      {/* Main layout: table + hint panel */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left: filter + table */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as MarginAlertLevel | "all")}
              aria-label="レベルフィルタ"
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm focus:outline-none"
            >
              <option value="all">全レベル</option>
              {ALL_LEVELS.map((l) => (
                <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
              ))}
            </select>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              aria-label="案件フィルタ"
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm focus:outline-none"
            >
              <option value="all">全案件</option>
              {projectOptions.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              aria-label="期間フィルタ"
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm focus:outline-none"
            >
              {(Object.keys(DATE_FILTER_LABELS) as DateFilter[]).map((k) => (
                <option key={k} value={k}>{DATE_FILTER_LABELS[k]}</option>
              ))}
            </select>
          </div>

          {/* Alert table */}
          {alerts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
              <p className="text-sm text-slate-500">粗利アラートはありません</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-800">
                  アラート一覧
                  <span
                    className="ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold text-white"
                    style={{ background: criticalCount > 0 ? DANGER_RED : "#94a3b8" }}
                  >
                    {filteredAlerts.length}
                  </span>
                </h2>
              </div>
              <div className="overflow-x-auto px-4">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs text-slate-400">
                      <th className="pb-2 pt-3 pr-3 font-medium">案件名</th>
                      <th className="pb-2 pt-3 pr-3 font-medium">レベル</th>
                      <th className="pb-2 pt-3 pr-3 font-medium">実粗利率</th>
                      <th className="pb-2 pt-3 pr-3 font-medium">予測粗利率</th>
                      <th className="pb-2 pt-3 pr-3 font-medium">目標差</th>
                      <th className="pb-2 pt-3 pr-3 font-medium">原因</th>
                      <th className="pb-2 pt-3 pr-3 font-medium">日時</th>
                      <th className="pb-2 pt-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-4 text-center text-sm text-slate-400">
                          フィルタ条件に一致するアラートがありません
                        </td>
                      </tr>
                    ) : (
                      filteredAlerts.map((alert) => (
                        <AlertRow
                          key={alert.id}
                          alert={alert}
                          onDismiss={handleDismiss}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right: hint panel */}
        <div className="lg:w-64 shrink-0">
          <HintPanel />
        </div>
      </div>
    </div>
  );
}
