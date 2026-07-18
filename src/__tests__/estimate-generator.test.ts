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
        { code: "DM-001", quantity: 50 },  // 内装解体 50㎡ × 4000 = 200,000
        { code: "IN-005", quantity: 120 }, // クロス張り 120㎡ × 1200 = 144,000
        { code: "IN-008", quantity: 50 },  // タイルカーペット 50㎡ × 4500 = 225,000
        { code: "EL-005", quantity: 10 },  // ダウンライト 10台 × 12000 = 120,000
      ],
      managementFeeRate: 0.1,
      generalExpenseRate: 0.05,
    });

    expect(est.propertyName).toBe("南青山テストビル 3F");
    expect(est.clientName).toBe("テスト株式会社");

    // 直接工事費: 200000 + 144000 + 225000 + 120000 = 689,000
    expect(est.directCost).toBe(689000);
    // 管理費: 689000 × 0.1 = 68,900
    expect(est.managementFee).toBe(68900);
    // 一般管理費: (689000 + 68900) × 0.05 = 37,895
    expect(est.generalExpense).toBe(37895);
    // 税抜: 689000 + 68900 + 37895 = 795,795
    expect(est.subtotal).toBe(795795);
    // 税: 795795 × 0.1 = 79,579.5 → 既定の切捨てで79,579
    expect(est.tax).toBe(79579);
    // 税込: 795795 + 79579 = 875,374
    expect(est.total).toBe(875374);

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

  it("rounds amount to integer — prevents float noise from accumulating in subtotals", () => {
    // DM-001 unitPrice=4000, quantity=33.333 → raw=133332, rounded=133332
    const est = generateEstimate({
      propertyName: "端数テスト",
      clientName: "テスト",
      items: [{ code: "DM-001", quantity: 33.333 }],
    });
    const line = est.sections[0].lines[0];
    expect(Number.isInteger(line.amount)).toBe(true);
    expect(line.amount).toBe(133332);
    expect(Number.isInteger(est.directCost)).toBe(true);
    expect(Number.isInteger(est.subtotal)).toBe(true);
    expect(Number.isInteger(est.tax)).toBe(true);
    expect(Number.isInteger(est.total)).toBe(true);
  });

  it("total === subtotal + tax — consistency invariant", () => {
    const est = generateEstimate({
      propertyName: "整合性テスト",
      clientName: "テスト",
      items: [
        { code: "DM-001", quantity: 50 },
        { code: "IN-005", quantity: 120 },
        { code: "EL-005", quantity: 10 },
      ],
      managementFeeRate: 0.1,
      generalExpenseRate: 0.05,
    });
    expect(est.total).toBe(est.subtotal + est.tax);
    expect(est.subtotal).toBe(est.directCost + est.managementFee + est.generalExpense);
  });

  it.each([
    ["floor", 100] as const,
    ["round", 101] as const,
    ["ceil", 101] as const,
  ])("applies %s to fractional consumption tax", (taxRounding, expectedTax) => {
    const est = generateEstimate({
      propertyName: "端数方式検算",
      clientName: "テスト",
      items: [{ code: "DM-001", quantity: 0.229 }],
      managementFeeRate: 0.1,
      generalExpenseRate: 0,
      taxRounding,
    });
    expect(est.subtotal).toBe(1008);
    expect(est.tax).toBe(expectedTax);
    expect(est.taxRounding).toBe(taxRounding);
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

  it("throws when quantity is NaN — prevents NaN from corrupting subtotal", () => {
    expect(() =>
      generateEstimate({
        propertyName: "テスト",
        clientName: "テスト",
        items: [{ code: "DM-001", quantity: NaN }],
      }),
    ).toThrow("数量が不正です");
  });

  it("throws when quantity is Infinity — prevents Infinity amount", () => {
    expect(() =>
      generateEstimate({
        propertyName: "テスト",
        clientName: "テスト",
        items: [{ code: "DM-001", quantity: Infinity }],
      }),
    ).toThrow("数量が不正です");
  });

  it("throws when unitPriceOverride is NaN — prevents NaN from corrupting subtotal", () => {
    expect(() =>
      generateEstimate({
        propertyName: "テスト",
        clientName: "テスト",
        items: [{ code: "DM-001", quantity: 1, unitPriceOverride: NaN }],
      }),
    ).toThrow("単価が不正です");
  });

  it("has correct number of categories", () => {
    const cats = listCategories();
    expect(cats).toHaveLength(11);
    expect(cats.map((c) => c.id)).toEqual([
      "demolition",
      "interior",
      "electrical",
      "plumbing",
      "hvac",
      "fixtures",
      "shop_fitting",
      "renovation",
      "scaffolding",
      "plastering",
      "overhead",
    ]);
  });

  it("lists all items (247 total)", () => {
    const items = listAllItems();
    expect(items.length).toBe(247);
  });

  it("lists items by category", () => {
    const items = listItemsByCategory("demolition");
    expect(items).toHaveLength(15);
    expect(items[0].code).toBe("DM-001");
  });

  it("throws on unknown category", () => {
    expect(() => listItemsByCategory("unknown")).toThrow(
      "カテゴリ unknown が見つかりません",
    );
  });

  describe("input validation", () => {
    it("throws on negative quantity", () => {
      expect(() =>
        generateEstimate({
          propertyName: "テスト",
          clientName: "テスト",
          items: [{ code: "DM-001", quantity: -5 }],
        }),
      ).toThrow("数量が不正です");
    });

    it("throws on negative unitPriceOverride", () => {
      expect(() =>
        generateEstimate({
          propertyName: "テスト",
          clientName: "テスト",
          items: [{ code: "DM-001", quantity: 10, unitPriceOverride: -1000 }],
        }),
      ).toThrow("単価が不正です");
    });

    it("throws on management fee rate > 1", () => {
      expect(() =>
        generateEstimate({
          propertyName: "テスト",
          clientName: "テスト",
          items: [{ code: "DM-001", quantity: 10 }],
          managementFeeRate: 1.5,
        }),
      ).toThrow("現場管理費率が不正です");
    });

    it("throws on negative general expense rate", () => {
      expect(() =>
        generateEstimate({
          propertyName: "テスト",
          clientName: "テスト",
          items: [{ code: "DM-001", quantity: 10 }],
          generalExpenseRate: -0.1,
        }),
      ).toThrow("一般管理費率が不正です");
    });
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
