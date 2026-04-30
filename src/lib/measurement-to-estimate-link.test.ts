import { describe, it, expect } from "vitest";
import {
  suggestEstimateItems,
  topSuggestion,
  type CostMasterEntry,
} from "./measurement-to-estimate-link.js";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ITEMS: CostMasterEntry[] = [
  { code: "IN-005", name: "クロス張り（量産品）",       unit: "㎡", unitPrice: 1200, categoryId: "interior", categoryName: "内装" },
  { code: "IN-008", name: "タイルカーペット",           unit: "㎡", unitPrice: 4500, categoryId: "interior", categoryName: "内装" },
  { code: "IN-009", name: "フローリング（複合）",       unit: "㎡", unitPrice: 8000, categoryId: "interior", categoryName: "内装" },
  { code: "IN-012", name: "巾木（ビニル）",             unit: "m",  unitPrice: 800,  categoryId: "interior", categoryName: "内装" },
  { code: "IN-013", name: "巾木（木製）",               unit: "m",  unitPrice: 1200, categoryId: "interior", categoryName: "内装" },
  { code: "DM-001", name: "内装解体（木造）",           unit: "㎡", unitPrice: 3500, categoryId: "demolition", categoryName: "解体" },
];

// ── suggestEstimateItems ──────────────────────────────────────────────────────

describe("suggestEstimateItems", () => {
  it("returns only area-unit items for area measurement", () => {
    const results = suggestEstimateItems("area", 10, ITEMS);
    expect(results.every((r) => r.unit === "㎡")).toBe(true);
  });

  it("returns only length-unit items for distance measurement", () => {
    const results = suggestEstimateItems("distance", 5, ITEMS);
    expect(results.every((r) => r.unit === "m")).toBe(true);
  });

  it("quantity matches the measurement value", () => {
    const results = suggestEstimateItems("area", 20, ITEMS);
    expect(results.every((r) => r.quantity === 20)).toBe(true);
  });

  it("amount equals quantity × unitPrice (rounded)", () => {
    const results = suggestEstimateItems("area", 10, ITEMS);
    results.forEach((r) => {
      expect(r.amount).toBe(Math.round(r.quantity * r.unitPrice));
    });
  });

  it("returns empty array when no items match the unit", () => {
    const distOnly: CostMasterEntry[] = [
      { code: "IN-012", name: "巾木", unit: "m", unitPrice: 800 },
    ];
    const results = suggestEstimateItems("area", 10, distOnly);
    expect(results).toHaveLength(0);
  });

  it("hint keyword boosts matching item to rank 1", () => {
    const results = suggestEstimateItems("area", 10, ITEMS, "フローリング");
    expect(results[0]!.code).toBe("IN-009");
  });

  it("hint keyword クロス boosts IN-005", () => {
    const results = suggestEstimateItems("area", 10, ITEMS, "クロス");
    expect(results[0]!.code).toBe("IN-005");
  });

  it("respects maxResults cap", () => {
    const results = suggestEstimateItems("area", 10, ITEMS, "", 2);
    expect(results).toHaveLength(2);
  });

  it("assigns sequential rank starting at 1", () => {
    const results = suggestEstimateItems("area", 10, ITEMS, "", 3);
    expect(results.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("returns empty array for empty items list", () => {
    expect(suggestEstimateItems("area", 10, [])).toHaveLength(0);
  });
});

// ── topSuggestion ─────────────────────────────────────────────────────────────

describe("topSuggestion", () => {
  it("returns the highest-ranked suggestion", () => {
    const top = topSuggestion("area", 15, ITEMS, "クロス");
    expect(top).not.toBeNull();
    expect(top!.code).toBe("IN-005");
  });

  it("returns null when no items match the unit", () => {
    const distOnly: CostMasterEntry[] = [
      { code: "IN-012", name: "巾木", unit: "m", unitPrice: 800 },
    ];
    expect(topSuggestion("area", 10, distOnly)).toBeNull();
  });

  it("quantity on top suggestion equals the measurement value", () => {
    const top = topSuggestion("area", 30, ITEMS);
    expect(top!.quantity).toBe(30);
  });

  it("returns null for empty items list", () => {
    expect(topSuggestion("area", 10, [])).toBeNull();
  });

  it("works for distance measurement", () => {
    const top = topSuggestion("distance", 8, ITEMS, "巾木");
    expect(top).not.toBeNull();
    expect(top!.unit).toBe("m");
  });
});
