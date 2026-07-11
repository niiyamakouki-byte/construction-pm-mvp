/**
 * CostLossDashboardPage — 原価ロス検知ダッシュボード
 *
 * プロジェクト選択 → LossSummary 表示。
 * v2-cozy: セージグリーン #6B8E5A / 危険のみ #C53030
 */

import { useEffect, useMemo, useState } from "react";
import { getLossStore } from "../lib/cost-loss-detector/loss-store.js";
import { runAllDetectors, aggregateLoss } from "../lib/cost-loss-detector/loss-aggregator.js";
import type { LossSignal, LossSummary, LossKind } from "../lib/cost-loss-detector/types.js";
import { LossKind as LossKindEnum } from "../lib/cost-loss-detector/types.js";
import type { Severity } from "../lib/cost-loss-detector/types.js";

// ── Constants ──────────────────────────────────────────────────────────────

const SAGE_GREEN = "#6B8E5A";
const DANGER_RED = "#C53030";

const KIND_LABELS: Record<LossKind, string> = {
  material_surplus: "材料余剰",
  material_shortage_emergency: "緊急再発注",
  labor_overrun: "工数超過",
  out_of_scope_order: "見積外発注",
  price_creep: "見積単価超過",
  wastage_high: "歩留り悪化",
};

const SEVERITY_LABELS: Record<Severity, string> = {
  info: "情報",
  warning: "警告",
  critical: "重大",
};

const SEVERITY_COLORS: Record<Severity, string> = {
  info: "#94a3b8",
  warning: "#d97706",
  critical: DANGER_RED,
};

const ALL_KINDS = Object.values(LossKindEnum) as LossKind[];
const ALL_SEVERITIES: Severity[] = ["info", "warning", "critical"];

// ── Formatters ─────────────────────────────────────────────────────────────

function fmtCurrency(yen: number): string {
  if (yen >= 100_000_000) return `¥${(yen / 100_000_000).toFixed(1)}億`;
  if (yen >= 10_000) return `¥${Math.round(yen / 10_000)}万`;
  return `¥${Math.round(yen).toLocaleString("ja-JP")}`;
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

// ── Sub-components ─────────────────────────────────────────────────────────

type SeverityBadgeProps = { severity: Severity };

function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white"
      style={{ background: SEVERITY_COLORS[severity] }}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

type KindBadgeProps = { kind: LossKind };

function KindBadge({ kind }: KindBadgeProps) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      {KIND_LABELS[kind]}
    </span>
  );
}

type SignalRowProps = {
  signal: LossSignal;
  onResolve: (id: string) => void;
};

function SignalRow({ signal, onResolve }: SignalRowProps) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2.5 pr-3">
        <KindBadge kind={signal.kind} />
      </td>
      <td className="py-2.5 pr-3">
        <SeverityBadge severity={signal.severity} />
      </td>
      <td
        className="py-2.5 pr-3 text-sm font-semibold"
        style={{ color: signal.severity === "critical" ? DANGER_RED : "inherit" }}
      >
        {fmtCurrency(signal.lossYen)}
      </td>
      <td className="py-2.5 pr-3 text-xs text-slate-400">{fmtDate(signal.detectedAt)}</td>
      <td className="py-2.5 pr-3 text-xs text-slate-500 max-w-xs">
        {signal.suggestedAction}
      </td>
      <td className="py-2.5">
        <button
          type="button"
          onClick={() => onResolve(signal.id)}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 active:bg-slate-100"
        >
          対応済
        </button>
      </td>
    </tr>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export type CostLossDashboardPageProps = {
  /** Available project IDs to select from */
  projectIds: string[];
  /** Human-readable label for each project ID */
  projectLabels?: Record<string, string>;
};

