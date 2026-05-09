/**
 * ConversionAnalyzer — unit tests.
 */

import { describe, it, expect } from "vitest";
import { analyzeConversionFunnel } from "../conversion-analyzer.js";
import type { Deal, StageTransition } from "../types.js";

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

function makeTransition(
  fromStage: Deal["currentStage"],
  toStage: Deal["currentStage"],
  daysAgo: number = 10,
): StageTransition {
  const t = new Date();
  t.setDate(t.getDate() - daysAgo);
  return {
    fromStage,
    toStage,
    transitionedAt: t.toISOString(),
    daysInPreviousStage: 3,
  };
}

describe("analyzeConversionFunnel", () => {
  it("空配列で StageMetrics[] を返す (won まで7ステージ)", () => {
    const metrics = analyzeConversionFunnel([]);
    expect(metrics).toHaveLength(7);
  });

  it("各ステージが含まれている", () => {
    const metrics = analyzeConversionFunnel([]);
    const stages = metrics.map((m) => m.stage);
    expect(stages).toContain("inquiry");
    expect(stages).toContain("first_reply");
    expect(stages).toContain("proposal");
    expect(stages).toContain("won");
  });

  it("won ステージの conversionRateToNext = 100", () => {
    const metrics = analyzeConversionFunnel([]);
    const wonMetrics = metrics.find((m) => m.stage === "won");
    expect(wonMetrics?.conversionRateToNext).toBe(100);
  });

  it("現在のステージの deal をカウントする", () => {
    const deals = [
      makeDeal("d-001", { currentStage: "inquiry" }),
      makeDeal("d-002", { currentStage: "inquiry" }),
      makeDeal("d-003", { currentStage: "proposal" }),
    ];
    const metrics = analyzeConversionFunnel(deals);
    const inquiryMetrics = metrics.find((m) => m.stage === "inquiry");
    expect(inquiryMetrics?.dealCount).toBe(2);
    const proposalMetrics = metrics.find((m) => m.stage === "proposal");
    expect(proposalMetrics?.dealCount).toBe(1);
  });

  it("totalAmountJpy を合計する", () => {
    const deals = [
      makeDeal("d-001", { currentStage: "proposal", expectedAmountJpy: 2_000_000 }),
      makeDeal("d-002", { currentStage: "proposal", expectedAmountJpy: 3_000_000 }),
    ];
    const metrics = analyzeConversionFunnel(deals);
    const proposalMetrics = metrics.find((m) => m.stage === "proposal");
    expect(proposalMetrics?.totalAmountJpy).toBe(5_000_000);
  });

  it("遷移ログから変換率を計算する", () => {
    // inquiry → first_reply に2件、inquiry → lost に1件遷移
    const deal1 = makeDeal("d-001", {
      currentStage: "first_reply",
      stageHistory: [makeTransition("inquiry", "first_reply")],
    });
    const deal2 = makeDeal("d-002", {
      currentStage: "first_reply",
      stageHistory: [makeTransition("inquiry", "first_reply")],
    });
    const deal3 = makeDeal("d-003", {
      currentStage: "lost",
      stageHistory: [makeTransition("inquiry", "lost")],
    });
    const metrics = analyzeConversionFunnel([deal1, deal2, deal3]);
    const inquiryMetrics = metrics.find((m) => m.stage === "inquiry");
    // 2/3 = 67%
    expect(inquiryMetrics?.conversionRateToNext).toBe(67);
  });

  it("avgDaysInStage を計算する", () => {
    const deal = makeDeal("d-001", {
      currentStage: "first_reply",
      stageHistory: [{
        fromStage: "inquiry",
        toStage: "first_reply",
        transitionedAt: new Date().toISOString(),
        daysInPreviousStage: 4,
      }],
    });
    const metrics = analyzeConversionFunnel([deal]);
    const inquiryMetrics = metrics.find((m) => m.stage === "inquiry");
    expect(inquiryMetrics?.avgDaysInStage).toBeGreaterThanOrEqual(0);
  });
});
