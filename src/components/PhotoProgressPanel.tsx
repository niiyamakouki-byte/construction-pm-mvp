/**
 * PhotoProgressPanel — photo-progress-tracker 統合UI
 * PhotoGrid に渡された写真群から工種ごとの進捗率を推定して表示する。
 *
 * ロジック方針（純フロントエンド、AIコールなし）:
 * - "after"/"完成後" タグあり → completionRate=1.0, confidence=0.9
 * - "before"/"着工前" タグあり → completionRate=0.0, confidence=0.9
 * - タグなし → completionRate=0.5, confidence=0.5
 * - タグから WorkCategory を推定し、aggregateTradeProgress で集約
 */

import { useState } from "react";
import type { PhotoMetadata } from "../lib/photo-organizer.js";
import { aggregateTradeProgress } from "../lib/photo-progress-tracker.js";
import type { TradeProgress } from "../lib/photo-progress-tracker.js";
import type { WorkCategory } from "../lib/ai-schedule-generator.js";

// ─── Tag → WorkCategory mapping ───────────────────────────────────────────────

const TAG_TO_TRADE: Array<[RegExp, WorkCategory]> = [
  [/解体|撤去/, "demolition"],
  [/軽鉄|LGS|下地|framing/, "framing"],
  [/電気|配線|配管|給排水|設備粗/, "mep_rough"],
  [/設備仕上|照明|スイッチ|コンセント/, "mep_finish"],
  [/内装|ボード|パテ|下地/, "interior_rough"],
  [/クロス|塗装|タイル|フローリング|仕上/, "interior_finish"],
  [/外装|外壁|facade/, "exterior"],
  [/防水|waterproof/, "waterproof"],
  [/塗装|painting/, "painting"],
  [/清掃|cleaning/, "cleaning"],
];

function inferTrade(tags: string[]): WorkCategory {
  const haystack = tags.join(" ");
  for (const [pattern, trade] of TAG_TO_TRADE) {
    if (pattern.test(haystack)) return trade;
  }
  return "other";
}

// ─── Convert PhotoMetadata[] → TradeProgress[] ────────────────────────────────

function photosToTradeProgress(photos: PhotoMetadata[]): TradeProgress[] {
  return photos.map((photo) => {
    const isAfter = photo.tags.includes("after") || photo.tags.includes("完成後");
    const isBefore = photo.tags.includes("before") || photo.tags.includes("着工前");

    let completionRate: number;
    let confidence: number;

    if (isAfter) {
      completionRate = 1.0;
      confidence = 0.9;
    } else if (isBefore) {
      completionRate = 0.0;
      confidence = 0.9;
    } else {
      completionRate = 0.5;
      confidence = 0.5;
    }

    return {
      trade: inferTrade(photo.tags),
      completionRate,
      confidence,
      photoId: photo.id,
      evidenceNotes: photo.description || undefined,
      capturedAt: new Date(photo.capturedAt),
    };
  });
}

// ─── Trade label map ──────────────────────────────────────────────────────────

const TRADE_LABEL: Record<WorkCategory, string> = {
  demolition: "解体",
  framing: "軽量鉄骨",
  mep_rough: "設備粗配管",
  mep_finish: "設備仕上",
  interior_rough: "内装下地",
  interior_finish: "内装仕上",
  exterior: "外装",
  waterproof: "防水",
  painting: "塗装",
  cleaning: "清掃",
  other: "その他",
};

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  photos: PhotoMetadata[];
};

export function PhotoProgressPanel({ photos }: Props) {
  const [analyzed, setAnalyzed] = useState(false);

  if (photos.length === 0) return null;

  const handleAnalyze = () => {
    setAnalyzed(true);
  };

  if (!analyzed) {
    return (
      <div className="mt-4 flex items-center justify-end">
        <button
          type="button"
          onClick={handleAnalyze}
          className="rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          進捗を分析
        </button>
      </div>
    );
  }

  const progressList = photosToTradeProgress(photos);
  const aggregated = aggregateTradeProgress(progressList);

  if (aggregated.size === 0) return null;

  const entries = Array.from(aggregated.entries()).sort(([, a], [, b]) => b.completionRate - a.completionRate);

  return (
    <div className="mt-4 rounded-2xl bg-white/90 px-4 py-4 ring-1 ring-slate-200">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">工種別進捗分析</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
          {photos.length}枚から推定
        </span>
      </div>
      <div className="space-y-2" data-testid="progress-analysis-results">
        {entries.map(([trade, p]) => {
          const pct = Math.round(p.completionRate * 100);
          const confPct = Math.round(p.confidence * 100);
          const label = TRADE_LABEL[trade] ?? trade;
          return (
            <div key={trade} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span className="w-20 shrink-0 font-semibold text-slate-700">{label}</span>
              <div className="flex-1 rounded-full bg-slate-200 h-2">
                <div
                  className="h-2 rounded-full bg-brand-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right tabular-nums font-semibold">{pct}%</span>
              <span className="shrink-0 text-slate-400">信頼度{confPct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
