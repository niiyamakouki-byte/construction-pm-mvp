/**
 * 発行済み請求書と freee 入金記録の照合ロジック
 *
 * - GenbaHub 側の Invoice と freee API の Invoice を突合
 * - 完全一致（金額 + 日付 ±3 日）→ "exact"
 * - 金額のみ一致                  → "amount_only"
 * - 一致なし                      → "none"
 */

import type { FreeeClient } from "./client.js";
import type { Invoice as FreeeInvoice } from "./types.js";
import type { Invoice as GenbaInvoice } from "../invoice-store.js";

export type MatchType = "exact" | "amount_only" | "none";

export type MatchResult = {
  invoiceId: string;
  freeeInvoiceId?: number;
  matchType: MatchType;
  confidence: number;         // 0.0 – 1.0
  discrepancies?: string[];
};

// ── Helpers ──────────────────────────────────────────

const MS_PER_DAY = 86_400_000;
const DATE_TOLERANCE_DAYS = 3;

function parseDateMs(dateStr: string): number {
  return new Date(dateStr).getTime();
}

function dateDiffDays(a: string, b: string): number {
  return Math.abs(parseDateMs(a) - parseDateMs(b)) / MS_PER_DAY;
}

/**
 * GenbaHub の金額（税込 total）と freee の total_amount を比較する。
 * 完全一致 = 金額が等しい + 請求日の差が ±3 日以内。
 */
function scoreMatch(
  genba: GenbaInvoice,
  freee: FreeeInvoice,
): { matchType: MatchType; confidence: number; discrepancies: string[] } {
  const discrepancies: string[] = [];
  const amountMatch = genba.total === freee.total_amount;

  if (!amountMatch) {
    discrepancies.push(
      `金額不一致: LapoSite=${genba.total}, freee=${freee.total_amount}`,
    );
  }

  const dateDiff =
    genba.invoiceDate && freee.issue_date
      ? dateDiffDays(genba.invoiceDate, freee.issue_date)
      : Infinity;

  const dateMatch = dateDiff <= DATE_TOLERANCE_DAYS;

  if (!dateMatch && isFinite(dateDiff)) {
    discrepancies.push(
      `日付差 ${dateDiff.toFixed(0)} 日（許容 ${DATE_TOLERANCE_DAYS} 日）`,
    );
  }

  if (amountMatch && dateMatch) {
    return { matchType: "exact", confidence: 1.0, discrepancies: [] };
  }

  if (amountMatch) {
    return { matchType: "amount_only", confidence: 0.6, discrepancies };
  }

  return { matchType: "none", confidence: 0.0, discrepancies };
}

// ── Main export ───────────────────────────────────────

/**
 * GenbaHub の請求書リストを freee の請求書と照合する。
 * クライアントが未設定の場合は全件 "none" を返す（no-op）。
 *
 * @param client      FreeeClient インスタンス
 * @param companyId   freee 事業所 ID
 * @param genbahubInvoices  GenbaHub 側の請求書一覧
 */
export async function matchInvoices(
  client: FreeeClient,
  companyId: number,
  genbahubInvoices: GenbaInvoice[],
): Promise<MatchResult[]> {
  if (!client.isConfigured() || genbahubInvoices.length === 0) {
    return genbahubInvoices.map((inv) => ({
      invoiceId: inv.id,
      matchType: "none" as MatchType,
      confidence: 0,
    }));
  }

  const freeeInvoices = await client.listInvoices(companyId);

  return genbahubInvoices.map((genba) => {
    let best: { score: ReturnType<typeof scoreMatch>; freeeId: number } | null = null;

    for (const freee of freeeInvoices) {
      const score = scoreMatch(genba, freee);
      if (
        !best ||
        score.confidence > best.score.confidence ||
        (score.confidence === best.score.confidence &&
          score.matchType === "exact" &&
          best.score.matchType !== "exact")
      ) {
        best = { score, freeeId: freee.id };
      }
    }

    const bestScore = best?.score;
    const bestId = best?.freeeId;

    if (!best || bestScore?.matchType === "none") {
      return {
        invoiceId: genba.id,
        matchType: "none" as MatchType,
        confidence: 0,
        discrepancies: bestScore?.discrepancies,
      };
    }

    return {
      invoiceId: genba.id,
      freeeInvoiceId: bestId,
      matchType: bestScore!.matchType,
      confidence: bestScore!.confidence,
      discrepancies:
        bestScore!.discrepancies.length > 0 ? bestScore!.discrepancies : undefined,
    };
  });
}
