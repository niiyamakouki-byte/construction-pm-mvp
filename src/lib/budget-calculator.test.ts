import { describe, expect, it } from "vitest";
import {
  calculateBudgetBreakdown,
  compareEstimateVsActual,
  generateBudgetReport,
} from "./budget-calculator.js";

const categories = [
  { name: "材料費", estimated: 5_000_000, actual: 5_200_000 },
  { name: "人件費", estimated: 3_000_000, actual: 2_800_000 },
  { name: "設備費", estimated: 2_000_000, actual: 2_100_000 },
];

// ── calculateBudgetBreakdown ──────────────────────────

describe("calculateBudgetBreakdown", () => {
  it("calculates totals correctly", () => {
    const result = calculateBudgetBreakdown("Test Project", categories);
    expect(result.totalEstimated).toBe(10_000_000);
    expect(result.totalActual).toBe(10_100_000);
    expect(result.variance).toBe(100_000);
  });

  it("detects on_budget within 5%", () => {
    const result = calculateBudgetBreakdown("Test", categories);
    expect(result.status).toBe("on_budget");
  });

  it("detects over_budget", () => {
    const overBudget = [
      { name: "A", estimated: 1_000_000, actual: 1_200_000 },
    ];
    const result = calculateBudgetBreakdown("Over", overBudget);
    expect(result.status).toBe("over_budget");
    expect(result.variancePct).toBeGreaterThan(5);
  });

  it("detects under_budget", () => {
    const underBudget = [
      { name: "A", estimated: 1_000_000, actual: 800_000 },
    ];
    const result = calculateBudgetBreakdown("Under", underBudget);
    expect(result.status).toBe("under_budget");
  });

  it("handles empty categories", () => {
    const result = calculateBudgetBreakdown("Empty", []);
    expect(result.totalEstimated).toBe(0);
    expect(result.totalActual).toBe(0);
  });
});

// ── compareEstimateVsActual ───────────────────────────

describe("compareEstimateVsActual", () => {
  it("classifies items correctly", () => {
    const items = [
      { category: "材料費", estimated: 1_000_000, actual: 1_500_000 },
      { category: "人件費", estimated: 1_000_000, actual: 1_000_000 },
      { category: "設備費", estimated: 1_000_000, actual: 700_000 },
    ];
    const result = compareEstimateVsActual(items);
    expect(result.items[0].status).toBe("over");
    expect(result.items[1].status).toBe("on_track");
    expect(result.items[2].status).toBe("under");
  });

  it("calculates overall variance", () => {
    const items = [
      { category: "A", estimated: 100, actual: 120 },
      { category: "B", estimated: 200, actual: 180 },
    ];
    const result = compareEstimateVsActual(items);
    expect(result.totalEstimated).toBe(300);
    expect(result.totalActual).toBe(300);
    expect(result.overallVariance).toBe(0);
  });
});

// ── generateBudgetReport ──────────────────────────────

describe("generateBudgetReport", () => {
  it("generates valid HTML", () => {
    const breakdown = calculateBudgetBreakdown("Test Project", categories);
    const html = generateBudgetReport(breakdown);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Test Project");
    expect(html).toContain("予算レポート");
  });

  it("shows correct status label", () => {
    const overBudget = calculateBudgetBreakdown("Over", [
      { name: "A", estimated: 100, actual: 200 },
    ]);
    const html = generateBudgetReport(overBudget);
    expect(html).toContain("予算超過");
  });

  it("includes all categories", () => {
    const breakdown = calculateBudgetBreakdown("Test", categories);
    const html = generateBudgetReport(breakdown);
    expect(html).toContain("材料費");
    expect(html).toContain("人件費");
    expect(html).toContain("設備費");
  });
});
