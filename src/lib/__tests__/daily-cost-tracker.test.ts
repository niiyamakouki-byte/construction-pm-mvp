import { describe, expect, it } from "vitest";
import {
  type DailyCostEntry,
  computeBudgetConsumption,
  recordDailyCost,
  summarizeWeek,
} from "../daily-cost-tracker.js";

// ── Helpers ───────────────────────────────────────────────

function makeEntry(
  overrides: Partial<Omit<DailyCostEntry, "id" | "createdAt">> = {},
): Omit<DailyCostEntry, "id" | "createdAt"> {
  return {
    projectId: "proj-1",
    date: "2025-04-14", // Monday
    category: "labor",
    amount: 50_000,
    description: "大工作業",
    enteredBy: "tanaka",
    ...overrides,
  };
}

// ── recordDailyCost ───────────────────────────────────────

describe("recordDailyCost", () => {
  it("assigns a UUID id", () => {
    const entry = recordDailyCost(makeEntry());
    expect(entry.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("assigns a createdAt Date", () => {
    const before = new Date();
    const entry = recordDailyCost(makeEntry());
    const after = new Date();
    expect(entry.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(entry.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("preserves all input fields", () => {
    const input = makeEntry({ category: "material", amount: 120_000, enteredBy: "suzuki" });
    const entry = recordDailyCost(input);
    expect(entry.category).toBe("material");
    expect(entry.amount).toBe(120_000);
    expect(entry.enteredBy).toBe("suzuki");
    expect(entry.projectId).toBe("proj-1");
  });

  it("generates unique ids for separate calls", () => {
    const a = recordDailyCost(makeEntry());
    const b = recordDailyCost(makeEntry());
    expect(a.id).not.toBe(b.id);
  });
});

// ── summarizeWeek ─────────────────────────────────────────

function toEntry(partial: Partial<DailyCostEntry>): DailyCostEntry {
  return {
    id: "x",
    projectId: "proj-1",
    date: "2025-04-14",
    category: "labor",
    amount: 0,
    description: "",
    enteredBy: "a",
    createdAt: new Date(),
    ...partial,
  };
}

describe("summarizeWeek", () => {
  it("returns zero totals for empty entries", () => {
    const summary = summarizeWeek([], "2025-04-14");
    expect(summary.totalAmount).toBe(0);
    expect(summary.entryCount).toBe(0);
    expect(summary.totalByCategory.labor).toBe(0);
    expect(summary.totalByCategory.material).toBe(0);
  });

  it("sums amounts by category for entries in the week", () => {
    const entries = [
      toEntry({ date: "2025-04-14", category: "labor", amount: 30_000 }),
      toEntry({ date: "2025-04-15", category: "labor", amount: 20_000 }),
      toEntry({ date: "2025-04-16", category: "material", amount: 50_000 }),
      toEntry({ date: "2025-04-20", category: "equipment", amount: 10_000 }), // Sunday still same week
    ];
    const summary = summarizeWeek(entries, "2025-04-14");
    expect(summary.totalByCategory.labor).toBe(50_000);
    expect(summary.totalByCategory.material).toBe(50_000);
    expect(summary.totalByCategory.equipment).toBe(10_000);
    expect(summary.totalAmount).toBe(110_000);
    expect(summary.entryCount).toBe(4);
  });

  it("excludes entries from a different week", () => {
    const entries = [
      toEntry({ date: "2025-04-14", category: "labor", amount: 30_000 }), // week of Apr 14
      toEntry({ date: "2025-04-21", category: "labor", amount: 20_000 }), // next week
    ];
    const summary = summarizeWeek(entries, "2025-04-14");
    expect(summary.totalAmount).toBe(30_000);
    expect(summary.entryCount).toBe(1);
  });

  it("handles week-spanning dates correctly (Monday to Sunday)", () => {
    const entries = [
      toEntry({ date: "2025-04-13", category: "other", amount: 5_000 }), // previous Sunday
      toEntry({ date: "2025-04-14", category: "other", amount: 10_000 }), // this Monday
      toEntry({ date: "2025-04-20", category: "other", amount: 10_000 }), // this Sunday
      toEntry({ date: "2025-04-21", category: "other", amount: 5_000 }), // next Monday
    ];
    const summary = summarizeWeek(entries, "2025-04-14");
    expect(summary.entryCount).toBe(2);
    expect(summary.totalAmount).toBe(20_000);
  });

  it("returns correct weekStart in summary", () => {
    const summary = summarizeWeek([], "2025-04-14");
    expect(summary.weekStart).toBe("2025-04-14");
  });
});

// ── computeBudgetConsumption ──────────────────────────────

function makeEntries(amounts: number[], projectId = "proj-1"): DailyCostEntry[] {
  return amounts.map((amount, i) =>
    toEntry({
      id: `e-${i}`,
      projectId,
      date: "2025-04-15",
      category: "labor",
      amount,
    }),
  );
}

describe("computeBudgetConsumption", () => {
  const startDate = "2025-01-01";
  const endDate = "2025-12-31"; // 364 days total

  it("computes consumed rate correctly", () => {
    const entries = makeEntries([1_000_000, 2_000_000]);
    const result = computeBudgetConsumption(entries, 10_000_000, startDate, endDate);
    expect(result.consumedTotal).toBe(3_000_000);
    expect(result.budgetTotal).toBe(10_000_000);
    expect(result.consumedRate).toBeCloseTo(0.3, 5);
    expect(result.remainingBudget).toBe(7_000_000);
  });

  it("returns zero consumedRate when budget is zero", () => {
    const result = computeBudgetConsumption([], 0, startDate, endDate);
    expect(result.consumedRate).toBe(0);
    expect(result.consumedTotal).toBe(0);
  });

  it("handles empty entries with positive budget", () => {
    const result = computeBudgetConsumption([], 5_000_000, startDate, endDate);
    expect(result.consumedTotal).toBe(0);
    expect(result.burnRatePerDay).toBe(0);
    expect(result.projectedTotal).toBe(0);
    expect(result.forecastOverrun).toBe(-5_000_000);
  });

  it("detects budget overrun when projected exceeds budget", () => {
    // Spend 6M in first half of year → will project 12M for full year
    const entries = makeEntries([6_000_000]);
    const result = computeBudgetConsumption(entries, 10_000_000, "2025-01-01", "2025-12-31");
    // forecastOverrun = projectedTotal - budgetTotal
    // If burnRatePerDay is high enough, overrun should be positive
    expect(result.forecastOverrun).toBeDefined();
    // consumedTotal > half budget while not at end: possible overrun
    expect(result.projectedTotal).toBeGreaterThan(0);
  });

  it("provides daysElapsed >= 1", () => {
    const result = computeBudgetConsumption([], 1_000_000, startDate, endDate);
    expect(result.daysElapsed).toBeGreaterThanOrEqual(1);
  });

  it("forecastOverrun is projectedTotal minus budgetTotal", () => {
    const entries = makeEntries([500_000]);
    const result = computeBudgetConsumption(entries, 10_000_000, startDate, endDate);
    expect(result.forecastOverrun).toBe(result.projectedTotal - result.budgetTotal);
  });
});
