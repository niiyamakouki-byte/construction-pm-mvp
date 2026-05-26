/**
 * Vendor Rating AI — UI
 * 業者評価ページ: 4軸スコアテーブル + 詳細パネル + 発注推奨モーダル
 * v2-cozy: セージグリーン #6B8E5A 軸、装飾最小
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { calculateScore } from "../lib/vendor-rating/score-calculator.js";
import { VendorEventStore } from "../lib/vendor-rating/event-store.js";
import { recommendForCategory } from "../lib/vendor-rating/recommendation-engine.js";
import type { VendorScore, VendorEvent, VendorRecommendation } from "../lib/vendor-rating/types.js";
import type { Vendor } from "../lib/vendor-rating/recommendation-engine.js";

// ── Mini score bar ────────────────────────────────────────────────

function ScoreBar({ value }: { value: number }) {
  const clamp = Math.min(100, Math.max(0, value));
  const color =
    clamp >= 70 ? "#6B8E5A" : clamp >= 40 ? "#D97706" : "#DC2626";
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="h-1.5 rounded-full bg-slate-100"
        style={{ width: 64 }}
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${clamp}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-7 text-right text-xs tabular-nums text-slate-600">
        {clamp}
      </span>
    </div>
  );
}

// ── Signal badge ──────────────────────────────────────────────────

const SIGNAL_STYLES = {
  recommended: "bg-sage-50 text-sage-700 border border-sage-200",
  caution: "bg-amber-50 text-amber-700 border border-amber-200",
  avoid: "bg-red-50 text-red-700 border border-red-200",
} as const;

const SIGNAL_LABELS = {
  recommended: "推奨",
  caution: "要注意",
  avoid: "非推奨",
} as const;

function SignalBadge({ signal }: { signal: VendorRecommendation["signal"] }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${SIGNAL_STYLES[signal]}`}
    >
      {SIGNAL_LABELS[signal]}
    </span>
  );
}

// ── Detail panel ──────────────────────────────────────────────────

function DetailPanel({
  vendor,
  score,
  events,
  onClose,
}: {
  vendor: Vendor;
  score: VendorScore;
  events: VendorEvent[];
  onClose: () => void;
}) {
  const recent = [...events]
    .sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )
    .slice(0, 10);

  const suggestions: string[] = [];
  if (score.deliveryScore < 60)
    suggestions.push("納期管理の改善: 工程表を早期共有し中間確認を設ける");
  if (score.qualityScore < 60)
    suggestions.push("品質管理: 完成検査チェックリストを義務付ける");
  if (score.priceScore < 60)
    suggestions.push("価格競争力: 競合他社の見積を取り比較交渉を行う");
  if (score.commScore < 60)
    suggestions.push("コミュニケーション: 週次進捗報告の仕組みを導入する");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${vendor.name} の詳細`}
      className="fixed inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col bg-white shadow-xl"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-bold text-slate-900">{vendor.name}</h2>
        <button
          onClick={onClose}
          aria-label="閉じる"
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* 4軸スコア */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            スコア詳細
          </h3>
          <div className="space-y-1.5">
            {(
              [
                ["納期", score.deliveryScore],
                ["品質", score.qualityScore],
                ["価格", score.priceScore],
                ["対応", score.commScore],
              ] as [string, number][]
            ).map(([label, val]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-8 text-xs text-slate-600">{label}</span>
                <ScoreBar value={val} />
              </div>
            ))}
          </div>
        </section>

        {/* 直近イベント履歴 */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            直近イベント ({recent.length}件)
          </h3>
          {recent.length === 0 ? (
            <p className="text-xs text-slate-400">履歴なし</p>
          ) : (
            <ul className="space-y-1.5">
              {recent.map((e) => (
                <li key={e.id} className="rounded bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <span className="font-medium">{e.kind.replace(/_/g, " ")}</span>
                  {e.notes && (
                    <span className="ml-2 text-slate-400">{e.notes}</span>
                  )}
                  <span className="ml-auto block text-right text-slate-400">
                    {new Date(e.occurredAt).toLocaleDateString("ja-JP")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 改善提案 */}
        {suggestions.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              改善提案
            </h3>
            <ul className="space-y-1.5">
              {suggestions.map((s, i) => (
                <li key={i} className="flex gap-1.5 text-xs text-slate-700">
                  <span className="mt-0.5 shrink-0 text-amber-500">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

// ── Order recommendation modal ────────────────────────────────────

const CATEGORIES = ["内装", "電気", "設備", "塗装", "左官", "その他"];

function OrderModal({
  vendors,
  onClose,
}: {
  vendors: Vendor[];
  onClose: () => void;
}) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const recs = useMemo(
    () => recommendForCategory(category, vendors).slice(0, 3),
    [category, vendors],
  );

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="発注時推奨"
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">発注時推奨</h2>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {/* Category selector */}
        <div className="mb-4">
          <label htmlFor="category-select" className="mb-1 block text-xs text-slate-600">
            工種カテゴリ
          </label>
          <select
            id="category-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Top 3 recommendations */}
        <ol className="space-y-2">
          {recs.map((r) => (
            <li
              key={r.vendorId}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">
                  #{r.rank}
                </span>
                <span className="text-sm font-medium text-slate-900">
                  {r.vendorName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-slate-500">
                  {r.overallScore}点
                </span>
                <SignalBadge signal={r.signal} />
              </div>
            </li>
          ))}
        </ol>

        {recs.length === 0 && (
          <p className="text-center text-xs text-slate-400 py-4">
            対象業者なし
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────

export type VendorRatingPageProps = {
  vendors: Vendor[];
};

export function VendorRatingPage({ vendors }: VendorRatingPageProps) {
  const store = useMemo(() => VendorEventStore.getInstance(), []);
  const [scores, setScores] = useState<Map<string, VendorScore>>(new Map());
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const computeScores = useCallback(() => {
    const map = new Map<string, VendorScore>();
    for (const v of vendors) {
      const events = store.eventsByVendor(v.id);
      map.set(v.id, calculateScore(events));
    }
    setScores(map);
  }, [vendors, store]);

  useEffect(() => {
    computeScores();
    const handler = () => computeScores();
    store.addEventListener("change", handler);
    return () => store.removeEventListener("change", handler);
  }, [computeScores, store]);

  const recommendations = useMemo(
    () => recommendForCategory("all", vendors),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendors, scores],
  );

  const recMap = useMemo(() => {
    const m = new Map<string, VendorRecommendation>();
    for (const r of recommendations) m.set(r.vendorId, r);
    return m;
  }, [recommendations]);

  return (
    <>
      <div className="mx-auto max-w-4xl px-4 pb-24">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">業者評価</h1>
          <button
            onClick={() => setShowOrderModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors"
            style={{ backgroundColor: "#6B8E5A" }}
          >
            発注時推奨
          </button>
        </div>

        {/* Vendor table */}
        {vendors.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">
            業者が登録されていません
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">業者名</th>
                  <th className="px-4 py-3">総合</th>
                  <th className="px-4 py-3">納期</th>
                  <th className="px-4 py-3">品質</th>
                  <th className="px-4 py-3">価格</th>
                  <th className="px-4 py-3">対応</th>
                  <th className="px-4 py-3">推奨</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => {
                  const s = scores.get(v.id);
                  const rec = recMap.get(v.id);
                  return (
                    <tr
                      key={v.id}
                      onClick={() => setSelectedVendor(v)}
                      className="cursor-pointer border-b border-slate-50 hover:bg-slate-50 transition-colors last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {v.name}
                      </td>
                      <td className="px-4 py-3 font-bold tabular-nums" style={{ color: "#6B8E5A" }}>
                        {s?.overallScore ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBar value={s?.deliveryScore ?? 50} />
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBar value={s?.qualityScore ?? 50} />
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBar value={s?.priceScore ?? 50} />
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBar value={s?.commScore ?? 50} />
                      </td>
                      <td className="px-4 py-3">
                        {rec && <SignalBadge signal={rec.signal} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail panel overlay */}
      {selectedVendor && (
        <>
          <div
            className="fixed inset-0 z-20 bg-black/20"
            onClick={() => setSelectedVendor(null)}
            aria-hidden="true"
          />
          <DetailPanel
            vendor={selectedVendor}
            score={scores.get(selectedVendor.id) ?? calculateScore([])}
            events={store.eventsByVendor(selectedVendor.id)}
            onClose={() => setSelectedVendor(null)}
          />
        </>
      )}

      {/* Order modal */}
      {showOrderModal && (
        <OrderModal vendors={vendors} onClose={() => setShowOrderModal(false)} />
      )}
    </>
  );
}
