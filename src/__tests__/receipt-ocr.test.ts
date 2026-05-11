import { describe, it, expect } from "vitest";
import {
  parseDateFromText,
  parseAmountsFromText,
  parseVendorFromText,
  parseReducedTaxItems,
  parseReceiptText,
  parseItemsFromText,
  parsePaymentMethodFromText,
  type ReceiptOCRResult,
  type ReceiptItem,
} from "../lib/receipt-ocr.js";
import {
  inferAccountRule,
  mapReceiptToFreeeDeal,
  type FreeeDealPayload,
} from "../lib/freee-deal-mapper.js";

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
    expect(result.storeName).toBe("セブンイレブン 渋谷店");
    expect(result.total).toBe(432);
  });

  it("storeName フィールドを返す", () => {
    const text = "テスト店\n合計 ¥100";
    const result = parseReceiptText(text);
    expect(result.storeName).toBe("テスト店");
  });

  it("paymentMethod が含まれない場合は undefined", () => {
    const result = parseReceiptText("合計 ¥3,300");
    expect(result.paymentMethod).toBeUndefined();
  });

  it("items 配列を返す (空でも配列)", () => {
    const result = parseReceiptText("合計 ¥3,300");
    expect(Array.isArray(result.items)).toBe(true);
  });
});

// ── Sprint 67: parseItemsFromText ──────────────────────

describe("parseItemsFromText", () => {
  it("品目 金額 2フィールドを抽出する", () => {
    const text = "コーヒー 500\n紅茶 400\n合計 ¥900";
    const items = parseItemsFromText(text);
    expect(items.length).toBeGreaterThanOrEqual(1);
    const coffee = items.find((i) => i.name === "コーヒー");
    expect(coffee).toBeDefined();
    expect(coffee!.amount).toBe(500);
  });

  it("品目 数量 単価 小計 4フィールドを抽出する", () => {
    const text = "コーヒー 2 300 600\n合計 ¥600";
    const items = parseItemsFromText(text);
    expect(items.length).toBeGreaterThanOrEqual(1);
    const coffee = items[0];
    expect(coffee.quantity).toBe(2);
    expect(coffee.unitPrice).toBe(300);
    expect(coffee.amount).toBe(600);
  });

  it("合計行は品目として抽出しない", () => {
    const text = "コーヒー 500\n合計 ¥500";
    const items = parseItemsFromText(text);
    const totals = items.filter((i) => /合計/.test(i.name));
    expect(totals.length).toBe(0);
  });

  it("小計行は品目として抽出しない", () => {
    const text = "お茶 200\n小計 200\n消費税 20";
    const items = parseItemsFromText(text);
    const subtotals = items.filter((i) => /小計|消費税/.test(i.name));
    expect(subtotals.length).toBe(0);
  });

  it("¥付き金額も正しくパースする", () => {
    const text = "サンドイッチ ¥324\n合計 ¥324";
    const items = parseItemsFromText(text);
    const sandwich = items.find((i) => i.name === "サンドイッチ");
    expect(sandwich).toBeDefined();
    expect(sandwich!.amount).toBe(324);
  });

  it("品目が存在しない場合は空配列", () => {
    const text = "合計 ¥1,000\n消費税 100";
    const items = parseItemsFromText(text);
    expect(items).toEqual([]);
  });
});

// ── Sprint 67: parsePaymentMethodFromText ──────────────

describe("parsePaymentMethodFromText", () => {
  it("PayPay を検出する", () => {
    expect(parsePaymentMethodFromText("PayPay支払い ¥500")).toBe("PayPay");
  });

  it("現金 を検出する", () => {
    expect(parsePaymentMethodFromText("現金でお支払い")).toBe("現金");
  });

  it("クレジットカード を検出する", () => {
    expect(parsePaymentMethodFromText("VISA クレジットカード")).toBe("カード");
  });

  it("Suica を電子マネーとして検出する", () => {
    expect(parsePaymentMethodFromText("Suicaでお支払い")).toBe("電子マネー");
  });

  it("支払い方法なしは undefined", () => {
    expect(parsePaymentMethodFromText("ありがとうございました")).toBeUndefined();
  });
});

// ── Sprint 67: parseReceiptText 7パターン統合 ──────────

