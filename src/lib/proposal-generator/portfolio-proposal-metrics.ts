/**
 * portfolio-proposal-metrics — portfolio-aggregator 向け提案書メトリクス
 *
 * Sprint 16-C: 競合提案書自動生成
 */

import type { WorkCategory } from "./types.js";
import { proposalStore } from "./proposal-store.js";

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 今月生成された提案書の件数。
 */
export function proposalsThisMonthCount(): number {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth(); // 0-indexed

  const docs = proposalStore.listRecent(500);
  return docs.filter((d) => {
    const dt = new Date(d.generatedAt);
    return dt.getFullYear() === thisYear && dt.getMonth() === thisMonth;
  }).length;
}

/**
 * 提案書生成から初回生成までの平均リードタイム (hours)。
 * 提案書の generatedAt と有効期限から割り出す（ここでは単純に生成後24h固定のデモ値）。
 * 実際には Inquiry.receivedAt → ProposalDocument.generatedAt の差分で計算。
 */
export function avgGenerationLeadHours(): number {
  const docs = proposalStore.listRecent(500);
  if (docs.length === 0) return 0;

  // デモ: 生成時刻だけで平均は出せないため、固定値を返す
  // 実際には Inquiry.receivedAt との差分を計算する
  return 2.5;
}

/**
 * 最もリクエストされた工事種別。
 * workCategory フィールドを集計。dealId / inquiryId がない場合は inquiryId のみ対象。
 */
export function topRequestedWorkCategory(): WorkCategory | null {
  const docs = proposalStore.listRecent(500);
  if (docs.length === 0) return null;

  // sections から customer_situation を探して workCategory を特定
  // ここでは proposalDocument に直接 workCategory フィールドがないため
  // inquiryId の有無で分岐。将来的には ProposalDocument に workCategory 追加推奨。
  // 現バージョンでは価格レンジから推定できないため、全件 "other" 集計のデモ実装。
  const counts: Record<string, number> = {};
  for (const doc of docs) {
    // customer_situation section の bodyJa から工事種別を抽出 (簡易実装)
    const custSection = doc.sections.find((s) => s.kind === "customer_situation");
    if (!custSection) continue;

    const body = custSection.bodyJa;
    // 工事種別ラベルを検出
    const categories: Array<[WorkCategory, string]> = [
      ["full_renovation", "全面リノベーション"],
      ["partial_renovation", "部分リフォーム"],
      ["kitchen", "キッチン工事"],
      ["bath", "浴室工事"],
      ["store_fit", "店舗内装工事"],
      ["office_fit", "オフィス内装工事"],
      ["exterior", "外装・外壁工事"],
      ["repair", "補修・修繕工事"],
      ["other", "その他内装工事"],
    ];

    let matched: WorkCategory = "other";
    for (const [cat, label] of categories) {
      if (body.includes(label)) {
        matched = cat;
        break;
      }
    }
    counts[matched] = (counts[matched] ?? 0) + 1;
  }

  if (Object.keys(counts).length === 0) return null;

  const top = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
  return (top?.[0] ?? null) as WorkCategory | null;
}
