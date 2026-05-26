/**
 * Sprint 67 — receipt-ocr-parser + receipt-classifier ユニットテスト
 *
 * テストパターン:
 *   1. コンビニレシート（軽減税率あり）
 *   2. 建材店レシート（材料費カテゴリ）
 *   3. 交通費レシート（旅費交通費）
 *   4. 最小レシート（日付・金額のみ）
 *   5. 令和表記レシート
 *   6. 分類精度テスト
 *   7. freee deal round-trip テスト
 */

import { describe, it, expect } from "vitest";
import { parseReceiptText } from "../receipt-ocr-parser.js";
import { classifyReceipt, receiptToFreeeDeal } from "../receipt-classifier.js";

// ── サンプルレシートテキスト ──────────────────────────

const CONVENIENCE_RECEIPT = `
セブンイレブン 渋谷店
2025年4月15日 10:30
飲料水           ※  108
サンドイッチ     ※  324
合計              ¥432
内消費税8%           32
`.trim();

const MATERIAL_RECEIPT = `
株式会社モノタロウ
2025/5/10
ボルト M8 50本         880
電動ドリル用ビット     1,200
小計              2,080
消費税              208
合計              2,288
`.trim();

const TRANSPORT_RECEIPT = `
東京メトロ 渋谷駅
令和7年4月20日
乗車券               210
合計              ¥210
`.trim();

const MINIMAL_RECEIPT = `
2025-03-01
合計 ¥1,650
`.trim();

const REIWA_RECEIPT = `
ローソン 世田谷店
R7.3.15
お茶 ※ 150
合計 ¥150
`.trim();

const SUBCONTRACT_RECEIPT = `
下請け工事 田中工務店
2025年5月1日
外注作業費 50,000
合計 ¥50,000
`.trim();

// ── parseReceiptText ───────────────────────────────────

