/**
 * receipt-classifier — Sprint 67
 *
 * ReceiptOcrResult を freee カテゴリに分類し、
 * freee DealInput 用ペイロードに変換する。
 *
 * 既存の freee/deal_mapper.ts の inferExpenseCategory / resolveAccountItem を再利用。
 */

import type { DealInput } from "./freee/types.js";
import {
  inferExpenseCategory,
  resolveAccountItem,
} from "./freee/deal_mapper.js";
import type { ReceiptOcrResult } from "./receipt-ocr-parser.js";

// ── 型 ────────────────────────────────────────────────

export type ReceiptCategory = {
  /** freee 勘定科目カテゴリ: subcontract / material / labor / general */
  category: "subcontract" | "material" | "labor" | "general";
  /** freee 勘定科目 ID */
  accountItemId: number;
  /** freee 税コード (21 = 10%, 0 = 非課税) */
  taxCode: number;
  /** 信頼度スコア 0.0–1.0 */
  confidence: number;
};

export type FreeeDealInput = DealInput;

// ── 分類 ─────────────────────────────────────────────

/**
 * ReceiptOcrResult から freee カテゴリを推定する。
 * vendor 名と品目名を結合して inferExpenseCategory に渡す。
 */
export function classifyReceipt(parsed: ReceiptOcrResult): ReceiptCategory {
  const searchText = [
    parsed.vendor,
    ...parsed.items.map((i) => i.name),
  ].join(" ");

  const category = inferExpenseCategory(searchText);
  const { accountItemId, taxCode } = resolveAccountItem("expense", searchText);

  // vendor と totalAmount が揃っていれば分類信頼度は parsed.confidence を引き継ぐ
  const confidence = parsed.confidence;

  return { category, accountItemId, taxCode, confidence };
}

// ── freee deal 変換 ───────────────────────────────────

/**
 * ReceiptOcrResult + ReceiptCategory → freee DealInput に変換する。
 * mapProjectToDeal の出力形状に合わせた expense 取引として組み立てる。
 *
 * @param parsed    parseReceiptText() の出力
 * @param category  classifyReceipt() の出力
 * @param projectId GenbaHub 案件 ID（freee ref_number に使用）。省略可
 */
export function receiptToFreeeDeal(
  parsed: ReceiptOcrResult,
  category: ReceiptCategory,
  projectId?: string,
): FreeeDealInput {
  const issueDate = parsed.date || new Date().toISOString().slice(0, 10);
  const amount = parsed.totalAmount;

  const description = [
    parsed.vendor,
    ...parsed.items.map((i) => `${i.name} x${i.qty}`),
  ]
    .filter(Boolean)
    .join(" / ")
    .slice(0, 255); // freee の摘要欄上限

  return {
    issue_date: issueDate,
    due_date: issueDate,
    amount,
    type: "expense",
    ref_number: projectId,
    details: [
      {
        id: 0,
        account_item_id: category.accountItemId,
        tax_code: category.taxCode,
        amount,
        description,
      },
    ],
  };
}
