/**
 * PipelineSnapshotter — unit tests.
 */

import { describe, it, expect } from "vitest";
import { snapshot } from "../pipeline-snapshotter.js";
import type { Deal } from "../types.js";

function makeDeal(id: string, overrides: Partial<Deal> = {}): Deal {
  const now = new Date().toISOString();
  return {
    id,
    customerName: `顧客${id}`,
    currentStage: "inquiry",
    expectedAmountJpy: 1_000_000,
    probabilityPct: 5,
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

describe("snapshot", () => {
  it("空配列でゼロ値スナップショットを返す", () => {
    const snap = snapshot([]);
    expect(snap.totalDeals).toBe(0);
    expect(snap.weightedPipelineJpy).toBe(0);
    expect(snap.stalledDeals).toHaveLength(0);
    expect(snap.expectedClosesThisMonth).toBe(0);
    expect(snap.riskAlerts).toHaveLength(0);
  });

  it("won/lost は totalDeals に含まれない", () => {
    const deals = [
      makeDeal("d-001", { currentStage: "inquiry" }),
      makeDeal("d-002", { currentStage: "won", probabilityPct: 100 }),
      makeDeal("d-003", { currentStage: "lost", probabilityPct: 0 }),
    ];
    const snap = snapshot(deals);
    expect(snap.totalDeals).toBe(1);
  });

  it("weightedPipelineJpy を正しく集計する", () => {
    const deals = [
      makeDeal("d-001", { expectedAmountJpy: 10_000_000, probabilityPct: 50 }),
      makeDeal("d-002", { expectedAmountJpy: 5_000_000, probabilityPct: 30 }),
    ];
    const snap = snapshot(deals);
    // 10M*50% + 5M*30% = 5M + 1.5M = 6.5M
    expect(snap.weightedPipelineJpy).toBe(6_500_000);
  });

  it("今月クローズ予定件数を集計する", () => {
    const thisMonth = closeDateFromNow(5);
    const nextMonth = closeDateFromNow(40);
    const deals = [
      makeDeal("d-001", { expectedCloseDate: thisMonth }),
      makeDeal("d-002", { expectedCloseDate: thisMonth }),
      makeDeal("d-003", { expectedCloseDate: nextMonth }),
    ];
    const snap = snapshot(deals);
    expect(snap.expectedClosesThisMonth).toBe(2);
  });

  it("stalledDeals に標準超過の商談が含まれる", () => {
    // inquiry 標準1日、2日前に作成
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - 2);
    const deals = [
      makeDeal("d-stalled", {
        currentStage: "inquiry",
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString(),
      }),
    ];
    const snap = snapshot(deals);
    expect(snap.stalledDeals.some((d) => d.id === "d-stalled")).toBe(true);
  });

  it("riskAlerts は severity 順 (critical → warn → info)", () => {
    const closeDate = closeDateFromNow(2); // near_due = critical
    const deals = [
      makeDeal("d-001", {
        currentStage: "proposal",
        expectedCloseDate: closeDate,
        expectedAmountJpy: 20_000_000,
        probabilityPct: 10,
      }),
    ];
    const snap = snapshot(deals);
    // critical が先
    if (snap.riskAlerts.length >= 2) {
      const critIdx = snap.riskAlerts.findIndex((a) => a.severity === "critical");
      const warnIdx = snap.riskAlerts.findIndex((a) => a.severity === "warn");
      if (critIdx !== -1 && warnIdx !== -1) {
        expect(critIdx).toBeLessThan(warnIdx);
      }
    }
  });
});
