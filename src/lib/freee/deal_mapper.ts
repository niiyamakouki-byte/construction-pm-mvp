/**
 * GenbaHub 案件 → freee deal payload 変換
 *
 * 勘定科目マッピング (cost-master ベース):
 *   income  → 売上高          (account_item_id: 1,   tax_code: 21 = 消費税 10%)
 *   expense → 工事原価         (account_item_id: 501, tax_code: 21)
 *   expense (外注) → 外注費   (account_item_id: 502, tax_code: 21)
 *   expense (材料) → 材料費   (account_item_id: 503, tax_code: 21)
 *   expense (人件費) → 労務費 (account_item_id: 504, tax_code: 0 = 非課税)
 */

import type { DealInput, DealType } from "./types.js";
import type { Project } from "../../domain/types.js";

// ── 勘定科目定数 ──────────────────────────────────────

export const ACCOUNT_ITEMS = {
  /** 売上高 */
  SALES: 1,
  /** 工事原価（汎用） */
  CONSTRUCTION_COST: 501,
  /** 外注費 */
  SUBCONTRACT: 502,
  /** 材料費 */
  MATERIAL: 503,
  /** 労務費 */
  LABOR: 504,
} as const;

/** 消費税コード: 10% */
const TAX_CODE_10 = 21;
/** 消費税コード: 非課税 */
const TAX_CODE_EXEMPT = 0;

// ── カテゴリ判定 ──────────────────────────────────────

type ExpenseCategory = "subcontract" | "material" | "labor" | "general";

/**
 * 案件名・説明からコスト種別を推定する。
 * cost-master のカテゴリ名（外注/材料/労務）に対応。
 */
export function inferExpenseCategory(text: string): ExpenseCategory {
  const t = text.toLowerCase();
  if (/外注|下請|協力業者|subcontract/.test(t)) return "subcontract";
  if (/材料|資材|仕入|material/.test(t)) return "material";
  if (/人件費|労務|給与|賃金|labor/.test(t)) return "labor";
  return "general";
}

// ── メインマッパー ───────────────────────────────────

export type MapToDealOptions = {
  /** "income" (収入) or "expense" (支出)。省略時は "income" */
  type?: DealType;
  /** freee 取引先 ID（省略可） */
  partnerId?: number;
  /** 発行日（省略時は project.startDate） */
  issueDate?: string;
  /** 支払予定日（省略時は project.endDate） */
  dueDate?: string;
};

/**
 * GenbaHub の Project を freee DealInput に変換する。
 *
 * @param project  GenbaHub 案件
 * @param options  変換オプション（type / partnerId 等）
 */
export function mapProjectToDeal(
  project: Project,
  options: MapToDealOptions = {},
): DealInput {
  const type: DealType = options.type ?? "income";
  const amount = project.budget ?? 0;
  const issueDate = options.issueDate ?? project.startDate;
  const dueDate = options.dueDate ?? project.endDate;

  const { accountItemId, taxCode } = resolveAccountItem(type, project.name);

  return {
    issue_date: issueDate,
    due_date: dueDate,
    amount,
    type,
    partner_id: options.partnerId,
    ref_number: project.id,
    details: [
      {
        id: 0,
        account_item_id: accountItemId,
        tax_code: taxCode,
        amount,
        description: project.name,
      },
    ],
  };
}

/**
 * 案件種別と名称から勘定科目 ID と税コードを解決する。
 */
export function resolveAccountItem(
  type: DealType,
  description: string,
): { accountItemId: number; taxCode: number } {
  if (type === "income") {
    return { accountItemId: ACCOUNT_ITEMS.SALES, taxCode: TAX_CODE_10 };
  }

  const category = inferExpenseCategory(description);
  switch (category) {
    case "subcontract":
      return { accountItemId: ACCOUNT_ITEMS.SUBCONTRACT, taxCode: TAX_CODE_10 };
    case "material":
      return { accountItemId: ACCOUNT_ITEMS.MATERIAL, taxCode: TAX_CODE_10 };
    case "labor":
      return { accountItemId: ACCOUNT_ITEMS.LABOR, taxCode: TAX_CODE_EXEMPT };
    default:
      return { accountItemId: ACCOUNT_ITEMS.CONSTRUCTION_COST, taxCode: TAX_CODE_10 };
  }
}
