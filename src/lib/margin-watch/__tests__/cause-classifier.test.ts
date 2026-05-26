/**
 * Tests for cause-classifier.
 */

import { describe, expect, it } from "vitest";
import { classifyCause } from "../cause-classifier.js";
import type { ProjectFinanceSnapshot } from "../types.js";

function makeSnap(overrides: Partial<ProjectFinanceSnapshot> = {}): ProjectFinanceSnapshot {
  return {
    projectId: "p1",
    projectName: "テスト",
    contractAmountYen: 10_000_000,
    totalCostYen: 6_000_000,
    estimatedRemainingCostYen: 1_000_000,
    marginRatioPct: 40,
    forecastMarginRatioPct: 30,
    ...overrides,
  };
}

// ── prev=undefined ─────────────────────────────────────────────────────────

describe("classifyCause - prev undefined", () => {
  it("prev=undefined → []", () => {
    const causes = classifyCause(undefined, makeSnap());
    expect(causes).toHaveLength(0);
  });
});

// ── 受注額減 ───────────────────────────────────────────────────────────────

describe("classifyCause - 受注額減", () => {
  it("prev.contract > current.contract → '受注額減' を含む", () => {
    const prev = makeSnap({ contractAmountYen: 12_000_000 });
    const current = makeSnap({ contractAmountYen: 10_000_000 });
    const causes = classifyCause(prev, current);
    expect(causes).toContain("受注額減");
  });

  it("prev.contract === current.contract → '受注額減' を含まない", () => {
    const prev = makeSnap({ contractAmountYen: 10_000_000 });
    const current = makeSnap({ contractAmountYen: 10_000_000 });
    const causes = classifyCause(prev, current);
    expect(causes).not.toContain("受注額減");
  });

  it("prev.contract < current.contract → '受注額減' を含まない", () => {
    const prev = makeSnap({ contractAmountYen: 8_000_000 });
    const current = makeSnap({ contractAmountYen: 10_000_000 });
    const causes = classifyCause(prev, current);
    expect(causes).not.toContain("受注額減");
  });
});

// ── 原価増 ─────────────────────────────────────────────────────────────────

describe("classifyCause - 原価増", () => {
  it("current.totalCost > prev.totalCost * 1.1 → '原価増' を含む", () => {
    const prev = makeSnap({ totalCostYen: 5_000_000 });
    const current = makeSnap({ totalCostYen: 5_600_000 }); // 112%
    const causes = classifyCause(prev, current);
    expect(causes).toContain("原価増");
  });

  it("current.totalCost === prev.totalCost * 1.1 → '原価増' を含まない (境界)", () => {
    const prev = makeSnap({ totalCostYen: 5_000_000 });
    const current = makeSnap({ totalCostYen: 5_500_000 }); // exactly 110%
    const causes = classifyCause(prev, current);
    expect(causes).not.toContain("原価増");
  });

  it("current.totalCost < prev.totalCost * 1.1 → '原価増' を含まない", () => {
    const prev = makeSnap({ totalCostYen: 5_000_000 });
    const current = makeSnap({ totalCostYen: 5_000_000 });
    const causes = classifyCause(prev, current);
    expect(causes).not.toContain("原価増");
  });
});

// ── 予測超過 ───────────────────────────────────────────────────────────────

describe("classifyCause - 予測超過", () => {
  it("estimatedRemaining > (contract - totalCost) → '予測超過' を含む", () => {
    const snap = makeSnap({
      contractAmountYen: 10_000_000,
      totalCostYen: 8_000_000,
      estimatedRemainingCostYen: 3_000_000, // remaining budget = 2M, but 3M predicted
    });
    const causes = classifyCause(makeSnap(), snap);
    expect(causes).toContain("予測超過");
  });

  it("estimatedRemaining <= (contract - totalCost) → '予測超過' を含まない", () => {
    const snap = makeSnap({
      contractAmountYen: 10_000_000,
      totalCostYen: 6_000_000,
      estimatedRemainingCostYen: 1_000_000, // remaining budget = 4M, 1M predicted
    });
    const causes = classifyCause(makeSnap(), snap);
    expect(causes).not.toContain("予測超過");
  });
});

// ── 単価変動 ───────────────────────────────────────────────────────────────

describe("classifyCause - 単価変動", () => {
  it("forecast差分 > 5% → '単価変動' を含む", () => {
    const prev = makeSnap({ forecastMarginRatioPct: 30 });
    const current = makeSnap({ forecastMarginRatioPct: 24 }); // delta = 6
    const causes = classifyCause(prev, current);
    expect(causes).toContain("単価変動");
  });

  it("forecast差分 = 5 → '単価変動' を含まない (境界)", () => {
    const prev = makeSnap({ forecastMarginRatioPct: 30 });
    const current = makeSnap({ forecastMarginRatioPct: 25 }); // delta = 5, not > 5
    const causes = classifyCause(prev, current);
    expect(causes).not.toContain("単価変動");
  });

  it("forecast差分 < 5% → '単価変動' を含まない", () => {
    const prev = makeSnap({ forecastMarginRatioPct: 30 });
    const current = makeSnap({ forecastMarginRatioPct: 28 }); // delta = 2
    const causes = classifyCause(prev, current);
    expect(causes).not.toContain("単価変動");
  });
});

// ── 組合せ ─────────────────────────────────────────────────────────────────

describe("classifyCause - 複数原因の組合せ", () => {
  it("受注額減 + 原価増 が同時に発生", () => {
    const prev = makeSnap({
      contractAmountYen: 12_000_000,
      totalCostYen: 5_000_000,
      forecastMarginRatioPct: 50,
    });
    const current = makeSnap({
      contractAmountYen: 10_000_000,
      totalCostYen: 6_000_000, // 120% of prev
      forecastMarginRatioPct: 38, // delta 12%
    });
    const causes = classifyCause(prev, current);
    expect(causes).toContain("受注額減");
    expect(causes).toContain("原価増");
    expect(causes).toContain("単価変動");
  });

  it("原因なし → 空配列", () => {
    const prev = makeSnap({
      contractAmountYen: 10_000_000,
      totalCostYen: 5_000_000,
      forecastMarginRatioPct: 30,
    });
    const current = makeSnap({
      contractAmountYen: 10_000_000,
      totalCostYen: 5_200_000, // 4% increase, not > 10%
      estimatedRemainingCostYen: 1_000_000,
      forecastMarginRatioPct: 28, // delta 2%, not > 5%
    });
    const causes = classifyCause(prev, current);
    // 予測超過: remainingBudget = 10M - 5.2M = 4.8M, remaining = 1M → not exceeded
    expect(causes).toHaveLength(0);
  });
});
