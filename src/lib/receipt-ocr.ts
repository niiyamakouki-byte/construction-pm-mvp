/**
 * receipt-ocr — OCR後のレシートテキストから構造化データを抽出する。
 *
 * OCRエンジン本体は呼ばない。rawText（手動貼付けまたは将来のOCR出力）を
 * 受け取り、日付・店名・金額・品目を正規表現で抽出して返す。
 */

// ── 型 ────────────────────────────────────────────────

/** Sprint 67: 品目行の構造化データ */
export type ReceiptItem = {
  /** 品目名 */
  name: string;
  /** 数量 (取得できた場合) */
  quantity?: number;
  /** 単価 (取得できた場合) */
  unitPrice?: number;
  /** 小計金額 */
  amount: number;
};

/** Sprint 67: parseReceiptText の新インターフェース (ReceiptData の上位互換) */
export type ReceiptOCRResult = {
  /** 店名・事業者名 */
  storeName: string;
  /** ISO 8601 日付文字列 (例: "2025-04-15") */
  date: string;
  /** 品目リスト */
  items: ReceiptItem[];
  /** 小計（税抜）。取得できた場合のみ */
  subtotal?: number;
  /** 消費税額。取得できた場合のみ */
  tax?: number;
  /** 合計金額（税込）。整数（円） */
  total: number;
  /** 支払い方法 */
  paymentMethod?: string;
};

/** 後方互換: 既存コードが使う ReceiptData 型 */
export type ReceiptData = {
  /** ISO 8601 日付文字列 (例: "2025-04-15") */
  date: string;
  /** 店名・事業者名 */
  vendor: string;
  /** 合計金額（税込）。整数（円） */
  total: number;
  /** 小計（税抜）。取得できた場合のみ */
  subtotal?: number;
  /** 消費税額。取得できた場合のみ */
  tax?: number;
  /** 軽減税率（8%）対象品目名のリスト */
  reduced_tax_items?: string[];
  /** 元のOCRテキスト（参照用） */
  raw_text: string;
};

// ── 日付パース ─────────────────────────────────────────

/**
 * 和暦 (令和) の年をグレゴリオ暦に変換する。
 * 令和元年 = 2019年。
 */
function reiwaToWestern(reiwaYear: number): number {
  return reiwaYear + 2018;
}

/**
 * テキストから最初に見つかった日付を ISO 8601 (YYYY-MM-DD) に変換して返す。
 * 対応フォーマット:
 *   - 2025年4月15日 / 2025年04月15日
 *   - 2025/4/15 / 2025-4-15
 *   - R7.4.15 / R07.04.15 (令和)
 *   - 令和7年4月15日
 */
