import { describe, expect, it } from "vitest";
import {
  type MonthlyData,
  predictFinalCost,
  trendAnalysis,
  generateForecastReport,
} from "./cost-forecaster.js";

const project = { name: "Test Project", budget: 10_000_000 };

function makeTasks(progresses: number[]) {
  return progresses.map((p, _i) => ({
    progress: p,
    status: p === 100 ? ("done" as const) : ("in_progress" as const),
  }));
}

function makeExpenses(amounts: number[]) {
  return amounts.map((a) => ({
    amount: a,
    approvalStatus: "approved" as const,
  }));
}

// ── predictFinalCost ───────────────────────────────

describe("predictFinalCost", () => {
  it("projects cost from progress", () => {
    const result = predictFinalCost(
      project,
      makeTasks([50, 50]),
      makeExpenses([2_500_000, 2_500_000]),
    );
    // 50% done, 5M spent -> EAC = 10M
    expect(result).toBe(10_000_000);
  });

  it("returns budget when no progress", () => {
    const result = predictFinalCost(project, makeTasks([0]), makeExpenses([0]));
    expect(result).toBe(10_000_000);
  });

  it("projects overrun when spending exceeds pace", () => {
    const result = predictFinalCost(
      project,
      makeTasks([25, 25]),
      makeExpenses([5_000_000]),
    );
    // 25% done, 5M spent -> EAC = 20M
    expect(result).toBe(20_000_000);
  });

  it("includes pending expenses", () => {
    const expenses = [
      { amount: 3_000_000, approvalStatus: "approved" as const },
      { amount: 2_000_000, approvalStatus: "pending" as const },
    ];
    const result = predictFinalCost(project, makeTasks([50, 50]), expenses);
    expect(result).toBe(10_000_000);
  });

  it("excludes rejected expenses", () => {
    const expenses = [
      { amount: 3_000_000, approvalStatus: "approved" as const },
      { amount: 2_000_000, approvalStatus: "rejected" as const },
    ];
    const result = predictFinalCost(project, makeTasks([50, 50]), expenses);
    // 50% done, 3M spent -> EAC = 6M
    expect(result).toBe(6_000_000);
  });
});

// ── trendAnalysis ──────────────────────────────────

describe("trendAnalysis", () => {
  it("detects increasing trend", () => {
    const data: MonthlyData[] = [
      { month: "2025-01", actualCost: 100_000, budgetedCost: 100_000 },
      { month: "2025-02", actualCost: 200_000, budgetedCost: 100_000 },
      { month: "2025-03", actualCost: 300_000, budgetedCost: 100_000 },
      { month: "2025-04", actualCost: 400_000, budgetedCost: 100_000 },
    ];
    const result = trendAnalysis(data);
    expect(result.trend).toBe("increasing");
    expect(result.slope).toBeGreaterThan(0);
  });

  it("detects decreasing trend", () => {
    const data: MonthlyData[] = [
      { month: "2025-01", actualCost: 400_000, budgetedCost: 100_000 },
      { month: "2025-02", actualCost: 300_000, budgetedCost: 100_000 },
      { month: "2025-03", actualCost: 200_000, budgetedCost: 100_000 },
      { month: "2025-04", actualCost: 100_000, budgetedCost: 100_000 },
    ];
    const result = trendAnalysis(data);
    expect(result.trend).toBe("decreasing");
    expect(result.slope).toBeLessThan(0);
  });

  it("detects stable trend", () => {
    const data: MonthlyData[] = [
      { month: "2025-01", actualCost: 100_000, budgetedCost: 100_000 },
      { month: "2025-02", actualCost: 100_000, budgetedCost: 100_000 },
      { month: "2025-03", actualCost: 100_000, budgetedCost: 100_000 },
    ];
    const result = trendAnalysis(data);
    expect(result.trend).toBe("stable");
    expect(result.slope).toBe(0);
  });

  it("handles empty data", () => {
    const result = trendAnalysis([]);
    expect(result.trend).toBe("stable");
    expect(result.averageMonthly).toBe(0);
  });

  it("calculates projected next month", () => {
    const data: MonthlyData[] = [
      { month: "2025-01", actualCost: 100_000, budgetedCost: 100_000 },
      { month: "2025-02", actualCost: 200_000, budgetedCost: 100_000 },
    ];
    const result = trendAnalysis(data);
    expect(result.projectedNext).toBeGreaterThan(0);
  });
});

// ── generateForecastReport ─────────────────────────

describe("generateForecastReport", () => {
  it("generates full report", () => {
    const report = generateForecastReport(
      project,
      makeTasks([50, 50]),
      makeExpenses([2_500_000, 2_500_000]),
    );
    expect(report.projectName).toBe("Test Project");
    expect(report.totalBudget).toBe(10_000_000);
    expect(report.spentToDate).toBe(5_000_000);
    expect(report.completionPct).toBe(50);
    expect(report.riskLevel).toBe("low");
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it("flags high risk when over budget", () => {
    const report = generateForecastReport(
      project,
      makeTasks([25, 25]),
      makeExpenses([5_000_000]),
    );
    expect(report.riskLevel).toBe("high");
  });

  it("recommends action for increasing trend", () => {
    const monthly: MonthlyData[] = [
      { month: "2025-01", actualCost: 100_000, budgetedCost: 100_000 },
      { month: "2025-02", actualCost: 300_000, budgetedCost: 100_000 },
      { month: "2025-03", actualCost: 500_000, budgetedCost: 100_000 },
    ];
    const report = generateForecastReport(
      project,
      makeTasks([50, 50]),
      makeExpenses([2_500_000, 2_500_000]),
      monthly,
    );
    expect(report.trend.trend).toBe("increasing");
    expect(report.recommendations.some((r) => r.includes("増加"))).toBe(true);
  });

  it("handles zero budget gracefully", () => {
    const report = generateForecastReport(
      { name: "No Budget", budget: 0 },
      makeTasks([50]),
      makeExpenses([100_000]),
    );
    expect(report.totalBudget).toBe(0);
    expect(report.remainingBudget).toBe(-100_000);
  });
});