describe("parseReceiptText Sprint67 7パターン", () => {
  it("コンビニレシート: storeName / date / total / paymentMethod", () => {
    const text = [
      "ローソン 新宿店",
      "2025/4/20",
      "おにぎり 120",
      "お茶 150",
      "合計 ¥270",
      "PayPay",
    ].join("\n");
    const r = parseReceiptText(text);
    expect(r.storeName).toBe("ローソン 新宿店");
    expect(r.date).toBe("2025-04-20");
    expect(r.total).toBe(270);
    expect(r.paymentMethod).toBe("PayPay");
  });

  it("ガソリンスタンド: ENEOS → 車両費推定可能データ", () => {
    const text = [
      "ENEOS 世田谷SS",
      "令和7年4月15日",
      "レギュラー 50L 185円 9,250",
      "消費税 925",
      "合計 ¥10,175",
      "クレジットカード",
    ].join("\n");
    const r = parseReceiptText(text);
    expect(r.storeName).toContain("ENEOS");
    expect(r.total).toBe(10175);
    expect(r.paymentMethod).toBe("カード");
  });

  it("建材店: DCM → 仕入高推定可能データ", () => {
    const text = [
      "DCM 調布店",
      "2025年3月10日",
      "石膏ボード 12枚 480 5,760",
      "合計 ¥5,760",
      "現金",
    ].join("\n");
    const r = parseReceiptText(text);
    expect(r.storeName).toContain("DCM");
    expect(r.total).toBe(5760);
    expect(r.paymentMethod).toBe("現金");
  });

  it("食事レシート: 店名先頭行 + items", () => {
    const text = [
      "炭火焼肉 太郎",
      "R7.4.10",
      "和牛カルビ 2,200",
      "ビール 550",
      "合計 ¥2,750",
    ].join("\n");
    const r = parseReceiptText(text);
    expect(r.storeName).toBe("炭火焼肉 太郎");
    expect(r.total).toBe(2750);
    expect(r.items.length).toBeGreaterThanOrEqual(1);
  });

  it("タクシーレシート: 旅費交通費候補", () => {
    const text = [
      "タクシー東京株式会社",
      "2025年4月18日",
      "乗車料金 1,970",
      "合計 ¥1,970",
      "現金",
    ].join("\n");
    const r = parseReceiptText(text);
    expect(r.storeName).toContain("タクシー");
    expect(r.total).toBe(1970);
  });

  it("Amazon: 消耗品費候補 + needsReview", () => {
    const text = [
      "Amazon.co.jp",
      "2025-04-05",
      "事務用品 3,300",
      "合計 ¥3,300",
    ].join("\n");
    const r = parseReceiptText(text);
    expect(r.storeName).toContain("Amazon");
    expect(r.total).toBe(3300);
    const rule = inferAccountRule(r.storeName);
    expect(rule.needsReview).toBe(true);
  });

  it("不明店名: 雑費 + needsReview", () => {
    const text = [
      "謎の商店",
      "2025年5月1日",
      "何か 1,000",
      "合計 ¥1,000",
    ].join("\n");
    const r = parseReceiptText(text);
    const rule = inferAccountRule(r.storeName);
    expect(rule.accountItemName).toBe("雑費");
    expect(rule.needsReview).toBe(true);
  });
});

// ── Sprint 67: mapReceiptToFreeeDeal ──────────────────

