/**
 * receipt-ocr — OCR後のレシートテキストから構造化データを抽出する。
 *
 * OCRエンジン本体は呼ばない。rawText（手動貼付けまたは将来のOCR出力）を
 * 受け取り、日付・店名・金額・品目を正規表現で抽出して返す。
 */

// ── 型 ────────────────────────────────────────────────

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

// ── メインエントリ ────────────────────────────────────

/**
 * OCR後の生テキストからレシート構造データを抽出する。
 *
 * @param rawText - OCRが出力したテキスト（または手動貼付けテキスト）
 * @returns ReceiptData - 構造化されたレシートデータ
 */
export function parseReceiptText(rawText: string): ReceiptData {
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
