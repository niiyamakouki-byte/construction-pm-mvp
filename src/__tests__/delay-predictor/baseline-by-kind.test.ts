/**
 * Tests for calculateKindBaselineRisk (delay-predictor)
 */

import { describe, expect, it } from "vitest";
import { calculateKindBaselineRisk } from "../../lib/delay-predictor/baseline-by-kind.js";
import { WeatherCondition } from "../../lib/delay-predictor/types.js";
import type { HistoricalTaskRecord } from "../../lib/delay-predictor/types.js";

let _c = 0;

function makeRecord(
  taskKind: string,
  plannedDays: number,
  actualDays: number,
): HistoricalTaskRecord {
  return {
    id: `r-${++_c}`,
    taskKind,
    plannedDays,
    actualDays,
    weather: [WeatherCondition.sunny],
    laborAvailabilityRatio: 1.0,
    season: "spring",
  };
}

describe("calculateKindBaselineRisk", () => {
  it("同種の過去データなしは 0", () => {
    expect(calculateKindBaselineRisk("内装", [])).toBe(0);
  });

  it("同種はあるが別 kind のみは 0", () => {
    const h = [makeRecord("電気", 5, 5)];
    expect(calculateKindBaselineRisk("内装", h)).toBe(0);
  });

  it("avgRatio < 1.0 → risk 0", () => {
    // actualDays < plannedDays
    const h = [makeRecord("内装", 10, 8), makeRecord("内装", 10, 9)];
    expect(calculateKindBaselineRisk("内装", h)).toBe(0);
  });

  it("avgRatio = 1.0 (exactly) → risk 40", () => {
    const h = [makeRecord("内装", 5, 5)];
    expect(calculateKindBaselineRisk("内装", h)).toBe(40);
  });

  it("avgRatio = 1.1 → risk 40", () => {
    // 5+1 / 5 = 1.1
    const h = [makeRecord("内装", 10, 11)];
    expect(calculateKindBaselineRisk("内装", h)).toBe(40);
  });

  it("avgRatio = 1.2 exactly → risk 60", () => {
    const h = [makeRecord("内装", 10, 12)];
    expect(calculateKindBaselineRisk("内装", h)).toBe(60);
  });

  it("avgRatio = 1.3 → risk 60", () => {
    const h = [makeRecord("内装", 10, 13)];
    expect(calculateKindBaselineRisk("内装", h)).toBe(60);
  });

  it("avgRatio = 1.5 exactly → risk 80", () => {
    const h = [makeRecord("内装", 10, 15)];
    expect(calculateKindBaselineRisk("内装", h)).toBe(80);
  });

  it("avgRatio > 1.5 → risk 80", () => {
    const h = [makeRecord("内装", 5, 10)]; // ratio = 2.0
    expect(calculateKindBaselineRisk("内装", h)).toBe(80);
  });

  it("複数レコードの平均で判定する", () => {
    // ratio: 1.0 + 2.0 = avg 1.5 → 80
    const h = [makeRecord("内装", 10, 10), makeRecord("内装", 10, 20)];
    expect(calculateKindBaselineRisk("内装", h)).toBe(80);
  });
});
