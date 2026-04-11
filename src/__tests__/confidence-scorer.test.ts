import { describe, it, expect } from "vitest";
import { calculateConfidence, scoreToStars } from "../lib/confidence-scorer";
import type { ParsedEstimateItem } from "../estimate/nl-estimate-parser";

function makeItem(overrides: Partial<ParsedEstimateItem> = {}): ParsedEstimateItem {
  return {
    code: "IN-005",
    quantity: 30,
    matchedKeyword: "壁紙",
    itemName: "クロス張り(量産品)",
    quantityBasis: "壁面積 30㎡",
    ...overrides,
  };
}

describe("calculateConfidence", () => {
  it("面積明示+コードマッチ+キーワードマッチ → 最高スコア", () => {
    const item = makeItem();
    const score = calculateConfidence(item, { hasExplicitArea: true, detectedAreaSqm: 20, hasUnmatched: false });
    expect(score).toBe(5); // 3 + 2(面積) + 2(コード) + 1(KW) -2(コード) - ... let's check
    // base=3, +2(area), +2(code), +1(kw) = 8 → clamp(1,5,8) = 5
    expect(score).toBeGreaterThanOrEqual(4);
  });

  it("面積なし+デフォルト → スコア低下", () => {
    const item = makeItem({ quantityBasis: "床面積 10㎡" });
    const score = calculateConfidence(item, { hasExplicitArea: false, detectedAreaSqm: null, hasUnmatched: false });
    // base=3, +2(code), +1(kw), -2(no area) = 4
    expect(score).toBeLessThanOrEqual(4);
  });

  it("未マッチあり → スコアが低下する", () => {
    // 面積なし条件でテスト（clampで5に丸まらないようにする）
    const item = makeItem();
    const scoreWithout = calculateConfidence(item, { hasExplicitArea: false, detectedAreaSqm: null, hasUnmatched: false });
    const scoreWith = calculateConfidence(item, { hasExplicitArea: false, detectedAreaSqm: null, hasUnmatched: true });
    expect(scoreWith).toBeLessThan(scoreWithout);
  });

  it("デフォルト数量(1) → スコアが低下する", () => {
    // 面積なし条件でテスト（clampで5に丸まらないようにする）
    const item = makeItem({ quantity: 1, quantityBasis: "デフォルト数量: 1" });
    const scoreDefault = calculateConfidence(item, { hasExplicitArea: false, detectedAreaSqm: null, hasUnmatched: false });
    const itemNormal = makeItem({ quantity: 30 });
    const scoreNormal = calculateConfidence(itemNormal, { hasExplicitArea: false, detectedAreaSqm: null, hasUnmatched: false });
    expect(scoreDefault).toBeLessThan(scoreNormal);
  });

  it("スコアは常に1以上5以下", () => {
    const item = makeItem({ quantity: 1, quantityBasis: "デフォルト数量: 1", matchedKeyword: "" });
    const score = calculateConfidence(item, { hasExplicitArea: false, detectedAreaSqm: null, hasUnmatched: true });
    expect(score).toBeGreaterThanOrEqual(1);
    expect(score).toBeLessThanOrEqual(5);
  });
});

describe("calculateConfidence - keyword length scoring", () => {
  it("キーワード4文字以上 → コードマッチ+2", () => {
    const item = makeItem({ matchedKeyword: "壁紙張替" }); // 4文字
    const score = calculateConfidence(item, { hasExplicitArea: false, detectedAreaSqm: null, hasUnmatched: false });
    // base=3, +2(code, kw>=4), +1(kw match), -2(no area) = 4
    expect(score).toBe(4);
  });

  it("キーワード2文字以下 → コードマッチ+1", () => {
    const item = makeItem({ matchedKeyword: "床" }); // 1文字
    const score = calculateConfidence(item, { hasExplicitArea: false, detectedAreaSqm: null, hasUnmatched: false });
    // base=3, +1(code, kw<=2), +1(kw match), -2(no area) = 3
    expect(score).toBe(3);
  });

  it("キーワード3文字 → コードマッチ+1", () => {
    const item = makeItem({ matchedKeyword: "フロア" }); // 3文字
    const score = calculateConfidence(item, { hasExplicitArea: false, detectedAreaSqm: null, hasUnmatched: false });
    // base=3, +1(code, kw=3), +1(kw match), -2(no area) = 3
    expect(score).toBe(3);
  });
});

describe("scoreToStars", () => {
  it("score=5 → ★★★★★", () => {
    expect(scoreToStars(5)).toBe("★★★★★");
  });

  it("score=1 → ★☆☆☆☆", () => {
    expect(scoreToStars(1)).toBe("★☆☆☆☆");
  });

  it("score=3 → ★★★☆☆", () => {
    expect(scoreToStars(3)).toBe("★★★☆☆");
  });

  it("out of range は clamp される", () => {
    expect(scoreToStars(0)).toBe("★☆☆☆☆");
    expect(scoreToStars(10)).toBe("★★★★★");
  });
});