describe("mapReceiptToFreeeDeal", () => {
  const baseOptions = { companyId: 1234567 };

  const makeReceipt = (overrides: Partial<ReceiptOCRResult>): ReceiptOCRResult => ({
    storeName: "テスト店",
    date: "2025-04-15",
    items: [],
    total: 1000,
    ...overrides,
  });

  it("FreeeDealPayload を返す", () => {
    const r = makeReceipt({});
    const payload = mapReceiptToFreeeDeal(r, baseOptions);
    expect(payload).toBeDefined();
    expect(payload.companyId).toBe(1234567);
    expect(payload.type).toBe("expense");
  });

  it("issueDate が receipt.date から設定される", () => {
    const r = makeReceipt({ date: "2025-03-20" });
    const payload = mapReceiptToFreeeDeal(r, baseOptions);
    expect(payload.issueDate).toBe("2025-03-20");
  });

  it("日付が空の場合は今日の日付", () => {
    const r = makeReceipt({ date: "" });
    const payload = mapReceiptToFreeeDeal(r, baseOptions);
    expect(payload.issueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("ガソリン店名 → 車両費", () => {
    const r = makeReceipt({ storeName: "ENEOS 世田谷SS" });
    const payload = mapReceiptToFreeeDeal(r, baseOptions);
    const debit = payload.details.find((d) => d.entrySide === "debit");
    expect(debit?.accountItemName).toBe("車両費");
  });

  it("タクシー → 旅費交通費", () => {
    const r = makeReceipt({ storeName: "タクシー東京" });
    const payload = mapReceiptToFreeeDeal(r, baseOptions);
    const debit = payload.details.find((d) => d.entrySide === "debit");
    expect(debit?.accountItemName).toBe("旅費交通費");
  });

  it("コンビニ → 雑費 + needsReview=true", () => {
    const r = makeReceipt({ storeName: "セブンイレブン 渋谷店" });
    const payload = mapReceiptToFreeeDeal(r, baseOptions);
    const debit = payload.details.find((d) => d.entrySide === "debit");
    expect(debit?.accountItemName).toBe("雑費");
    expect(payload.needsReview).toBe(true);
  });

  it("Amazon → 消耗品費 + needsReview=true", () => {
    const r = makeReceipt({ storeName: "Amazon.co.jp" });
    const payload = mapReceiptToFreeeDeal(r, baseOptions);
    const debit = payload.details.find((d) => d.entrySide === "debit");
    expect(debit?.accountItemName).toBe("消耗品費");
    expect(payload.needsReview).toBe(true);
  });

  it("DCM → 仕入高 + needsReview=false", () => {
    const r = makeReceipt({ storeName: "DCM 調布店" });
    const payload = mapReceiptToFreeeDeal(r, baseOptions);
    const debit = payload.details.find((d) => d.entrySide === "debit");
    expect(debit?.accountItemName).toBe("仕入高");
    expect(payload.needsReview).toBe(false);
  });

  it("不明店名 → 雑費 + needsReview=true", () => {
    const r = makeReceipt({ storeName: "謎の商店XYZ" });
    const payload = mapReceiptToFreeeDeal(r, baseOptions);
    const debit = payload.details.find((d) => d.entrySide === "debit");
    expect(debit?.accountItemName).toBe("雑費");
    expect(payload.needsReview).toBe(true);
  });

  it("details に借方と貸方の両方が含まれる", () => {
    const r = makeReceipt({});
    const payload = mapReceiptToFreeeDeal(r, baseOptions);
    const debit = payload.details.find((d) => d.entrySide === "debit");
    const credit = payload.details.find((d) => d.entrySide === "credit");
    expect(debit).toBeDefined();
    expect(credit).toBeDefined();
  });

  it("現金払い → 貸方が現金", () => {
    const r = makeReceipt({ paymentMethod: "現金" });
    const payload = mapReceiptToFreeeDeal(r, baseOptions);
    const credit = payload.details.find((d) => d.entrySide === "credit");
    expect(credit?.accountItemName).toBe("現金");
  });

  it("カード払い → 貸方が未払金", () => {
    const r = makeReceipt({ paymentMethod: "カード" });
    const payload = mapReceiptToFreeeDeal(r, baseOptions);
    const credit = payload.details.find((d) => d.entrySide === "credit");
    expect(credit?.accountItemName).toBe("未払金");
  });

  it("合計0の場合は needsReview=true", () => {
    const r = makeReceipt({ total: 0 });
    const payload = mapReceiptToFreeeDeal(r, baseOptions);
    expect(payload.needsReview).toBe(true);
  });

  it("autoClassifiedBy に店名と勘定科目が含まれる", () => {
    const r = makeReceipt({ storeName: "ENEOS 世田谷SS" });
    const payload = mapReceiptToFreeeDeal(r, baseOptions);
    expect(payload.autoClassifiedBy).toContain("ENEOS");
    expect(payload.autoClassifiedBy).toContain("車両費");
  });

  it("JR → 旅費交通費", () => {
    const r = makeReceipt({ storeName: "JR東日本" });
    const payload = mapReceiptToFreeeDeal(r, baseOptions);
    const debit = payload.details.find((d) => d.entrySide === "debit");
    expect(debit?.accountItemName).toBe("旅費交通費");
  });

  it("出光 → 車両費", () => {
    const r = makeReceipt({ storeName: "出光 世田谷店" });
    const payload = mapReceiptToFreeeDeal(r, baseOptions);
    const debit = payload.details.find((d) => d.entrySide === "debit");
    expect(debit?.accountItemName).toBe("車両費");
  });

  it("ファミマ → 雑費", () => {
    const r = makeReceipt({ storeName: "ファミリーマート 下北沢店" });
    const payload = mapReceiptToFreeeDeal(r, baseOptions);
    const debit = payload.details.find((d) => d.entrySide === "debit");
    expect(debit?.accountItemName).toBe("雑費");
  });
});
