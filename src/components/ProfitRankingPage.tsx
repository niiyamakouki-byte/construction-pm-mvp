/**
 * ProfitRankingPage — 案件粗利ランキング (Sprint 14-A)
 *
 * v2-cozy: セージグリーン #6B8E5A / warning のみ #C53030
 * 複数案件を粗利率/粗利金額/工期効率でランキング表示。
 */

import { useMemo, useState } from "react";
import { buildRankingSnapshot } from "../lib/profit-ranking/ranking-builder.js";
import { explainScore_ja } from "../lib/profit-ranking/score-explainer.js";
import type { ProfitRankingEntry, RankingSortKey } from "../lib/profit-ranking/types.js";

// ── Constants ──────────────────────────────────────────────────────────────

const SAGE_GREEN = "#6B8E5A";
const DANGER_RED = "#C53030";

const SORT_KEY_LABELS: Record<RankingSortKey, string> = {
  marginRatioPct: "粗利率",
  marginAmount: "粗利金額",
  marginPerMonth: "月割粗利",
  forecastDelta: "予測差分",
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

function fmtMonths(n: number): string {
  return `${n.toFixed(1)}ヶ月`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

type BadgeChipProps = { badge: ProfitRankingEntry["badge"] };

function BadgeChip({ badge }: BadgeChipProps) {
  const label = badge === "top" ? "重点" : badge === "warning" ? "要注意" : "安定";
  const bg = badge === "warning" ? DANGER_RED : badge === "top" ? SAGE_GREEN : "#64748b";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white"
      style={{ background: bg }}
    >
      {label}
    </span>
  );
}

type RankingRowProps = { entry: ProfitRankingEntry };

function RankingRow({ entry }: RankingRowProps) {
  const { rank, projectMetrics: m, badge } = entry;
  const isWarning = badge === "warning";
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td
        className="py-2.5 pr-3 text-center text-sm font-bold tabular-nums w-10"
        style={{ color: rank <= 3 && !isWarning ? SAGE_GREEN : isWarning ? DANGER_RED : "#94a3b8" }}
      >
        {rank}
      </td>
      <td className="py-2.5 pr-3 text-sm font-medium text-slate-800 max-w-[140px] truncate">
        {m.projectName}
      </td>
      <td className="py-2.5 pr-3 text-xs text-slate-500 max-w-[100px] truncate">
        {m.clientName}
      </td>
      <td
        className="py-2.5 pr-3 text-sm font-semibold tabular-nums"
        style={{ color: isWarning ? DANGER_RED : "inherit" }}
      >
        {fmtPct(m.marginRatioPct)}
      </td>
      <td className="py-2.5 pr-3 text-sm tabular-nums text-slate-700">
        {fmtCurrency(m.marginAmount)}
      </td>
      <td className="py-2.5 pr-3 text-xs tabular-nums text-slate-500">
        {fmtMonths(m.durationMonths)}
      </td>
      <td className="py-2.5 pr-3 text-xs tabular-nums text-slate-500">
        {fmtCurrency(m.marginPerMonth)}/月
      </td>
      <td className="py-2.5">
        <BadgeChip badge={badge} />
      </td>
    </tr>
  );
}

type HintCardProps = { entry: ProfitRankingEntry };

