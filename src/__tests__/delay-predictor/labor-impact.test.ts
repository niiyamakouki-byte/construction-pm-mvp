/**
 * Tests for calculateLaborRisk (delay-predictor)
 */

import { describe, expect, it } from "vitest";
import { calculateLaborRisk } from "../../lib/delay-predictor/labor-impact.js";
import type { LaborAvailability } from "../../lib/delay-predictor/types.js";

function makeDay(available: number, required: number, date = "2026-05-01"): LaborAvailability {
  return { date, available_workers: available, required_workers: required };
}

describe("calculateLaborRisk — 基本", () => {
  it("空配列は 0", () => {
    expect(calculateLaborRisk([])).toBe(0);
  });

  it("ratio >= 1.0 のみの場合は 0", () => {
    expect(calculateLaborRisk([makeDay(4, 4)])).toBe(0);
  });

  it("ratio = 1.2 (required < available) は 0", () => {
    expect(calculateLaborRisk([makeDay(6, 5)])).toBe(0);
  });
});

describe("calculateLaborRisk — 中リスク (0.70 <= ratio < 0.85)", () => {
  it("ratio = 0.84 は +15", () => {
    expect(calculateLaborRisk([makeDay(84, 100)])).toBe(15);
  });

  it("ratio = 0.70 は +30 (境界: 0.70 未満のみ +30)", () => {
    // ratio = 0.70 → not < 0.70 → +15
    expect(calculateLaborRisk([makeDay(70, 100)])).toBe(15);
  });

  it("ratio = 0.75 は +15", () => {
    expect(calculateLaborRisk([makeDay(75, 100)])).toBe(15);
  });
});

describe("calculateLaborRisk — 高リスク (ratio < 0.70)", () => {
  it("ratio = 0.69 は +30", () => {
    expect(calculateLaborRisk([makeDay(69, 100)])).toBe(30);
  });

  it("ratio = 0.5 は +30", () => {
    expect(calculateLaborRisk([makeDay(5, 10)])).toBe(30);
  });

  it("ratio = 0 は +30", () => {
    expect(calculateLaborRisk([makeDay(0, 10)])).toBe(30);
  });
});

describe("calculateLaborRisk — 複数日の平均", () => {
  it("良い日・悪い日の平均が境界をまたぐ場合", () => {
    // Day1: 100/100 = 1.0, Day2: 40/100 = 0.4 → avg = 0.7 → +15
    const result = calculateLaborRisk([makeDay(100, 100), makeDay(40, 100)]);
    expect(result).toBe(15);
  });

  it("全日 ratio >= 1.0 は 0", () => {
    const days = [makeDay(5, 4), makeDay(3, 3), makeDay(6, 5)];
    expect(calculateLaborRisk(days)).toBe(0);
  });
});

describe("calculateLaborRisk — required = 0 の場合", () => {
  it("required = 0 の日は ratio = 1.0 として扱う", () => {
    expect(calculateLaborRisk([makeDay(0, 0)])).toBe(0);
  });

  it("required = 0 の日が混在しても平均に影響する", () => {
    // Day1: ratio=1.0 (0/0), Day2: ratio=0.5 → avg = 0.75 → +15
    const result = calculateLaborRisk([makeDay(0, 0), makeDay(5, 10)]);
    expect(result).toBe(15);
  });
});
