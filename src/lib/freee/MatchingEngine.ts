/**
 * freee 入金照合エンジン
 *
 * スコアリングルール:
 *   金額完全一致         +0.50
 *   金額 ±1% 以内        +0.30
 *   取引先名 fuzzy 一致  +0.20  (Levenshtein 類似度 >= 0.8)
 *   振込日 +30 日以内    +0.15
 *   ref_number に請求書 ID 末尾 4 桁含む +0.15
 *
 * score >= 0.9 → 確定推奨
 * score >= 0.7 → auto match 候補
 */

import type { Invoice } from "../invoice-store.js";

// ── 型定義 ────────────────────────────────────────────

export type FreeeDeal = {
  id: number;
  issue_date: string;      // "YYYY-MM-DD"
  amount: number;
  partner_name?: string;
  ref_number?: string;
  status: "settled" | "unsettled" | "partial";
};

export type MatchCandidate = {
  invoice: Invoice;
  deal: FreeeDeal;
  score: number;
  reasons: string[];
};

export type MatchResult = {
  matched: MatchCandidate[];
  unmatched: Invoice[];
};

// ── Levenshtein 類似度 ────────────────────────────────

/**
 * 0.0–1.0 の文字列類似度（Levenshtein 距離ベース）。
 * どちらかが空文字なら 0 を返す。
 */
export function levenshteinSimilarity(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la === lb) return 1;

  const maxLen = Math.max(la.length, lb.length);
  const dist = levenshteinDistance(la, lb);
  return 1 - dist / maxLen;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!;
      } else {
        dp[i]![j] =
          1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
      }
    }
  }
  return dp[m]![n]!;
}

// ── スコアリング ──────────────────────────────────────

const MS_PER_DAY = 86_400_000;

function dateDiffDays(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / MS_PER_DAY;
}

function scoreCandidate(
  invoice: Invoice,
  deal: FreeeDeal,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // 金額マッチ
  const amountDiffRatio =
    invoice.total === 0
      ? Infinity
      : Math.abs(invoice.total - deal.amount) / invoice.total;

  if (amountDiffRatio === 0) {
    score += 0.5;
    reasons.push("金額完全一致");
  } else if (amountDiffRatio <= 0.01) {
    score += 0.3;
    reasons.push(`金額±1%以内 (差額 ${Math.round(amountDiffRatio * 100 * 100) / 100}%)`);
  }

  // 取引先名 fuzzy
  if (invoice.vendorName && deal.partner_name) {
    const sim = levenshteinSimilarity(invoice.vendorName, deal.partner_name);
    if (sim >= 0.8) {
      score += 0.2;
      reasons.push(`取引先名一致 (類似度 ${Math.round(sim * 100)}%)`);
    }
  }

  // 振込日 = issue_date + 30 日以内（入金先行き含む）
  if (invoice.invoiceDate && deal.issue_date) {
    const diff = dateDiffDays(invoice.invoiceDate, deal.issue_date);
    if (diff >= 0 && diff <= 30) {
      score += 0.15;
      reasons.push(`振込日 +${Math.round(diff)} 日以内`);
    }
  }

  // ref_number に invoice.id 末尾 4 桁
  if (deal.ref_number) {
    const tail4 = invoice.id.slice(-4);
    if (deal.ref_number.includes(tail4)) {
      score += 0.15;
      reasons.push(`ref_number に請求書 ID 末尾 4 桁 (${tail4}) 含む`);
    }
  }

  return { score: Math.min(score, 1), reasons };
}

// ── メインエクスポート ─────────────────────────────────

/**
 * 請求書リストを freee 取引リストと照合する。
 * 各請求書について最高スコアの deal を候補として返す。
 * score >= 0.7 の候補のみ matched に含む。
 */
export function matchInvoicesToFreeeDeals(
  invoices: Invoice[],
  deals: FreeeDeal[],
): MatchResult {
  const matched: MatchCandidate[] = [];
  const unmatched: Invoice[] = [];

  for (const invoice of invoices) {
    let best: MatchCandidate | null = null;

    for (const deal of deals) {
      const { score, reasons } = scoreCandidate(invoice, deal);
      if (!best || score > best.score) {
        best = { invoice, deal, score, reasons };
      }
    }

    if (best && best.score >= 0.7) {
      matched.push(best);
    } else {
      unmatched.push(invoice);
    }
  }

  // スコア降順
  matched.sort((a, b) => b.score - a.score);

  return { matched, unmatched };
}