export function CostLossDashboardPage({
  projectIds,
  projectLabels = {},
}: CostLossDashboardPageProps) {
  const store = getLossStore();

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projectIds[0] ?? "",
  );
  const [signals, setSignals] = useState<LossSignal[]>([]);
  const [severityFilter, setSeverityFilter] = useState<Severity | "">("");
  const [kindFilter, setKindFilter] = useState<LossKind | "">("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Load signals from store for selected project
  useEffect(() => {
    if (!selectedProjectId) return;

    const reload = () => {
      setSignals(store.signalsForProject(selectedProjectId));
    };

    reload();
    store.addEventListener("change", reload);
    return () => store.removeEventListener("change", reload);
  }, [store, selectedProjectId]);

  const summary = useMemo<LossSummary>(
    () => aggregateLoss(signals),
    [signals],
  );

  const filteredSignals = useMemo(() => {
    return signals.filter((s) => {
      if (severityFilter && s.severity !== severityFilter) return false;
      if (kindFilter && s.kind !== kindFilter) return false;
      if (dateFrom && s.detectedAt < dateFrom) return false;
      if (dateTo && s.detectedAt > dateTo + "T23:59:59Z") return false;
      return true;
    });
  }, [signals, severityFilter, kindFilter, dateFrom, dateTo]);

  const criticalCount = signals.filter((s) => s.severity === "critical").length;
  const warningCount = signals.filter((s) => s.severity === "warning").length;
  const infoCount = signals.filter((s) => s.severity === "info").length;

  function handleResolve(signalId: string) {
    store.markResolved(signalId);
  }

  return (
    <div className="space-y-6">
      {/* Header + project selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">原価ロス検知</h1>
          <p className="mt-0.5 text-sm text-slate-500">材料余剰・工数超過・見積外発注をリアルタイム検知</p>
        </div>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          aria-label="案件選択"
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        >
          {projectIds.map((id) => (
            <option key={id} value={id}>
              {projectLabels[id] ?? id}
            </option>
          ))}
        </select>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total loss */}
        <div
          className="rounded-2xl border bg-white px-5 py-4 shadow-sm col-span-2 sm:col-span-1"
          style={{ borderColor: summary.totalLossYen > 0 ? DANGER_RED : "#e2e8f0" }}
        >
          <p className="text-xs font-medium text-slate-500">推定ロス合計</p>
          <p
            className="mt-1 text-2xl font-bold leading-none"
            style={{ color: summary.totalLossYen > 0 ? DANGER_RED : SAGE_GREEN }}
          >
            {fmtCurrency(summary.totalLossYen)}
          </p>
          <p className="mt-1 text-xs text-slate-400">{signals.length}件のシグナル</p>
        </div>
        {/* Severity counts */}
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">重大</p>
          <p
            className="mt-1 text-2xl font-bold leading-none"
            style={{ color: criticalCount > 0 ? DANGER_RED : SAGE_GREEN }}
          >
            {criticalCount}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">警告</p>
          <p className="mt-1 text-2xl font-bold leading-none" style={{ color: "#d97706" }}>
            {warningCount}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">情報</p>
          <p className="mt-1 text-2xl font-bold leading-none text-slate-600">{infoCount}</p>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-2">
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as Severity | "")}
          aria-label="severity フィルタ"
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        >
          <option value="">全severity</option>
          {ALL_SEVERITIES.map((s) => (
            <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as LossKind | "")}
          aria-label="kind フィルタ"
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        >
          <option value="">全種別</option>
          {ALL_KINDS.map((k) => (
            <option key={k} value={k}>{KIND_LABELS[k]}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="開始日"
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="終了日"
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        />
        {(severityFilter || kindFilter || dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => {
              setSeverityFilter("");
              setKindFilter("");
              setDateFrom("");
              setDateTo("");
            }}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-500 shadow-sm hover:bg-slate-50"
          >
            リセット
          </button>
        )}
      </div>

      {/* Signal table */}
      {signals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-sm text-slate-500">
            この案件に検知されたロスシグナルはありません
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">
              ロスシグナル一覧
              <span
                className="ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold text-white"
                style={{ background: criticalCount > 0 ? DANGER_RED : "#94a3b8" }}
              >
                {filteredSignals.length}
              </span>
            </h2>
          </div>
          <div className="overflow-x-auto px-4">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-slate-400">
                  <th className="pb-2 pt-3 pr-3 font-medium">種別</th>
                  <th className="pb-2 pt-3 pr-3 font-medium">severity</th>
                  <th className="pb-2 pt-3 pr-3 font-medium">推定ロス</th>
                  <th className="pb-2 pt-3 pr-3 font-medium">検知日</th>
                  <th className="pb-2 pt-3 pr-3 font-medium">推奨アクション</th>
                  <th className="pb-2 pt-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filteredSignals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-sm text-slate-400">
                      フィルタ条件に一致するシグナルがありません
                    </td>
                  </tr>
                ) : (
                  filteredSignals.map((signal) => (
                    <SignalRow
                      key={signal.id}
                      signal={signal}
                      onResolve={handleResolve}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
