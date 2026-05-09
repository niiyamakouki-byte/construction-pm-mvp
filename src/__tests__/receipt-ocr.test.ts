import { describe, it, expect } from "vitest";
import {
  parseDateFromText,
  parseAmountsFromText,
  parseVendorFromText,
  parseReducedTaxItems,
  parseReceiptText,
} from "../lib/receipt-ocr.js";

// ── parseDateFromText ──────────────────────────────────

describe("parseDateFromText", () => {
  it("YYYY年M月D日 パターンを ISO 8601 に変換する", () => {
    expect(parseDateFromText("2025年4月15日")).toBe("2025-04-15");
  });

  it("YYYY年MM月DD日（ゼロ埋め）を変換する", () => {
    expect(parseDateFromText("2025年04月05日")).toBe("2025-04-05");
  });

  it("YYYY/M/D スラッシュ区切りを変換する", () => {
    expect(parseDateFromText("2025/4/15")).toBe("2025-04-15");
  });

  it("YYYY-M-D ハイフン区切りを変換する", () => {
    expect(parseDateFromText("2025-4-15")).toBe("2025-04-15");
  });

  it("R7.4.15 令和短縮形を変換する", () => {
    // 令和7年 = 2025年
    expect(parseDateFromText("R7.4.15")).toBe("2025-04-15");
  });

  it("令和X年MM月DD日 漢字形式を変換する", () => {
    expect(parseDateFromText("令和7年4月15日")).toBe("2025-04-15");
  });

  it("日付が見つからない場合は空文字を返す", () => {
    expect(parseDateFromText("お会計 ¥3,300")).toBe("");
  });

  it("複数の日付候補がある場合は最初のマッチを返す", () => {
    expect(parseDateFromText("2025年4月15日 発行 2025年5月1日 支払期限")).toBe("2025-04-15");
  });
});

// ── parseAmountsFromText ───────────────────────────────

describe("parseAmountsFromText", () => {
  it("合計 ¥3,300 形式を取得する", () => {
    const { total } = parseAmountsFromText("合計 ¥3,300");
    expect(total).toBe(3300);
  });

  it("合計金額 3,300円 形式を取得する", () => {
    const { total } = parseAmountsFromText("合計金額 3,300");
    expect(total).toBe(3300);
  });

  it("（税込）¥3,300 形式を取得する", () => {
    const { total } = parseAmountsFromText("¥3,300（税込）");
    expect(total).toBe(3300);
  });

  it("小計 + 消費税 → 合計を算出する", () => {
    const text = "小計 3,000\n消費税 300\n合計 3,300";
    const { total, subtotal, tax } = parseAmountsFromText(text);
    expect(subtotal).toBe(3000);
    expect(tax).toBe(300);
    expect(total).toBe(3300);
  });

  it("消費税がない場合 tax は undefined", () => {
    const { tax } = parseAmountsFromText("合計 ¥1,100");
    expect(tax).toBeUndefined();
  });

  it("金額が見つからない場合 total は 0", () => {
    const { total } = parseAmountsFromText("セブンイレブン渋谷店");
    expect(total).toBe(0);
  });
});

// ── parseVendorFromText ────────────────────────────────

describe("parseVendorFromText", () => {
  it("先頭行を店名として返す", () => {
    const text = "セブンイレブン 渋谷店\n2025年4月15日\n合計 ¥432";
    expect(parseVendorFromText(text)).toBe("セブンイレブン 渋谷店");
  });

  it("株式会社を含む行を優先して返す", () => {
    const text = "2025年4月15日\n株式会社モノタロウ\n合計 ¥5,500";
    expect(parseVendorFromText(text)).toBe("株式会社モノタロウ");
  });

  it("店名: ラベル付き行を返す", () => {
    const text = "店名: ドトールコーヒー\n2025年4月15日\n合計 ¥550";
    expect(parseVendorFromText(text)).toBe("ドトールコーヒー");
  });

  it("テキストが空の場合は「不明」を返す", () => {
    expect(parseVendorFromText("")).toBe("不明");
  });
});

// ── parseReducedTaxItems ───────────────────────────────

describe("parseReducedTaxItems", () => {
  it("※ 付き行から品目名を抽出する", () => {
    const text = "飲料水 ※ 108\nサンドイッチ ※ 324\n合計 ¥432";
    const items = parseReducedTaxItems(text);
    expect(items.length).toBeGreaterThan(0);
  });

  it("軽減税率対象の注記がない場合は空配列", () => {
    const items = parseReducedTaxItems("合計 ¥3,300\n消費税 300");
    expect(items).toEqual([]);
  });
});

// ── parseReceiptText (統合) ────────────────────────────

describe("parseReceiptText", () => {
  it("典型的なコンビニレシートを正しく構造化する", () => {
    const text = [
      "セブンイレブン 渋谷店",
      "2025年4月15日",
      "飲料水 ※  108",
      "サンドイッチ ※  324",
      "合計 ¥432",
    ].join("\n");

    const result = parseReceiptText(text);
    expect(result.date).toBe("2025-04-15");
    expect(result.vendor).toBe("セブンイレブン 渋谷店");
    expect(result.total).toBe(432);
    expect(result.raw_text).toBe(text);
  });

  it("raw_text を常に保持する", () => {
    const text = "テスト\n合計 ¥100";
    const result = parseReceiptText(text);
    expect(result.raw_text).toBe(text);
  });

  it("軽減税率品目がない場合 reduced_tax_items は含まれない", () => {
    const result = parseReceiptText("合計 ¥3,300");
    expect(result.reduced_tax_items).toBeUndefined();
  });
});
