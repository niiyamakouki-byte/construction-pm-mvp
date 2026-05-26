/**
 * freee-deal-mapper — ReceiptOCRResult から freee 取引(deal)データへの変換。
 *
 * Sprint 67: OCR テキスト → freee deal データ構造変換。
 * 実 API 呼び出しは Sprint 67-2 で実装 (Client ID/Secret 投入後)。
 *
 * TODO(Sprint 67-2): freee API POST /api/1/deals を実装する。
 *   参照: https://developer.freee.co.jp/docs/accounting/reference#/Deals/create_deal
 */

import type { ReceiptOCRResult } from "./receipt-ocr.js";

// ── 型 ────────────────────────────────────────────────

/** freee 仕訳明細の1行（借方または貸方） */
export type FreeeJournalLine = {
  /** 借方/貸方 */
  entrySide: "debit" | "credit";
  /** 勘定科目名 */
  accountItemName: string;
  /** 税区分コード (例: "tax_10", "tax_8_reduced", "tax_exempt") */
  taxCode: string;
  /** 金額（円） */
  amount: number;
  /** 取引先名（任意） */
  partnerName?: string;
  /** 摘要 */
  description: string;
};

/** freee deal 登録ペイロード */
export type FreeeDealPayload = {
  /** freee 事業所ID */
  companyId: number;
  /** 取引日 (ISO 8601: YYYY-MM-DD) */
  issueDate: string;
  /** 取引種別: "expense" = 支出 */
  type: "expense" | "income";
  /** 仕訳明細リスト */
  details: FreeeJournalLine[];
  /** 取引先ID（任意） */
  partnerId?: number;
  /** 手動確認が必要な場合 true */
  needsReview: boolean;
  /** 自動仕分け根拠メモ */
  autoClassifiedBy?: string;
};

/** mapReceiptToFreeeDeal のオプション */
export type FreeeDealMapOptions = {
  /** freee 事業所ID */
  companyId: number;
  /** 借方勘定科目ID（フォールバック用。未指定時は自動推定） */
  accountItemId?: number;
  /** 取引先ID（任意） */
  partnerId?: number;
};

// ── 勘定科目マッピングルール ──────────────────────────

type AccountRule = {
  pattern: RegExp;
  /** 勘定科目名 */
  accountItemName: string;
  /** 税区分コード */
  taxCode: string;
  /** 要確認フラグ */
  needsReview?: boolean;
};

/**
 * 店名キーワード → 勘定科目マッピングテーブル。
 * 上から順に最初にマッチしたルールを使用する。
 */
const ACCOUNT_RULES: AccountRule[] = [
  // ガソリン・燃料 → 車両費
  {
    pattern: /ガソリン|ENEOS|エネオス|出光|idemitsu|昭和シェル|showa\s*shell|コスモ石油|cosmo/i,
    accountItemName: "車両費",
    taxCode: "tax_10",
  },
  // タクシー・電車・バス → 旅費交通費
  {
    pattern: /タクシー|taxi|JR|電車|バス|bus|京王|東急|小田急|東京メトロ|都営|首都高|NEXCO|ETC|Suica|suica|PASMO|pasmo/i,
    accountItemName: "旅費交通費",
    taxCode: "tax_10",
  },
  // コンビニ → 雑費 + 要確認
  {
    pattern: /コンビニ|セブン[イ-ン]レブン|7[\-−]?eleven|ローソン|lawson|ファミリーマート|ファミマ|family\s*mart|デイリーヤマザキ|ミニストップ/i,
    accountItemName: "雑費",
    taxCode: "tax_10",
    needsReview: true,
  },
  // Amazon・Yahoo・楽天 → 消耗品費 + 要確認
  {
    pattern: /Amazon|アマゾン|Yahoo|ヤフー|楽天|rakuten/i,
    accountItemName: "消耗品費",
    taxCode: "tax_10",
    needsReview: true,
  },
  // 建材・資材店 → 仕入高
  {
    pattern: /建材|DCM|カインズ|コーナン|ビバホーム|ロイヤルホームセンター|ナフコ|ジョイフル本田|ケイヨーデイツー|○○商店/i,
    accountItemName: "仕入高",
    taxCode: "tax_10",
  },
];

