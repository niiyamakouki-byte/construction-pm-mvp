/**
 * price-builder unit tests.
 */

import { describe, it, expect } from "vitest";
import { buildPriceRange, formatManYen, PRICE_RANGE_MATRIX } from "../price-builder.js";

describe("PRICE_RANGE_MATRIX", () => {
  it("全 workCategory が存在する", () => {
    const categories = [
      "kitchen", "bath", "store_fit", "office_fit",
      "full_renovation", "partial_renovation", "exterior", "repair", "other",
    ];
    for (const cat of categories) {
      expect(PRICE_RANGE_MATRIX[cat as keyof typeof PRICE_RANGE_MATRIX]).toBeDefined();
    }
  });

  it("全 workScale が存在する", () => {
    const scales = ["small", "medium", "large", "extra_large"];
    for (const cat of Object.keys(PRICE_RANGE_MATRIX)) {
      for (const sc of scales) {
        expect(
          PRICE_RANGE_MATRIX[cat as keyof typeof PRICE_RANGE_MATRIX][sc as "small" | "medium" | "large" | "extra_large"],
        ).toBeDefined();
      }
    }
  });
});

describe("buildPriceRange", () => {
  it("lower <= upper を保証する", () => {
    const result = buildPriceRange({ workCategory: "kitchen", workScale: "medium" });
    expect(result.lower).toBeLessThanOrEqual(result.upper);
  });

  it("budgetHintJpy なしで標準レンジを返す", () => {
    const result = buildPriceRange({ workCategory: "full_renovation", workScale: "large" });
    expect(result.lower).toBe(8_000_000);
    expect(result.upper).toBe(20_000_000);
  });

  it("budgetHintJpy あれば補正される", () => {
    const resultWithHint = buildPriceRange({
      workCategory: "kitchen",
      workScale: "medium",
      budgetHintJpy: 2_000_000,
    });
    const resultWithout = buildPriceRange({ workCategory: "kitchen", workScale: "medium" });
    // With hint centering around 2M, the range should differ from the base
    expect(resultWithHint.lower).not.toEqual(resultWithout.lower);
  });

  it("basisJa に工事種別が含まれる", () => {
    const result = buildPriceRange({ workCategory: "kitchen", workScale: "medium" });
    expect(result.basisJa).toContain("キッチン工事");
  });

  it("basisJa に予算ヒントが含まれる場合", () => {
    const result = buildPriceRange({
      workCategory: "kitchen",
      workScale: "medium",
      budgetHintJpy: 2_000_000,
    });
    expect(result.basisJa).toContain("200万円");
  });
});

describe("formatManYen", () => {
  it("10000 → 1万円", () => {
    expect(formatManYen(10_000)).toBe("1万円");
  });

  it("5000000 → 500万円", () => {
    expect(formatManYen(5_000_000)).toBe("500万円");
  });
});
