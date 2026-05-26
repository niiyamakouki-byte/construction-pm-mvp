/**
 * tier-calculator.test.ts
 */

import { describe, it, expect } from "vitest";
import { calculateTier, getRewardRate } from "../tier-calculator.js";

describe("calculateTier — 成約数による境界値", () => {
  it("0件成約 → bronze", () => {
    expect(calculateTier(0, 0)).toBe("bronze");
  });

  it("1件成約 → silver", () => {
    expect(calculateTier(1, 0)).toBe("silver");
  });

  it("2件成約 → silver (gold未満)", () => {
    expect(calculateTier(2, 0)).toBe("silver");
  });

  it("3件成約 → gold", () => {
    expect(calculateTier(3, 0)).toBe("gold");
  });

  it("4件成約 → gold (platinum未満)", () => {
    expect(calculateTier(4, 0)).toBe("gold");
  });

  it("5件成約 → platinum", () => {
    expect(calculateTier(5, 0)).toBe("platinum");
  });

  it("10件成約 → platinum", () => {
    expect(calculateTier(10, 0)).toBe("platinum");
  });
});

describe("calculateTier — 総成約金額による境界値", () => {
  it("¥499万 → silver (gold未満)", () => {
    expect(calculateTier(1, 4_990_000)).toBe("silver");
  });

  it("¥500万 → gold (成約数がgold基準未満でも金額で昇格)", () => {
    expect(calculateTier(1, 5_000_000)).toBe("gold");
  });

  it("¥1,499万 → gold (platinum未満)", () => {
    expect(calculateTier(1, 14_990_000)).toBe("gold");
  });

  it("¥1,500万 → platinum (成約数がplatinum基準未満でも金額で昇格)", () => {
    expect(calculateTier(1, 15_000_000)).toBe("platinum");
  });

  it("成約0件でも¥500万超ならgold", () => {
    expect(calculateTier(0, 5_000_000)).toBe("gold");
  });

  it("成約0件でも¥1,500万超ならplatinum", () => {
    expect(calculateTier(0, 15_000_000)).toBe("platinum");
  });
});

describe("getRewardRate", () => {
  it("bronze は 1%", () => {
    expect(getRewardRate("bronze")).toBe(0.01);
  });

  it("silver は 2%", () => {
    expect(getRewardRate("silver")).toBe(0.02);
  });

  it("gold は 3%", () => {
    expect(getRewardRate("gold")).toBe(0.03);
  });

  it("platinum は 5%", () => {
    expect(getRewardRate("platinum")).toBe(0.05);
  });
});
