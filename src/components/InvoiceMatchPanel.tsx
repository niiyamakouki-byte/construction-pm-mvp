/**
 * InvoiceMatchPanel — freee 入金照合パネル (v2-cozy スタイル)
 *
 * - 左: 未照合の請求書一覧
 * - 右: 候補 freee 取引一覧（スコア順）
 * - 「確定」「却下」ボタン
 * - 一括 auto-match ボタン (score >= 0.9 のみ)
 */

import { useState } from "react";
import type { Invoice } from "../lib/invoice-store.js";
import type { MatchCandidate, MatchResult, FreeeDeal } from "../lib/freee/MatchingEngine.js";

// ── 型 ────────────────────────────────────────────────

export type MatchAction = {
  invoiceId: string;
  dealId: number;
  score: number;
  reason: string;
  by: "auto" | "manual";
};

type Props = {
  matchResult: MatchResult;
  onConfirm: (action: MatchAction) => void;
  onReject: (invoiceId: string, dealId: number) => void;
  onAutoMatchAll: (actions: MatchAction[]) => void;
};

// ── Helpers ───────────────────────────────────────────

const currencyFmt = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

function fmtAmount(n: number): string {
  return currencyFmt.format(n);
}

function scoreColor(score: number): string {
  if (score >= 0.9) return "text-emerald-700 bg-emerald-50";
  if (score >= 0.7) return "text-amber-700 bg-amber-50";
  return "text-slate-500 bg-slate-100";
}

// ── Sub-components ────────────────────────────────────

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-sm font-medium text-slate-800 truncate">{invoice.vendorName}</p>
      <p className="mt-0.5 text-xs text-slate-500">{invoice.invoiceDate}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{fmtAmount(invoice.total)}</p>
      <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
        {invoice.status}
      </span>
    </div>
  );
}

function DealRow({
  candidate,
  onConfirm,
  onReject,
}: {
  candidate: MatchCandidate;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const { deal, score, reasons } = candidate;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">
            {deal.partner_name ?? "（取引先不明）"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{deal.issue_date}</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">{fmtAmount(deal.amount)}</p>
          <ul className="mt-1 space-y-0.5">
            {reasons.map((r, i) => (
              <li key={i} className="text-xs text-slate-400">{r}</li>
            ))}
          </ul>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${scoreColor(score)}`}
        >
          {Math.round(score * 100)}%
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-emerald-700 active:opacity-80"
        >
          確定
        </button>
        <button
          type="button"
          onClick={onReject}
          className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs text-slate-600 transition-colors duration-150 hover:bg-slate-50 active:opacity-80"
        >
          却下
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────

export function InvoiceMatchPanel({ matchResult, onConfirm, onReject, onAutoMatchAll }: Props) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    matchResult.matched[0]?.invoice.id ?? null,
  );

  const autoCandidates = matchResult.matched.filter((c) => c.score >= 0.9);

  const selectedCandidates: MatchCandidate[] = matchResult.matched.filter(
    (c) => c.invoice.id === selectedInvoiceId,
  );

  const selectedUnmatched: Invoice | undefined = matchResult.unmatched.find(
    (inv) => inv.id === selectedInvoiceId,
  );

  function handleAutoMatchAll() {
    const actions: MatchAction[] = autoCandidates.map((c) => ({
      invoiceId: c.invoice.id,
      dealId: c.deal.id,
      score: c.score,
      reason: c.reasons.join(" / "),
      by: "auto",
    }));
    onAutoMatchAll(actions);
  }

  function handleConfirm(candidate: MatchCandidate) {
    onConfirm({
      invoiceId: candidate.invoice.id,
      dealId: candidate.deal.id,
      score: candidate.score,
      reason: candidate.reasons.join(" / "),
      by: "manual",
    });
  }

  const allInvoices: Invoice[] = [
    ...matchResult.matched.map((c) => c.invoice),
    ...matchResult.unmatched,
  ];

  return (
    <div className="flex h-full flex-col gap-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">入金照合（会計連携）</h2>
        {autoCandidates.length > 0 && (
          <button
            type="button"
            onClick={handleAutoMatchAll}
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-emerald-700 active:opacity-80"
          >
            一括 auto-match ({autoCandidates.length}件)
          </button>
        )}
      </div>

      {/* 2カラムレイアウト */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* 左: 請求書一覧 */}
        <div className="flex w-2/5 flex-col gap-2 overflow-y-auto">
          <p className="text-xs font-medium text-slate-500">
            請求書 ({allInvoices.length}件)
          </p>
          {allInvoices.map((inv) => (
            <button
              key={inv.id}
              type="button"
              onClick={() => setSelectedInvoiceId(inv.id)}
              className={`text-left transition-shadow duration-150 ${
                selectedInvoiceId === inv.id
                  ? "ring-2 ring-emerald-500 ring-offset-1 rounded-xl"
                  : ""
              }`}
            >
              <InvoiceRow invoice={inv} />
            </button>
          ))}
          {allInvoices.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
              請求書がありません
            </p>
          )}
        </div>

        {/* 右: 候補取引一覧 */}
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          <p className="text-xs font-medium text-slate-500">
            会計ソフトの候補取引
            {selectedInvoiceId && selectedCandidates.length > 0
              ? ` (${selectedCandidates.length}件)`
              : ""}
          </p>
          {selectedCandidates.length > 0 &&
            selectedCandidates.map((candidate) => (
              <DealRow
                key={`${candidate.invoice.id}-${candidate.deal.id}`}
                candidate={candidate}
                onConfirm={() => handleConfirm(candidate)}
                onReject={() => onReject(candidate.invoice.id, candidate.deal.id)}
              />
            ))}
          {selectedUnmatched && (
            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
              照合候補なし
            </div>
          )}
          {!selectedInvoiceId && (
            <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
              左の請求書を選択してください
            </p>
          )}
        </div>
      </div>

      {/* フッター統計 */}
      <div className="flex gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>照合済: {matchResult.matched.length}件</span>
        <span>未照合: {matchResult.unmatched.length}件</span>
        <span className="text-emerald-600">
          確定推奨 (90%+): {autoCandidates.length}件
        </span>
      </div>
    </div>
  );
}
