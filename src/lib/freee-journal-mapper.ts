/**
 * freee-journal-mapper — ReceiptData から freee 仕訳ドラフトへのマッピング。
 *
 * vendor 名をパターンマッチして勘定科目を推定し、
 * 軽減税率の有無で税コードを決定する。
 */

import type { ReceiptData } from "./receipt-ocr.js";

// ── 型 ────────────────────────────────────────────────

export type FreeeJournalDraft = {
  /** 取引日 (ISO 8601: YYYY-MM-DD) */
  issue_date: string;
  /** 合計金額（税込）。整数（円） */
  amount: number;
  /** 勘定科目名 */
  account_item: string;
  /** 税コード: 8 = 軽減税率 8% / 10 = 標準税率 10% */
  tax_code: 8 | 10;
  /** 取引先名（vendor） */
  partner_name: string;
  /** freee 摘要欄 */
  description: string;
  /** 手動確認が必要な場合 true */
  needs_review: boolean;
};

// ── 勘定科目ルール ────────────────────────────────────

type AccountRule = {
  /** vendor名にマッチする正規表現 */
  pattern: RegExp;
  /**
   * 勘定科目。関数の場合は金額を受け取って決定する。
   * amount は税込合計（円）。
   */
  account: string | ((amount: number) => string);
};

const ACCOUNT_RULES: AccountRule[] = [
  // コンビニ: 1万未満→消耗品費、1万以上→会議費
  {
    pattern: /セブン[イ-ン]レブン|7[\-−]?eleven|ローソン|lawson|ファミリーマート|ファミマ|family\s*mart/i,
    account: (amount) => (amount < 10_000 ? "消耗品費" : "会議費"),
  },
  // 交通系
  {
    pattern: /JR|京王|東急|小田急|東京メトロ|都営|首都高|NEXCO|ETC/i,
    account: "旅費交通費",
  },
  // カフェ系
  {
    pattern: /スターバックス|starbucks|ドトール|doutor|エクセルシオール|タリーズ|tully/i,
    account: "会議費",
  },
  // EC・消耗品
  {
    pattern: /アマゾン|amazon|モノタロウ|monotaro|ヨドバシ|yodobashi/i,
    account: (amount) => (amount < 100_000 ? "消耗品費" : "工具器具備品"),
  },
  // ガソリン
  {
    pattern: /ENEOS|エネオス|出光|idemitsu|シェル|shell|コスモ|cosmo/i,
    account: "車両費",
  },
  // 飲食（接待候補）
  {
    pattern: /くら寿司|サイゼリヤ|餃子の王将|王将|焼肉|すき家|吉野家|松屋|マクドナルド|mcdonald/i,
    account: (amount) => (amount >= 5_000 ? "接待交際費" : "会議費"),
  },
];

const UNCLASSIFIED = "未分類 (要確認)";

/**
 * vendor 名と金額から勘定科目を推定する。
 * マッチしない場合は "未分類 (要確認)" を返す。
 */
export function inferAccountItem(vendor: string, amount: number): string {
  for (const rule of ACCOUNT_RULES) {
    if (rule.pattern.test(vendor)) {
      return typeof rule.account === "function"
        ? rule.account(amount)
        : rule.account;
    }
  }
  return UNCLASSIFIED;
}

/**
 * 軽減税率品目の有無から税コードを決定する。
 * reduced_tax_items が1件以上あれば 8、なければ 10。
 */
export function inferTaxCode(receipt: ReceiptData): 8 | 10 {
  if (receipt.reduced_tax_items && receipt.reduced_tax_items.length > 0) {
    return 8;
  }
  return 10;
}

// ── メインエントリ ────────────────────────────────────

/**
 * ReceiptData を freee 仕訳ドラフトに変換する。
 *
 * @param receipt - parseReceiptText() の出力
 * @param account_hint - 呼び出し元からの勘定科目ヒント（指定時は推定より優先）
 */
export function mapToJournal(
  receipt: ReceiptData,
  account_hint?: string,
): FreeeJournalDraft {
  const account_item =
    account_hint ?? inferAccountItem(receipt.vendor, receipt.total);

  const needs_review =
    account_item === UNCLASSIFIED ||
    receipt.date === "" ||
    receipt.total === 0;

  const description = buildDescription(receipt);

  return {
    issue_date: receipt.date || new Date().toISOString().slice(0, 10),
    amount: receipt.total,
    account_item,
    tax_code: inferTaxCode(receipt),
    partner_name: receipt.vendor,
    description,
    needs_review,
  };
}

function buildDescription(receipt: ReceiptData): string {
  const parts: string[] = [];
  if (receipt.vendor !== "不明") parts.push(receipt.vendor);
  if (receipt.subtotal !== undefined) {
    parts.push(`小計${receipt.subtotal.toLocaleString("ja-JP")}円`);
  }
  if (receipt.tax !== undefined) {
    parts.push(`税${receipt.tax.toLocaleString("ja-JP")}円`);
  }
  if (parts.length === 0) return "レシートより";
  return parts.join(" / ");
}