function HintCard({ entry }: HintCardProps) {
  const isWarning = entry.badge === "warning";
  const explanation = explainScore_ja(entry);
  return (
    <div
      className="rounded-xl border bg-white px-4 py-3 shadow-sm"
      style={{ borderColor: isWarning ? DANGER_RED : SAGE_GREEN }}
    >
      <div className="flex items-center gap-2">
        <BadgeChip badge={entry.badge} />
        <p className="text-xs font-bold text-slate-700 truncate">{entry.projectMetrics.projectName}</p>
      </div>
      <p className="mt-1 text-xs text-slate-500 leading-relaxed">{explanation}</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ProfitRankingPage() {
  const [sortKey, setSortKey] = useState<RankingSortKey>("marginRatioPct");

  const snapshot = useMemo(() => buildRankingSnapshot(sortKey), [sortKey]);

  const topEntries = snapshot.entries.filter((e) => e.badge === "top").slice(0, 3);
  const warningEntries = snapshot.entries.filter((e) => e.badge === "warning").slice(0, 3);
  const hintEntries = [...warningEntries, ...topEntries].slice(0, 6);

  const topEntry = snapshot.entries[0] ?? null;
  const bottomEntry = snapshot.entries[snapshot.entries.length - 1] ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">案件粗利ランキング</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          複数案件を粗利率・金額・工期効率でランキング。重点案件と要注意案件を即特定。
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          className="rounded-2xl border bg-white px-5 py-4 shadow-sm"
          style={{ borderColor: SAGE_GREEN }}
        >
          <p className="text-xs font-medium text-slate-500">TOP案件</p>
          <p
            className="mt-1 text-sm font-bold leading-none truncate"
            style={{ color: SAGE_GREEN }}
          >
            {topEntry ? topEntry.projectMetrics.projectName : "—"}
          </p>
          {topEntry && (
            <p className="mt-0.5 text-xs text-slate-400">
              {fmtPct(topEntry.projectMetrics.marginRatioPct)}
            </p>
          )}
        </div>
        <div
          className="rounded-2xl border bg-white px-5 py-4 shadow-sm"
          style={{ borderColor: warningEntries.length > 0 ? DANGER_RED : "#e2e8f0" }}
        >
          <p className="text-xs font-medium text-slate-500">要注意案件</p>
          <p
            className="mt-1 text-sm font-bold leading-none truncate"
            style={{ color: warningEntries.length > 0 ? DANGER_RED : "#94a3b8" }}
          >
            {bottomEntry && bottomEntry.badge === "warning"
              ? bottomEntry.projectMetrics.projectName
              : warningEntries.length > 0
              ? warningEntries[0].projectMetrics.projectName
              : "なし"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">平均粗利率</p>
          <p
            className="mt-1 text-2xl font-bold leading-none tabular-nums"
            style={{ color: snapshot.avgMarginRatioPct < 25 ? DANGER_RED : SAGE_GREEN }}
          >
            {fmtPct(snapshot.avgMarginRatioPct)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">案件数</p>
          <p className="mt-1 text-2xl font-bold leading-none text-slate-800">
            {snapshot.totalProjects}
          </p>
        </div>
      </div>

      {/* Main layout: table + hint panel */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left: sort selector + table */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Sort selector */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-slate-500">ソート:</span>
            {(Object.keys(SORT_KEY_LABELS) as RankingSortKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortKey(key)}
                className="h-8 rounded-lg border px-3 text-xs font-medium transition-colors"
                style={
                  sortKey === key
                    ? { background: SAGE_GREEN, borderColor: SAGE_GREEN, color: "#fff" }
                    : { borderColor: "#e2e8f0", color: "#475569", background: "#fff" }
                }
              >
                {SORT_KEY_LABELS[key]}
              </button>
            ))}
          </div>

          {/* Ranking table */}
          {snapshot.entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
              <p className="text-sm text-slate-500">案件データがありません</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-800">
                  ランキング
                  <span
                    className="ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold text-white"
                    style={{ background: SAGE_GREEN }}
                  >
                    {snapshot.entries.length}
                  </span>
                </h2>
              </div>
              <div className="overflow-x-auto px-4">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs text-slate-400">
                      <th className="pb-2 pt-3 pr-3 font-medium w-10">順位</th>
                      <th className="pb-2 pt-3 pr-3 font-medium">案件名</th>
                      <th className="pb-2 pt-3 pr-3 font-medium">顧客</th>
                      <th className="pb-2 pt-3 pr-3 font-medium">粗利率</th>
                      <th className="pb-2 pt-3 pr-3 font-medium">粗利金額</th>
                      <th className="pb-2 pt-3 pr-3 font-medium">工期</th>
                      <th className="pb-2 pt-3 pr-3 font-medium">月割</th>
                      <th className="pb-2 pt-3 font-medium">評価</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.entries.map((entry, idx) => (
                      <RankingRow
                        key={`${entry.projectMetrics.projectId}-${idx}`}
                        entry={entry}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right: hint panel */}
        {hintEntries.length > 0 && (
          <aside className="lg:w-64 shrink-0 space-y-3">
            <h2 className="text-sm font-bold text-slate-700">重点・要注意案件</h2>
            {hintEntries.map((entry, idx) => (
              <HintCard key={`hint-${entry.projectMetrics.projectId}-${idx}`} entry={entry} />
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}
