/**
 * receipt-ocr-parser — Sprint 67
 *
 * OCRエンジンが出力した生テキストから構造化レシートデータを抽出する。
 * OCRエンジン自体は呼ばない（rawText 前提の契約）。
 *
 * 既存の receipt-ocr.ts のパースロジックを再利用し、
 * Sprint 67 が要求する ReceiptOcrResult 型で返す。
 */

import {
  parseDateFromText,
  parseAmountsFromText,
  parseVendorFromText,
} from "./receipt-ocr.js";

// ── 型 ────────────────────────────────────────────────

export type ReceiptLineItem = {
  name: string;
  qty: number;
  unitPrice: number;
};

export type ReceiptOcrResult = {
  /** 店名・事業者名 */
  vendor: string;
  /** ISO 8601 日付文字列 (例: "2025-04-15")。不明時は空文字 */
  date: string;
  /** 合計金額（税込）。整数（円） */
  totalAmount: number;
  /** 品目リスト（行解析で取得できた場合） */
  items: ReceiptLineItem[];
  /** 入力生テキスト */
  rawText: string;
  /** 信頼度スコア 0.0–1.0 */
  confidence: number;
};

// ── 品目行パース ──────────────────────────────────────

/**
 * 「品目名 [数量x]  金額」形式の行をパースする。
 * 例: "サンドイッチ 324"  /  "ボルト M8 2x 220"
 */
function parseItemLines(text: string): ReceiptLineItem[] {
  const items: ReceiptLineItem[] = [];
  const lines = text.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    // スキップ: 合計/小計/税/空行/日付っぽい行
    if (!line) continue;
    if (/合計|小計|消費税|税額|TOTAL|subtotal|^\d{4}[年/\-]/i.test(line)) continue;

    // パターン: テキスト部分 + 末尾の数字（価格）
    // オプションの数量: "名前 2x 1100" or "名前 x2 1100"
    const withQty = line.match(/^(.+?)\s+(\d+)[xｘ×]\s*([\d,]+)\s*$/);
    if (withQty) {
      const name = withQty[1].replace(/[¥￥※\s]+$/, "").trim();
      const qty = parseInt(withQty[2], 10);
      const unitPrice = parseInt(withQty[3].replace(/,/g, ""), 10);
      if (name && qty > 0 && unitPrice > 0) {
        items.push({ name, qty, unitPrice });
        continue;
      }
    }

    // パターン: テキスト部分 + 末尾の価格のみ（数量 1 と仮定）
    const simple = line.match(/^(.+?)\s+[¥￥]?([\d,]+)\s*$/);
    if (simple) {
      const name = simple[1].replace(/[¥￥※\s]+$/, "").trim();
      const unitPrice = parseInt(simple[2].replace(/,/g, ""), 10);
      // 単価が大きすぎる（合計行の可能性）または小さすぎる場合はスキップ
      if (name && unitPrice >= 1 && unitPrice < 1_000_000) {
        items.push({ name, qty: 1, unitPrice });
      }
    }
  }

  return items;
}

// ── 信頼度算出 ────────────────────────────────────────

/**
 * パース結果の信頼度スコアを 0.0–1.0 で算出する。
 * vendor/date/totalAmount がすべて揃っていれば 1.0 に近い値を返す。
 */
function calcConfidence(result: Omit<ReceiptOcrResult, "confidence">): number {
  let score = 0;
  if (result.vendor !== "不明") score += 0.35;
  if (result.date !== "") score += 0.35;
  if (result.totalAmount > 0) score += 0.3;
  return Math.round(score * 100) / 100;
}

// ── メインエントリ ────────────────────────────────────

/**
 * OCR後の生テキストから ReceiptOcrResult を返す。
 *
 * @param rawText - OCRが出力したテキスト（または手動貼付けテキスト）
 */
export function parseReceiptText(rawText: string): ReceiptOcrResult {
  const vendor = parseVendorFromText(rawText);
  const date = parseDateFromText(rawText);
  const { total: totalAmount } = parseAmountsFromText(rawText);
  const items = parseItemLines(rawText);

  const partial = { vendor, date, totalAmount, items, rawText };
  const confidence = calcConfidence(partial);

  return { ...partial, confidence };
}