describe("parseReceiptText", () => {
  describe("コンビニレシート", () => {
    const result = parseReceiptText(CONVENIENCE_RECEIPT);

    it("vendor を正しく抽出する", () => {
      expect(result.vendor).toBe("セブンイレブン 渋谷店");
    });

    it("date を ISO 8601 で返す", () => {
      expect(result.date).toBe("2025-04-15");
    });

    it("totalAmount を正しく抽出する", () => {
      expect(result.totalAmount).toBe(432);
    });

    it("rawText を保持する", () => {
      expect(result.rawText).toBe(CONVENIENCE_RECEIPT);
    });

    it("confidence が 0.0–1.0 の範囲内", () => {
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("vendor/date/total 全部揃っていれば confidence > 0.7", () => {
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe("建材店レシート（小計+消費税あり）", () => {
    const result = parseReceiptText(MATERIAL_RECEIPT);

    it("株式会社を含む行を vendor として返す", () => {
      expect(result.vendor).toBe("株式会社モノタロウ");
    });

    it("スラッシュ区切り日付を ISO 8601 に変換する", () => {
      expect(result.date).toBe("2025-05-10");
    });

    it("totalAmount = 2288", () => {
      expect(result.totalAmount).toBe(2288);
    });
  });

  describe("交通費レシート（令和漢字）", () => {
    const result = parseReceiptText(TRANSPORT_RECEIPT);

    it("令和7年 を 2025年 に変換する", () => {
      expect(result.date).toBe("2025-04-20");
    });

    it("totalAmount = 210", () => {
      expect(result.totalAmount).toBe(210);
    });
  });

  describe("最小レシート（日付+合計のみ）", () => {
    const result = parseReceiptText(MINIMAL_RECEIPT);

    it("date = 2025-03-01", () => {
      expect(result.date).toBe("2025-03-01");
    });

    it("totalAmount = 1650", () => {
      expect(result.totalAmount).toBe(1650);
    });

    it("confidence は 0.0–1.0 の範囲内", () => {
      // 日付と合計が揃っているので confidence >= 0.65
      expect(result.confidence).toBeGreaterThanOrEqual(0.65);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });
  });

  describe("令和短縮形 R7.3.15", () => {
    const result = parseReceiptText(REIWA_RECEIPT);

    it("R7.3.15 を 2025-03-15 に変換する", () => {
      expect(result.date).toBe("2025-03-15");
    });

    it("totalAmount = 150", () => {
      expect(result.totalAmount).toBe(150);
    });
  });

  describe("品目リスト", () => {
    it("items は配列", () => {
      const result = parseReceiptText(CONVENIENCE_RECEIPT);
      expect(Array.isArray(result.items)).toBe(true);
    });

    it("items の各要素は name/qty/unitPrice を持つ", () => {
      const result = parseReceiptText(MATERIAL_RECEIPT);
      for (const item of result.items) {
        expect(typeof item.name).toBe("string");
        expect(typeof item.qty).toBe("number");
        expect(typeof item.unitPrice).toBe("number");
      }
    });
  });
});

// ── classifyReceipt ────────────────────────────────────

describe("classifyReceipt", () => {
  it("コンビニレシートは general カテゴリ（または材料・汎用）", () => {
    const parsed = parseReceiptText(CONVENIENCE_RECEIPT);
    const cat = classifyReceipt(parsed);
    expect(["general", "material", "subcontract", "labor"]).toContain(cat.category);
  });

  it("外注費キーワードを含む場合 subcontract になる", () => {
    const parsed = parseReceiptText(SUBCONTRACT_RECEIPT);
    const cat = classifyReceipt(parsed);
    expect(cat.category).toBe("subcontract");
  });

  it("材料費キーワードを含む場合 material になる", () => {
    const text = "株式会社モノタロウ\n2025/5/10\n材料費 5,000\n合計 5,000";
    const parsed = parseReceiptText(text);
    const cat = classifyReceipt(parsed);
    expect(cat.category).toBe("material");
  });

  it("confidence は 0.0–1.0 の範囲", () => {
    const parsed = parseReceiptText(CONVENIENCE_RECEIPT);
    const cat = classifyReceipt(parsed);
    expect(cat.confidence).toBeGreaterThanOrEqual(0);
    expect(cat.confidence).toBeLessThanOrEqual(1);
  });

  it("accountItemId は正の整数", () => {
    const parsed = parseReceiptText(MATERIAL_RECEIPT);
    const cat = classifyReceipt(parsed);
    expect(cat.accountItemId).toBeGreaterThan(0);
  });

  it("taxCode は 0 または正の整数", () => {
    const parsed = parseReceiptText(CONVENIENCE_RECEIPT);
    const cat = classifyReceipt(parsed);
    expect(cat.taxCode).toBeGreaterThanOrEqual(0);
  });
});

// ── receiptToFreeeDeal (round-trip) ───────────────────

describe("receiptToFreeeDeal", () => {
  it("type は 'expense'", () => {
    const parsed = parseReceiptText(CONVENIENCE_RECEIPT);
    const cat = classifyReceipt(parsed);
    const deal = receiptToFreeeDeal(parsed, cat);
    expect(deal.type).toBe("expense");
  });

  it("amount = totalAmount", () => {
    const parsed = parseReceiptText(CONVENIENCE_RECEIPT);
    const cat = classifyReceipt(parsed);
    const deal = receiptToFreeeDeal(parsed, cat);
    expect(deal.amount).toBe(parsed.totalAmount);
  });

  it("issue_date = parsed.date", () => {
    const parsed = parseReceiptText(CONVENIENCE_RECEIPT);
    const cat = classifyReceipt(parsed);
    const deal = receiptToFreeeDeal(parsed, cat);
    expect(deal.issue_date).toBe(parsed.date);
  });

  it("details は少なくとも1件", () => {
    const parsed = parseReceiptText(MATERIAL_RECEIPT);
    const cat = classifyReceipt(parsed);
    const deal = receiptToFreeeDeal(parsed, cat);
    expect(deal.details.length).toBeGreaterThanOrEqual(1);
  });

  it("details[0].account_item_id = category.accountItemId", () => {
    const parsed = parseReceiptText(MATERIAL_RECEIPT);
    const cat = classifyReceipt(parsed);
    const deal = receiptToFreeeDeal(parsed, cat);
    expect(deal.details[0].account_item_id).toBe(cat.accountItemId);
  });

  it("projectId を ref_number にセットする", () => {
    const parsed = parseReceiptText(CONVENIENCE_RECEIPT);
    const cat = classifyReceipt(parsed);
    const deal = receiptToFreeeDeal(parsed, cat, "proj-001");
    expect(deal.ref_number).toBe("proj-001");
  });

  it("projectId 省略時 ref_number は undefined", () => {
    const parsed = parseReceiptText(CONVENIENCE_RECEIPT);
    const cat = classifyReceipt(parsed);
    const deal = receiptToFreeeDeal(parsed, cat);
    expect(deal.ref_number).toBeUndefined();
  });

  it("date 不明時は今日の日付で補完される", () => {
    const parsed = parseReceiptText("不明店\n合計 ¥500");
    const cat = classifyReceipt(parsed);
    const deal = receiptToFreeeDeal(parsed, cat);
    expect(deal.issue_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("建材店レシートの round-trip", () => {
    const parsed = parseReceiptText(MATERIAL_RECEIPT);
    const cat = classifyReceipt(parsed);
    const deal = receiptToFreeeDeal(parsed, cat, "proj-mat");
    expect(deal.type).toBe("expense");
    expect(deal.amount).toBe(2288);
    expect(deal.ref_number).toBe("proj-mat");
  });
});