export function parseDateFromText(text: string): string {
  // 令和 (R...) パターン: R7.4.15 or R07.04.15
  const reiwaShort = /R(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{1,2})/i;
  const reiwaShortMatch = text.match(reiwaShort);
  if (reiwaShortMatch) {
    const year = reiwaToWestern(parseInt(reiwaShortMatch[1], 10));
    const month = parseInt(reiwaShortMatch[2], 10);
    const day = parseInt(reiwaShortMatch[3], 10);
    return formatDate(year, month, day);
  }

  // 令和X年XX月XX日
  const reiwaKanji = /令和(\d{1,2})年(\d{1,2})月(\d{1,2})日/;
  const reiwaKanjiMatch = text.match(reiwaKanji);
  if (reiwaKanjiMatch) {
    const year = reiwaToWestern(parseInt(reiwaKanjiMatch[1], 10));
    const month = parseInt(reiwaKanjiMatch[2], 10);
    const day = parseInt(reiwaKanjiMatch[3], 10);
    return formatDate(year, month, day);
  }

  // YYYY年M月D日
  const kanjiDate = /(\d{4})年(\d{1,2})月(\d{1,2})日/;
  const kanjiMatch = text.match(kanjiDate);
  if (kanjiMatch) {
    return formatDate(
      parseInt(kanjiMatch[1], 10),
      parseInt(kanjiMatch[2], 10),
      parseInt(kanjiMatch[3], 10),
    );
  }

  // YYYY/M/D or YYYY-M-D
  const slashDate = /(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/;
  const slashMatch = text.match(slashDate);
  if (slashMatch) {
    return formatDate(
      parseInt(slashMatch[1], 10),
      parseInt(slashMatch[2], 10),
      parseInt(slashMatch[3], 10),
    );
  }

  return "";
}

function formatDate(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

// ── 金額パース ─────────────────────────────────────────

/**
 * カンマ区切り・¥記号付き金額文字列を整数に変換する。
 * 例: "¥3,300" → 3300 / "3300" → 3300
 */
function parseMoney(s: string): number {
  return parseInt(s.replace(/[¥,\s]/g, ""), 10);
}

/**
 * テキストから合計・小計・消費税を抽出する。
 * 優先順位: 合計 > 小計＋税 > 数字の中で最大値
 */
export function parseAmountsFromText(text: string): {
  total: number;
  subtotal?: number;
  tax?: number;
} {
  // 合計金額パターン (複数種類)
  // 「合計 ¥3,300」「合計金額 3,300円」「お会計 ¥3,300」「お買上合計 ¥3,300」「（税込）¥3,300」
  const totalPatterns = [
    /(?:合計金額|合計|合 計|お会計|お買上合計|請求合計|ご請求金額|総計|TOTAL|total)\s*[：:￥¥]?\s*([\d,]+)/i,
    /[¥￥]([\d,]+)\s*[（(]税込[)）]/,
    /[（(]税込[)）]\s*[¥￥]?\s*([\d,]+)/,
  ];

  let total = 0;
  for (const pattern of totalPatterns) {
    const m = text.match(pattern);
    if (m) {
      total = parseMoney(m[1]);
      break;
    }
  }

  // 小計
  const subtotalPattern =
    /(?:小計|小 計|SUBTOTAL|subtotal)\s*[：:￥¥]?\s*([\d,]+)/i;
  const subtotalMatch = text.match(subtotalPattern);
  const subtotal = subtotalMatch ? parseMoney(subtotalMatch[1]) : undefined;

  // 消費税
  const taxPatterns = [
    /(?:消費税|税額|内税|外税|TAX)\s*[（(]?(?:10%|8%)?[)）]?\s*[：:￥¥]?\s*([\d,]+)/i,
    /(?:消費税等)\s*[：:￥¥]?\s*([\d,]+)/i,
  ];
  let tax: number | undefined;
  for (const pattern of taxPatterns) {
    const m = text.match(pattern);
    if (m) {
      tax = parseMoney(m[1]);
      break;
    }
  }

  // 合計が取れなかった場合: 小計 + 税 で算出
  if (total === 0 && subtotal !== undefined && tax !== undefined) {
    total = subtotal + tax;
  }

  return { total, subtotal, tax };
}

// ── 店名抽出 ──────────────────────────────────────────

/**
 * テキストから店名（事業者名）を推定する。
 * 戦略:
 *   1. 「店名:」「お店:」などのラベル付き行
 *   2. 「株式会社」「有限会社」「合同会社」を含む行
 *   3. 先頭から最初の非空白行（レシートは通常店名が一番上）
 */
export function parseVendorFromText(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // ラベル付き
  for (const line of lines) {
    const m = line.match(/(?:店名|店舗名|事業者名|お店)\s*[：:]\s*(.+)/);
    if (m) return m[1].trim();
  }

  // 会社形態を含む行
  for (const line of lines) {
    if (/株式会社|有限会社|合同会社|個人事業|㈱/.test(line)) {
      return line.replace(/^[　\s]+|[　\s]+$/g, "");
    }
  }

  // 先頭の非空白行（ただし日付・金額っぽい行はスキップ）
  for (const line of lines) {
    if (/^\d{4}[年/\-]/.test(line)) continue; // 日付行
    if (/^[¥￥\d]/.test(line)) continue; // 金額行
    if (line.length < 2) continue;
    return line;
  }

  return "不明";
}

// ── 軽減税率品目 ─────────────────────────────────────

/**
 * 軽減税率対象品目を抽出する。
 * 「※」マーク付き行または「軽減税率対象」注記の前後の品目名を返す。
 */
export function parseReducedTaxItems(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const items: string[] = [];

  for (const line of lines) {
    // ※印が付いている行（商品名 ※ or ※ 商品名）
    if (/※/.test(line)) {
      // 金額部分を除去して品目名を取り出す
      const name = line
        .replace(/[¥￥][\d,]+/g, "")
        .replace(/※/g, "")
        .replace(/\d+/g, "")
        .trim();
      if (name.length > 0) {
        items.push(name);
      }
    }
    // 「軽減税率」ラベルがある行
    if (/軽減税率対象/.test(line)) {
      const name = line.replace(/軽減税率対象.*/, "").trim();
      if (name.length > 0) {
        items.push(name);
      }
    }
  }

  return items;
}

// ── 品目行パース ──────────────────────────────────────

/**
 * テキストから品目行を抽出する。
 * 対応パターン:
 *   - 品目名  数量  単価  小計
 *   - 品目名  金額
 * 合計/小計/税/日付/店名行はスキップする。
 */
export function parseItemsFromText(text: string): ReceiptItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: ReceiptItem[] = [];

  // スキップするキーワード行
  const skipPattern = /^(?:合計|小計|消費税|内税|外税|税額|税込|TAX|TOTAL|subtotal|お会計|請求|ご請求|領収|レシート|お買上|お客様|ありがとう|店名|店舗|電話|TEL|FAX|住所|〒|\d{4}[年/\-])/i;

  for (const line of lines) {
    if (skipPattern.test(line)) continue;

    // パターン1: 品目 数量 単価 小計 (4フィールド)
    // 例: "コーヒー 2 300 600" or "コーヒー 2点 ¥300 ¥600"
    const pat4 = /^(.+?)\s+(\d+)[点個本枚袋箱]?\s+[¥￥]?([\d,]+)\s+[¥￥]?([\d,]+)\s*$/;
    const m4 = line.match(pat4);
    if (m4) {
      const name = m4[1].trim();
      if (name.length === 0) continue;
      items.push({
        name,
        quantity: parseInt(m4[2], 10),
        unitPrice: parseMoney(m4[3]),
        amount: parseMoney(m4[4]),
      });
      continue;
    }

    // パターン2: 品目 金額 (2フィールド、金額は末尾)
    // 例: "コーヒー ¥500" or "コーヒー 500"
    const pat2 = /^(.+?)\s+[¥￥]?([\d,]+)\s*(?:円)?\s*$/;
    const m2 = line.match(pat2);
    if (m2) {
      const name = m2[1].trim();
      // 名前が数字だけ/記号のみの場合はスキップ
      if (name.length === 0 || /^[\d,¥￥\s]+$/.test(name)) continue;
      // 金額が0の場合もスキップ
      const amount = parseMoney(m2[2]);
      if (amount === 0) continue;
      items.push({ name, amount });
      continue;
    }
  }

  return items;
}

// ── 支払い方法抽出 ────────────────────────────────────

/**
 * テキストから支払い方法を抽出する。
 * キーワードマッチで最初に見つかったものを返す。
 */
export function parsePaymentMethodFromText(text: string): string | undefined {
  if (/PayPay|ペイペイ/i.test(text)) return "PayPay";
  if (/楽天ペイ|RakutenPay/i.test(text)) return "楽天ペイ";
  if (/LINE\s*Pay|ラインペイ/i.test(text)) return "LINE Pay";
  if (/Suica|スイカ|PASMO|パスモ|交通系/i.test(text)) return "電子マネー";
  if (/電子マネー|iD|QUICPay|nanaco|WAON/i.test(text)) return "電子マネー";
  if (/クレジット|credit|VISA|visa|Mastercard|JCB|AMEX|Diners|カード払い/i.test(text)) return "カード";
  if (/現金|CASH|cash/i.test(text)) return "現金";
  return undefined;
}

// ── メインエントリ (Sprint 67) ────────────────────────

/**
 * OCR後の生テキストからレシート構造データを抽出する (Sprint 67 版)。
 * ReceiptOCRResult を返す。items / paymentMethod を含む。
 *
 * @param rawText - OCRが出力したテキスト（または手動貼付けテキスト）
 * @returns ReceiptOCRResult - 構造化されたレシートデータ
 */
export function parseReceiptText(rawText: string): ReceiptOCRResult {
  const date = parseDateFromText(rawText);
  const storeName = parseVendorFromText(rawText);
  const { total, subtotal, tax } = parseAmountsFromText(rawText);
  const items = parseItemsFromText(rawText);
  const paymentMethod = parsePaymentMethodFromText(rawText);

  return {
    storeName,
    date,
    items,
    ...(subtotal !== undefined && { subtotal }),
    ...(tax !== undefined && { tax }),
    total,
    ...(paymentMethod !== undefined && { paymentMethod }),
  };
}

/**
 * 後方互換ラッパー: ReceiptData を返す旧形式。
 * 既存の ReceiptUploadPage / freee-journal-mapper が使う。
 * @deprecated Sprint 67-2 で parseReceiptText に統一予定
 */
export function parseReceiptTextLegacy(rawText: string): ReceiptData {
  const date = parseDateFromText(rawText);
  const vendor = parseVendorFromText(rawText);
  const { total, subtotal, tax } = parseAmountsFromText(rawText);
  const reduced_tax_items = parseReducedTaxItems(rawText);

  return {
    date,
    vendor,
    total,
    ...(subtotal !== undefined && { subtotal }),
    ...(tax !== undefined && { tax }),
    ...(reduced_tax_items.length > 0 && { reduced_tax_items }),
    raw_text: rawText,
  };
}
