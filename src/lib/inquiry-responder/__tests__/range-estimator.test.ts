/**
 * Tests for range-estimator.
 */

import { describe, expect, it } from "vitest";
import { estimateRange } from "../range-estimator.js";
import type { WorkCategory, WorkScale } from "../types.js";

// ── All WorkCategory values ────────────────────────────────────────────────

const ALL_CATEGORIES: WorkCategory[] = [
  "kitchen",
  "bath",
  "store_fit",
  "office_fit",
  "full_renovation",
  "partial_renovation",
  "exterior",
  "repair",
  "other",
];

const ALL_SCALES: WorkScale[] = ["small", "medium", "large", "extra_large"];

describe("range-estimator — 4×9 matrix (budgetHint なし)", () => {
  for (const category of ALL_CATEGORIES) {
    for (const scale of ALL_SCALES) {
      it(`${category} × ${scale} → lowerJpy < upperJpy`, () => {
        const r = estimateRange(category, scale, null);
        expect(r.lowerJpy).toBeLessThan(r.upperJpy);
        expect(r.lowerJpy).toBeGreaterThan(0);
        // "other" → confidence=low, others → medium
        const expectedConfidence = category === "other" ? "low" : "medium";
        expect(r.confidence).toBe(expectedConfidence);
      });
    }
  }

  it("other カテゴリは confidence=low", () => {
    const r = estimateRange("other", "medium", null);
    expect(r.confidence).toBe("low");
  });
});

describe("range-estimator — kitchen × small (具体値)", () => {
  it("lowerJpy=500000, upperJpy=1500000", () => {
    const r = estimateRange("kitchen", "small", null);
    expect(r.lowerJpy).toBe(500_000);
    expect(r.upperJpy).toBe(1_500_000);
  });
});

describe("range-estimator — full_renovation × large (具体値)", () => {
  it("lowerJpy=8000000, upperJpy=20000000", () => {
    const r = estimateRange("full_renovation", "large", null);
    expect(r.lowerJpy).toBe(8_000_000);
    expect(r.upperJpy).toBe(20_000_000);
  });
});

describe("range-estimator — budgetHint 調整", () => {
  it("budgetHint がレンジ内 → confidence=high", () => {
    const r = estimateRange("kitchen", "medium", 2_000_000);
    expect(r.confidence).toBe("high");
    expect(r.lowerJpy).toBeGreaterThan(0);
    expect(r.upperJpy).toBeGreaterThan(r.lowerJpy);
  });

  it("budgetHint がレンジ下限未満 → lowerJpy は hint×0.8 付近", () => {
    // kitchen small: 500k-1500k, hint=200k
    const r = estimateRange("kitchen", "small", 200_000);
    expect(r.lowerJpy).toBe(160_000); // 200k * 0.8
    expect(r.upperJpy).toBe(500_000); // lower bound
  });

  it("budgetHint がレンジ上限超過 → upperJpy は hint×1.2 付近", () => {
    // kitchen small: 500k-1500k, hint=2000k
    const r = estimateRange("kitchen", "small", 2_000_000);
    expect(r.lowerJpy).toBe(1_500_000); // upper bound
    expect(r.upperJpy).toBe(2_400_000); // 2000k * 1.2
  });

  it("budgetHint あり → basisNotes_ja に「ご予算ヒント」が含まれる", () => {
    const r = estimateRange("kitchen", "medium", 2_000_000);
    expect(r.basisNotes_ja).toContain("ご予算ヒント");
  });

  it("budgetHint なし → basisNotes_ja に「標準工事費」が含まれる", () => {
    const r = estimateRange("kitchen", "medium", null);
    expect(r.basisNotes_ja).toContain("標準工事費");
  });
});

describe("range-estimator — 境界値", () => {
  it("repair × small が最小レンジ (100k-500k)", () => {
    const r = estimateRange("repair", "small", null);
    expect(r.lowerJpy).toBe(100_000);
    expect(r.upperJpy).toBe(500_000);
  });

  it("store_fit × extra_large が大規模レンジ", () => {
    const r = estimateRange("store_fit", "extra_large", null);
    expect(r.lowerJpy).toBeGreaterThanOrEqual(15_000_000);
  });

  it("full_renovation × extra_large が最大レンジ", () => {
    const r = estimateRange("full_renovation", "extra_large", null);
    expect(r.upperJpy).toBeGreaterThanOrEqual(20_000_000);
  });
});
