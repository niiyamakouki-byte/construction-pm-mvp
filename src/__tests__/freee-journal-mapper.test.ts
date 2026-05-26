import { describe, it, expect } from "vitest";
import { inferAccountItem, inferTaxCode, mapToJournal } from "../lib/freee-journal-mapper.js";
import type { ReceiptData } from "../lib/receipt-ocr.js";

// ── テストヘルパー ─────────────────────────────────────

function makeReceipt(overrides: Partial<ReceiptData> = {}): ReceiptData {
  return {
    date: "2025-04-15",
    vendor: "テスト店舗",
    total: 1000,
    raw_text: "テスト",
    ...overrides,
  };
}

// ── inferAccountItem ───────────────────────────────────

describe("inferAccountItem — vendor マッチ", () => {
  it("セブンイレブン + 1万未満 → 消耗品費", () => {
    expect(inferAccountItem("セブンイレブン 渋谷店", 500)).toBe("消耗品費");
  });

  it("セブンイレブン + 1万以上 → 会議費", () => {
    expect(inferAccountItem("セブンイレブン 渋谷店", 15000)).toBe("会議費");
  });

  it("ローソン + 少額 → 消耗品費", () => {
    expect(inferAccountItem("ローソン 新宿三丁目", 300)).toBe("消耗品費");
  });

  it("ファミリーマート → 消耗品費", () => {
    expect(inferAccountItem("ファミリーマート 代々木店", 800)).toBe("消耗品費");
  });

  it("JR → 旅費交通費", () => {
    expect(inferAccountItem("JR東日本", 500)).toBe("旅費交通費");
  });

  it("首都高 → 旅費交通費", () => {
    expect(inferAccountItem("首都高速道路", 1200)).toBe("旅費交通費");
  });

  it("スターバックス → 会議費", () => {
    expect(inferAccountItem("スターバックス 青山店", 800)).toBe("会議費");
  });

  it("ドトール → 会議費", () => {
    expect(inferAccountItem("ドトールコーヒー", 400)).toBe("会議費");
  });

  it("ENEOS → 車両費", () => {
    expect(inferAccountItem("ENEOS 世田谷SS", 8000)).toBe("車両費");
  });

  it("エネオス → 車両費", () => {
    expect(inferAccountItem("エネオス", 5000)).toBe("車両費");
  });

  it("アマゾン + 10万未満 → 消耗品費", () => {
    expect(inferAccountItem("Amazon.co.jp", 3000)).toBe("消耗品費");
  });

  it("アマゾン + 10万以上 → 工具器具備品", () => {
    expect(inferAccountItem("Amazon.co.jp", 150000)).toBe("工具器具備品");
  });

  it("サイゼリヤ + 5000円未満 → 会議費", () => {
    expect(inferAccountItem("サイゼリヤ", 3000)).toBe("会議費");
  });

  it("焼肉 + 5000円以上 → 接待交際費", () => {
    expect(inferAccountItem("焼肉屋さかい", 8000)).toBe("接待交際費");
  });

  it("マッチしない vendor → 未分類 (要確認)", () => {
    expect(inferAccountItem("謎の店舗", 1000)).toBe("未分類 (要確認)");
  });
});

// ── inferTaxCode ───────────────────────────────────────

describe("inferTaxCode", () => {
  it("軽減税率品目あり → 8", () => {
    const receipt = makeReceipt({ reduced_tax_items: ["飲料水"] });
    expect(inferTaxCode(receipt)).toBe(8);
  });

  it("軽減税率品目なし → 10", () => {
    const receipt = makeReceipt({ reduced_tax_items: [] });
    expect(inferTaxCode(receipt)).toBe(10);
  });

  it("reduced_tax_items フィールドなし → 10", () => {
    const receipt = makeReceipt();
    expect(inferTaxCode(receipt)).toBe(10);
  });
});

// ── mapToJournal ───────────────────────────────────────

describe("mapToJournal", () => {
  it("基本フィールドが FreeeJournalDraft にマップされる", () => {
    const receipt = makeReceipt({ vendor: "JR東日本", total: 500 });
    const draft = mapToJournal(receipt);
    expect(draft.issue_date).toBe("2025-04-15");
    expect(draft.amount).toBe(500);
    expect(draft.partner_name).toBe("JR東日本");
    expect(draft.account_item).toBe("旅費交通費");
  });

  it("account_hint が指定された場合は推定より優先される", () => {
    const receipt = makeReceipt({ vendor: "JR東日本", total: 500 });
    const draft = mapToJournal(receipt, "福利厚生費");
    expect(draft.account_item).toBe("福利厚生費");
  });

  it("未分類の場合 needs_review が true", () => {
    const receipt = makeReceipt({ vendor: "謎の店" });
    const draft = mapToJournal(receipt);
    expect(draft.needs_review).toBe(true);
  });

  it("日付空の場合 needs_review が true", () => {
    const receipt = makeReceipt({ date: "", vendor: "JR東日本" });
    const draft = mapToJournal(receipt);
    expect(draft.needs_review).toBe(true);
  });

  it("total が 0 の場合 needs_review が true", () => {
    const receipt = makeReceipt({ total: 0, vendor: "JR東日本" });
    const draft = mapToJournal(receipt);
    expect(draft.needs_review).toBe(true);
  });

  it("正常なケースでは needs_review が false", () => {
    const receipt = makeReceipt({ vendor: "JR東日本", total: 500 });
    const draft = mapToJournal(receipt);
    expect(draft.needs_review).toBe(false);
  });

  it("tax_code は inferTaxCode の結果に従う", () => {
    const receipt = makeReceipt({ reduced_tax_items: ["飲料水"] });
    const draft = mapToJournal(receipt);
    expect(draft.tax_code).toBe(8);
  });
});
