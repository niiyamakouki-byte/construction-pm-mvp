/**
 * RepeatPredictorPage — 顧客リピート率予測ダッシュボード (Sprint 14-C)
 *
 * v2-cozy: セージ #6B8E5A / danger のみ #C53030
 */

import { useMemo, useState } from "react";
import { CustomerStore } from "../lib/repeat-predictor/customer-store.js";
import { extractSignal } from "../lib/repeat-predictor/signal-extractor.js";
import { predictRepeat } from "../lib/repeat-predictor/repeat-predictor.js";
import type { RepeatPrediction, CustomerSegment } from "../lib/repeat-predictor/types.js";

// ── Constants ──────────────────────────────────────────────────────────────

const SAGE_GREEN = "#6B8E5A";
const DANGER_RED = "#C53030";

type SortKey = "repeatProbability" | "predictedNextOrderMonths" | "totalLifetimeValue";

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  danger,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div
        className="mt-1 text-2xl font-bold tabular-nums"
        style={{ color: danger ? DANGER_RED : SAGE_GREEN }}
        data-testid={`kpi-${label}`}
      >
        {value}
      </div>
    </div>
  );
}

const SEGMENT_LABEL: Record<CustomerSegment, string> = {
  vip: "VIP",
  loyal: "優良",
  promising: "期待",
  dormant: "休眠",
  at_risk: "要注意",
};

const SEGMENT_COLOR: Record<CustomerSegment, string> = {
  vip: "#6B8E5A",
  loyal: "#3b82f6",
  promising: "#f59e0b",
  dormant: "#94a3b8",
  at_risk: "#C53030",
};

function SegmentBadge({ segment }: { segment: CustomerSegment }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white"
      style={{ background: SEGMENT_COLOR[segment] }}
    >
      {SEGMENT_LABEL[segment]}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type PredictionRow = RepeatPrediction & {
  customerName: string;
  totalLifetimeValue: number;
};

const ALL_SEGMENTS: Array<CustomerSegment | "all"> = [
  "all",
  "vip",
  "loyal",
  "promising",
  "dormant",
  "at_risk",
];

const FILTER_LABEL: Record<CustomerSegment | "all", string> = {
  all: "全員",
  vip: "VIP",
  loyal: "優良",
  promising: "期待",
  dormant: "休眠",
  at_risk: "要注意",
};

export function RepeatPredictorPage() {
  const [segmentFilter, setSegmentFilter] = useState<CustomerSegment | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("repeatProbability");

  const customerStoreInstance = useMemo(() => {
    const s = new CustomerStore();
    s.ensureSeed();
    return s;
  }, []);

  const predictions: PredictionRow[] = useMemo(() => {
    const histories = customerStoreInstance.all();
    return histories.map((h) => {
      const signal = extractSignal(h);
      const pred = predictRepeat(h.customerId, signal);
      return {
        ...pred,
        customerName: h.customerName,
        totalLifetimeValue: h.totalLifetimeValue,
      };
    });
  }, [customerStoreInstance]);

  // KPI aggregates
  const vipCount = predictions.filter((p) => p.segment === "vip").length;
  const avgRepeatPct = predictions.length > 0
    ? Math.round((predictions.reduce((sum, p) => sum + p.repeatProbability, 0) / predictions.length) * 100)
    : 0;
  const next90Count = predictions.filter((p) => p.predictedNextOrderMonths <= 3).length;
  const atRiskCount = predictions.filter((p) => p.segment === "at_risk").length;

  // Filter + sort
  const filtered = useMemo(() => {
    const base =
      segmentFilter === "all"
        ? predictions
        : predictions.filter((p) => p.segment === segmentFilter);

    return [...base].sort((a, b) => {
      if (sortKey === "repeatProbability") return b.repeatProbability - a.repeatProbability;
      if (sortKey === "predictedNextOrderMonths") return a.predictedNextOrderMonths - b.predictedNextOrderMonths;
      return b.totalLifetimeValue - a.totalLifetimeValue;
    });
  }, [predictions, segmentFilter, sortKey]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">顧客リピート率予測</h1>
        <p className="mt-1 text-sm text-slate-500">
          過去案件履歴から再発注確率と次回発注時期を予測し、営業優先順位を設定します
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="VIP顧客数" value={`${vipCount}社`} />
        <KpiCard label="リピート率予測平均" value={`${avgRepeatPct}%`} />
        <KpiCard label="90日以内発注見込" value={`${next90Count}社`} />
        <KpiCard label="離反リスク数" value={`${atRiskCount}社`} danger={atRiskCount > 0} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600">セグメント:</span>
        {ALL_SEGMENTS.map((seg) => (
          <button
            key={seg}
            onClick={() => setSegmentFilter(seg)}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            style={{
              background: segmentFilter === seg ? SAGE_GREEN : "white",
              color: segmentFilter === seg ? "white" : "#475569",
              borderColor: segmentFilter === seg ? SAGE_GREEN : "#e2e8f0",
            }}
          >
            {FILTER_LABEL[seg]}
          </button>
        ))}
        <span className="ml-4 text-sm text-slate-600">ソート:</span>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
        >
          <option value="repeatProbability">確率順</option>
          <option value="predictedNextOrderMonths">予測時期順</option>
          <option value="totalLifetimeValue">LTV順</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">顧客名</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">セグメント</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">リピート確率</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">予測時期</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">LTV</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">推奨アクション</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((row) => (
              <tr key={row.customerId} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{row.customerName}</td>
                <td className="px-4 py-3">
                  <SegmentBadge segment={row.segment} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span
                    className="font-bold"
                    style={{
                      color: row.repeatProbability >= 0.7
                        ? SAGE_GREEN
                        : row.repeatProbability < 0.3
                        ? DANGER_RED
                        : "#475569",
                    }}
                  >
                    {Math.round(row.repeatProbability * 100)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {row.predictedNextOrderMonths <= 1
                    ? "今月以内"
                    : `約${row.predictedNextOrderMonths}ヶ月後`}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {(row.totalLifetimeValue / 10000).toLocaleString("ja-JP")}万円
                </td>
                <td className="max-w-xs px-4 py-3 text-xs text-slate-600">
                  <span className="line-clamp-2">{row.recommendedAction_ja}</span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  該当する顧客がいません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