const FALLBACK_ACCOUNT = "雑費";
const FALLBACK_TAX_CODE = "tax_10";

/**
 * 店名から勘定科目ルールを推定する。
 * マッチしない場合は雑費 + needsReview=true を返す。
 */
export function inferAccountRule(storeName: string): AccountRule & { needsReview: boolean } {
  for (const rule of ACCOUNT_RULES) {
    if (rule.pattern.test(storeName)) {
      return { ...rule, needsReview: rule.needsReview ?? false };
    }
  }
  return {
    pattern: /.*/,
    accountItemName: FALLBACK_ACCOUNT,
    taxCode: FALLBACK_TAX_CODE,
    needsReview: true,
  };
}

// ── メインエントリ ────────────────────────────────────

/**
 * ReceiptOCRResult を freee deal 登録ペイロードに変換する。
 *
 * 仕訳構造:
 *   借方: 推定勘定科目 (例: 車両費)
 *   貸方: 現金 or 未払金 (支払い方法による)
 *
 * @param receipt - parseReceiptText() の出力
 * @param options - companyId / accountItemId / partnerId
 * @returns FreeeDealPayload
 */
export function mapReceiptToFreeeDeal(
  receipt: ReceiptOCRResult,
  options: FreeeDealMapOptions,
): FreeeDealPayload {
  const rule = inferAccountRule(receipt.storeName);

  const issueDate =
    receipt.date || new Date().toISOString().slice(0, 10);

  const memo = buildMemo(receipt);

  // 貸方勘定: 支払い方法から推定
  const creditAccount = inferCreditAccount(receipt.paymentMethod);

  const details: FreeeJournalLine[] = [
    // 借方: 費用科目
    {
      entrySide: "debit",
      accountItemName: rule.accountItemName,
      taxCode: rule.taxCode,
      amount: receipt.total,
      ...(options.partnerId !== undefined && {
        partnerName: receipt.storeName,
      }),
      description: memo,
    },
    // 貸方: 支払い科目
    {
      entrySide: "credit",
      accountItemName: creditAccount,
      taxCode: "tax_exempt",
      amount: receipt.total,
      description: memo,
    },
  ];

  const needsReview =
    rule.needsReview ||
    receipt.date === "" ||
    receipt.total === 0;

  return {
    companyId: options.companyId,
    issueDate,
    type: "expense",
    details,
    ...(options.partnerId !== undefined && { partnerId: options.partnerId }),
    needsReview,
    autoClassifiedBy: `store:"${receipt.storeName}" → ${rule.accountItemName}`,
  };
}

// ── ヘルパー ──────────────────────────────────────────

function inferCreditAccount(paymentMethod?: string): string {
  if (!paymentMethod) return "未払金";
  if (paymentMethod === "現金") return "現金";
  if (paymentMethod === "カード") return "未払金";
  if (paymentMethod === "電子マネー") return "未払金";
  // PayPay / LINE Pay / 楽天ペイ等
  return "未払金";
}

function buildMemo(receipt: ReceiptOCRResult): string {
  const parts: string[] = [];
  if (receipt.storeName && receipt.storeName !== "不明") {
    parts.push(receipt.storeName);
  }
  if (receipt.subtotal !== undefined) {
    parts.push(`小計${receipt.subtotal.toLocaleString("ja-JP")}円`);
  }
  if (receipt.tax !== undefined) {
    parts.push(`消費税${receipt.tax.toLocaleString("ja-JP")}円`);
  }
  if (receipt.paymentMethod) {
    parts.push(receipt.paymentMethod);
  }
  return parts.length > 0 ? parts.join(" / ") : "レシートより";
}
