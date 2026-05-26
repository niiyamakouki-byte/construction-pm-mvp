/**
 * Tests for portfolio-aggregator delay extension (Sprint 13-A)
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { aggregatePortfolio } from "../../lib/exec-dashboard/portfolio-aggregator.js";
import { PredictionStore, _resetPredictionStore } from "../../lib/delay-predictor/prediction-store.js";
import type { DelayPrediction } from "../../lib/delay-predictor/types.js";
import type { ProjectPortfolioEntry } from "../../lib/exec-dashboard/portfolio-aggregator.js";
import type { Project, Task, Invoice } from "../../domain/types.js";

// ── LocalStorage mock ──────────────────────────────────────────────────────

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createMockLocalStorage());
  _resetPredictionStore();
});

// ── Helpers ────────────────────────────────────────────────────────────────

function makeProject(id: string): Project {
  return {
    id,
    name: `Project ${id}`,
    description: "",
    status: "active",
    startDate: "2026-01-01",
    includeWeekends: false,
    budget: 1_000_000,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

function makeEntry(projectId: string): ProjectPortfolioEntry {
  return {
    project: makeProject(projectId),
    tasks: [] as Task[],
    invoices: [] as Invoice[],
    chatMessages: [],
    photos: [],
    contractAmount: 1_000_000,
    grossProfit: 200_000,
  };
}

function makePrediction(
  taskId: string,
  projectId: string,
  riskLevel: DelayPrediction["riskLevel"],
): DelayPrediction {
  return {
    taskId,
    projectId,
    riskPct: riskLevel === "critical" ? 90 : riskLevel === "high" ? 70 : 20,
    riskLevel,
    factors: { weatherRisk: 10, laborRisk: 0, kindBaselineRisk: 40 },
    suggestedAction_ja: "予定通り進行可",
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("aggregatePortfolio — criticalDelayCount / highDelayCount", () => {
  it("空エントリは criticalDelayCount = 0, highDelayCount = 0", () => {
    const summary = aggregatePortfolio([]);
    expect(summary.criticalDelayCount).toBe(0);
    expect(summary.highDelayCount).toBe(0);
  });

  it("PredictionStore にデータなし → 両方 0", () => {
    const summary = aggregatePortfolio([makeEntry("p1")]);
    expect(summary.criticalDelayCount).toBe(0);
    expect(summary.highDelayCount).toBe(0);
  });

  it("critical 予測 2件が criticalDelayCount に反映される", () => {
    const store = new PredictionStore();
    store.save(makePrediction("t1", "p1", "critical"));
    store.save(makePrediction("t2", "p1", "critical"));
    store.save(makePrediction("t3", "p1", "low"));

    const summary = aggregatePortfolio([makeEntry("p1")]);
    expect(summary.criticalDelayCount).toBe(2);
  });

  it("high 予測 3件が highDelayCount に反映される", () => {
    const store = new PredictionStore();
    store.save(makePrediction("t1", "p1", "high"));
    store.save(makePrediction("t2", "p1", "high"));
    store.save(makePrediction("t3", "p1", "high"));

    const summary = aggregatePortfolio([makeEntry("p1")]);
    expect(summary.highDelayCount).toBe(3);
  });

  it("複数プロジェクトにまたがる場合は合算される", () => {
    const store = new PredictionStore();
    store.save(makePrediction("t1", "p1", "critical"));
    store.save(makePrediction("t2", "p2", "critical"));
    store.save(makePrediction("t3", "p2", "high"));

    const summary = aggregatePortfolio([makeEntry("p1"), makeEntry("p2")]);
    expect(summary.criticalDelayCount).toBe(2);
    expect(summary.highDelayCount).toBe(1);
  });

  it("PortfolioSummary の既存フィールドに影響しない", () => {
    const summary = aggregatePortfolio([makeEntry("p1")]);
    expect(typeof summary.totalProjects).toBe("number");
    expect(typeof summary.weightedProgress).toBe("number");
    expect(Array.isArray(summary.dangerSignals)).toBe(true);
  });
});
