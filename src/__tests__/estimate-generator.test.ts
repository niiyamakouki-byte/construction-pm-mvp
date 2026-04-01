import { describe, it, expect } from "vitest";
import {
  generateEstimate,
  listAllItems,
  listCategories,
  listItemsByCategory,
  formatEstimateText,
  formatEstimateCSV,
} from "../estimate";

describe("estimate-generator", () => {
  it("generates an estimate with correct totals", () => {
    const est = generateEstimate({
      propertyName: "南青山テストビル 3F",
      clientName: "テスト株式会社",
      items: [
        { code: "DM-001", quantity: 50 },  // 内装解体 50㎡ × 3500 = 175,000
        { code: "IN-005", quantity: 120 }, // クロス張り 120㎡ × 1200 = 144,000
        { code: "IN-008", quantity: 50 },  // タイルカーペット 50㎡ × 4500 = 225,000
        { code: "EL-005", quantity: 10 },  // ダウンライト 10台 × 12000 = 120,000
      ],
      managementFeeRate: 0.1,
      generalExpenseRate: 0.05,
    });

    expect(est.propertyName).toBe("南青山テストビル 3F");
    expect(est.clientName).toBe("テスト株式会社");

    // 直接工事費: 175000 + 144000 + 225000 + 120000 = 664,000
    expect(est.directCost).toBe(664000);
    // 管理費: 664000 × 0.1 = 66,400
    expect(est.managementFee).toBe(66400);
    // 一般管理費: (664000 + 66400) × 0.05 = 36,520
    expect(est.generalExpense).toBe(36520);
    // 税抜: 664000 + 66400 + 36520 = 766,920
    expect(est.subtotal).toBe(766920);
    // 税: 766920 × 0.1 = 76,692
    expect(est.tax).toBe(76692);
    // 税込: 766920 + 76692 = 843,612
    expect(est.total).toBe(843612);

    expect(est.sections).toHaveLength(3); // demolition, interior, electrical
  });

  it("supports unit price override", () => {
    const est = generateEstimate({
      propertyName: "テスト物件",
      clientName: "テスト",
      items: [{ code: "DM-001", quantity: 10, unitPriceOverride: 5000 }],
    });

    const line = est.sections[0].lines[0];
    expect(line.unitPrice).toBe(5000);
    expect(line.amount).toBe(50000);
  });

  it("throws on unknown item code", () => {
    expect(() =>
      generateEstimate({
        propertyName: "テスト",
        clientName: "テスト",
        items: [{ code: "XX-999", quantity: 1 }],
      }),
    ).toThrow("品目コード XX-999 が見つかりません");
  });

  it("has correct number of categories", () => {
    const cats = listCategories();
    expect(cats).toHaveLength(9);
    expect(cats.map((c) => c.id)).toEqual([
      "demolition",
      "interior",
      "electrical",
      "plumbing",
      "hvac",
      "fixtures",
      "shop_fitting",
      "renovation",
      "overhead",
    ]);
  });

  it("lists all items (120 total)", () => {
    const items = listAllItems();
    expect(items.length).toBe(120);
  });

  it("lists items by category", () => {
    const items = listItemsByCategory("demolition");
    expect(items).toHaveLength(10);
    expect(items[0].code).toBe("DM-001");
  });

  it("throws on unknown category", () => {
    expect(() => listItemsByCategory("unknown")).toThrow(
      "カテゴリ unknown が見つかりません",
    );
  });
});

describe("format-estimate", () => {
  const est = generateEstimate({
    propertyName: "南青山テストビル 3F",
    clientName: "テスト株式会社",
    items: [
      { code: "DM-001", quantity: 50 },
      { code: "IN-005", quantity: 120 },
      { code: "EL-005", quantity: 10 },
    ],
    notes: ["工期は着工後約2週間を予定", "価格は材工共（材料費+施工費）"],
  });

  it("formats text estimate", () => {
    const text = formatEstimateText(est);
    expect(text).toContain("御 見 積 書");
    expect(text).toContain("南青山テストビル 3F");
    expect(text).toContain("テスト株式会社 御中");
    expect(text).toContain("株式会社ラポルタ");
    expect(text).toContain("解体・撤去");
    expect(text).toContain("内装・仕上げ");
    expect(text).toContain("工期は着工後約2週間を予定");
  });

  it("formats CSV estimate", () => {
    const csv = formatEstimateCSV(est);
    expect(csv).toContain("カテゴリ,コード,品名");
    expect(csv).toContain("解体・撤去,DM-001");
    expect(csv).toContain("税込合計");
  });
});
