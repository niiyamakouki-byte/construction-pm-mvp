/**
 * portfolio-pipeline-metrics — unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  weightedPipelineJpy,
  criticalRiskDealCount,
  expectedClosesThisMonthJpy,
} from "../portfolio-pipeline-metrics.js";
import { _resetDealStore, dealStore } from "../deal-store.js";
import type { Deal } from "../types.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

function makeDeal(id: string, overrides: Partial<Deal> = {}): Deal {
  const now = new Date().toISOString();
  return {
    id,
    customerName: `顧客${id}`,
    currentStage: "proposal",
    expectedAmountJpy: 10_000_000,
    probabilityPct: 50,
    expectedCloseDate: "2099-12-31",
    ownerName: "新山光輝",
    stageHistory: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function closeDateFromNow(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split("T")[0];
}

beforeEach(() => {
  localStorage.clear();
  _resetDealStore();
});

describe("weightedPipelineJpy", () => {
  it("空の場合は 0", () => {
    expect(weightedPipelineJpy()).toBe(0);
  });

  it("加重金額を合計する", () => {
    dealStore.save(makeDeal("d-001", { expectedAmountJpy: 10_000_000, probabilityPct: 50 }));
    dealStore.save(makeDeal("d-002", { expectedAmountJpy: 5_000_000, probabilityPct: 30 }));
    // 5M + 1.5M = 6.5M
    expect(weightedPipelineJpy()).toBe(6_500_000);
  });

  it("won/lost は含めない", () => {
    dealStore.save(makeDeal("d-001", { expectedAmountJpy: 10_000_000, probabilityPct: 50 }));
    dealStore.save(makeDeal("d-won", { currentStage: "won", probabilityPct: 100, expectedAmountJpy: 20_000_000 }));
    expect(weightedPipelineJpy()).toBe(5_000_000);
  });
});

describe("criticalRiskDealCount", () => {
  it("空の場合は 0", () => {
    expect(criticalRiskDealCount()).toBe(0);
  });

  it("near_due の critical アラートをカウントする", () => {
    const closeDate = closeDateFromNow(2); // 2日後 → critical
    dealStore.save(makeDeal("d-crit", {
      currentStage: "proposal",
      expectedCloseDate: closeDate,
    }));
    expect(criticalRiskDealCount()).toBeGreaterThanOrEqual(1);
  });
});

describe("expectedClosesThisMonthJpy", () => {
  it("空の場合は 0", () => {
    expect(expectedClosesThisMonthJpy()).toBe(0);
  });

  it("今月クローズ予定の加重金額を合計する", () => {
    const thisMonthDate = closeDateFromNow(5);
    dealStore.save(makeDeal("d-this-month", {
      expectedCloseDate: thisMonthDate,
      expectedAmountJpy: 10_000_000,
      probabilityPct: 80,
    }));
    expect(expectedClosesThisMonthJpy()).toBe(8_000_000);
  });

  it("来月は含まない", () => {
    const nextMonthDate = closeDateFromNow(40);
    dealStore.save(makeDeal("d-next-month", {
      expectedCloseDate: nextMonthDate,
      expectedAmountJpy: 10_000_000,
      probabilityPct: 80,
    }));
    expect(expectedClosesThisMonthJpy()).toBe(0);
  });
});
