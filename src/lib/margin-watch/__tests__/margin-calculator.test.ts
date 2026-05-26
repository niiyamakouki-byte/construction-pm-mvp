/**
 * Tests for margin-calculator.
 */

import { describe, expect, it } from "vitest";
import { calculateMargin } from "../margin-calculator.js";
import type { ProjectFinanceSnapshot } from "../types.js";
import { DEFAULT_MARGIN_WATCH_CONFIG } from "../types.js";

function makeSnap(overrides: Partial<ProjectFinanceSnapshot> = {}): ProjectFinanceSnapshot {
  return {
    projectId: "p1",
    projectName: "テスト",
    contractAmountYen: 10_000_000,
    totalCostYen: 6_000_000,
    estimatedRemainingCostYen: 1_000_000,
    marginRatioPct: 0,
    forecastMarginRatioPct: 0,
    ...overrides,
  };
}

// ── 0除算ガード ────────────────────────────────────────────────────────────

describe("calculateMargin - 0除算ガード", () => {
  it("contractAmountYen=0 → level safe, actual/forecast 0", () => {
    const result = calculateMargin(makeSnap({ contractAmountYen: 0 }));
    expect(result.actual).toBe(0);
    expect(result.forecast).toBe(0);
    expect(result.level).toBe("safe");
  });
});

// ── 計算式 ─────────────────────────────────────────────────────────────────

describe("calculateMargin - 計算式", () => {
  it("actual = (contract - totalCost) / contract * 100", () => {
    const result = calculateMargin(makeSnap({
      contractAmountYen: 10_000_000,
      totalCostYen: 6_000_000,
      estimatedRemainingCostYen: 0,
    }));
    expect(result.actual).toBeCloseTo(40, 5);
  });

  it("forecast = (contract - totalCost - remaining) / contract * 100", () => {
    const result = calculateMargin(makeSnap({
      contractAmountYen: 10_000_000,
      totalCostYen: 6_000_000,
      estimatedRemainingCostYen: 1_000_000,
    }));
    expect(result.forecast).toBeCloseTo(30, 5);
  });

  it("負の粗利率 (赤字案件)", () => {
    const result = calculateMargin(makeSnap({
      contractAmountYen: 10_000_000,
      totalCostYen: 12_000_000,
      estimatedRemainingCostYen: 0,
    }));
    expect(result.actual).toBeCloseTo(-20, 5);
    expect(result.level).toBe("critical");
  });
});

// ── level 境界値 ───────────────────────────────────────────────────────────

describe("calculateMargin - level 境界", () => {
  const contract = 10_000_000;

  function snapshotWithForecast(forecastPct: number): ProjectFinanceSnapshot {
    // forecast = (contract - totalCost - remaining) / contract * 100
    // set totalCost=0, remaining = contract * (1 - forecastPct/100)
    const remaining = contract * (1 - forecastPct / 100);
    return makeSnap({
      contractAmountYen: contract,
      totalCostYen: 0,
      estimatedRemainingCostYen: remaining,
    });
  }

  it("forecast=30 → safe (cautionMarginPct=30 以上)", () => {
    const result = calculateMargin(snapshotWithForecast(30));
    expect(result.level).toBe("safe");
  });

  it("forecast=29.9 → caution", () => {
    const result = calculateMargin(snapshotWithForecast(29.9));
    expect(result.level).toBe("caution");
  });

  it("forecast=25 → caution (target=25 以上 caution 未満)", () => {
    const result = calculateMargin(snapshotWithForecast(25));
    expect(result.level).toBe("caution");
  });

  it("forecast=24.9 → warning", () => {
    const result = calculateMargin(snapshotWithForecast(24.9));
    expect(result.level).toBe("warning");
  });

  it("forecast=15 → warning (critical 閾値以上)", () => {
    const result = calculateMargin(snapshotWithForecast(15));
    expect(result.level).toBe("warning");
  });

  it("forecast=14.9 → critical", () => {
    const result = calculateMargin(snapshotWithForecast(14.9));
    expect(result.level).toBe("critical");
  });

  it("forecast=0 → critical", () => {
    const result = calculateMargin(snapshotWithForecast(0));
    expect(result.level).toBe("critical");
  });

  it("forecast=-5 → critical", () => {
    const result = calculateMargin(snapshotWithForecast(-5));
    expect(result.level).toBe("critical");
  });
});

// ── カスタム config ────────────────────────────────────────────────────────

describe("calculateMargin - カスタム config", () => {
  it("custom criticalMarginPct=20 → forecast=19 は critical", () => {
    const config = { ...DEFAULT_MARGIN_WATCH_CONFIG, criticalMarginPct: 20 };
    const snap = makeSnap({
      contractAmountYen: 10_000_000,
      totalCostYen: 0,
      estimatedRemainingCostYen: 8_100_000, // forecast = 19%
    });
    const result = calculateMargin(snap, config);
    expect(result.level).toBe("critical");
  });
});
