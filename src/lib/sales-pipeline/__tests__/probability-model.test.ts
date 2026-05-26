/**
 * ProbabilityModel — unit tests.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_STAGE_PROBABILITY,
  recommendProbability,
  weightedAmount,
} from "../probability-model.js";
import type { Deal } from "../types.js";

function makeDeal(overrides: Partial<Deal> = {}): Deal {
  const now = new Date().toISOString();
  return {
    id: "d-001",
    customerName: "テスト顧客",
    currentStage: "inquiry",
    expectedAmountJpy: 1_000_000,
    probabilityPct: 5,
    expectedCloseDate: "2026-08-01",
    ownerName: "新山光輝",
    stageHistory: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("DEFAULT_STAGE_PROBABILITY", () => {
  it("inquiry = 5%", () => expect(DEFAULT_STAGE_PROBABILITY.inquiry).toBe(5));
  it("first_reply = 15%", () => expect(DEFAULT_STAGE_PROBABILITY.first_reply).toBe(15));
  it("site_survey = 30%", () => expect(DEFAULT_STAGE_PROBABILITY.site_survey).toBe(30));
  it("proposal = 50%", () => expect(DEFAULT_STAGE_PROBABILITY.proposal).toBe(50));
  it("contract = 80%", () => expect(DEFAULT_STAGE_PROBABILITY.contract).toBe(80));
  it("kickoff = 95%", () => expect(DEFAULT_STAGE_PROBABILITY.kickoff).toBe(95));
  it("won = 100%", () => expect(DEFAULT_STAGE_PROBABILITY.won).toBe(100));
  it("lost = 0%", () => expect(DEFAULT_STAGE_PROBABILITY.lost).toBe(0));
});

describe("recommendProbability", () => {
  it("won は常に 100%", () => {
    const deal = makeDeal({ currentStage: "won" });
    expect(recommendProbability(deal)).toBe(100);
  });

  it("lost は常に 0%", () => {
    const deal = makeDeal({ currentStage: "lost" });
    expect(recommendProbability(deal)).toBe(0);
  });

  it("滞留なしは base 確度を返す", () => {
    const deal = makeDeal({ currentStage: "proposal" });
    expect(recommendProbability(deal)).toBe(50);
  });

  it("proposal で14日以上滞留 → -10%", () => {
    // stageHistory に15日前の遷移を設定
    const transitionedAt = new Date();
    transitionedAt.setDate(transitionedAt.getDate() - 15);
    const deal = makeDeal({
      currentStage: "proposal",
      stageHistory: [{
        fromStage: "site_survey",
        toStage: "proposal",
        transitionedAt: transitionedAt.toISOString(),
        daysInPreviousStage: 7,
      }],
    });
    expect(recommendProbability(deal)).toBe(40); // 50 - 10
  });

  it("inquiry (ペナルティなし) は base を返す", () => {
    const deal = makeDeal({ currentStage: "inquiry" });
    expect(recommendProbability(deal)).toBe(5);
  });

  it("kickoff (ペナルティなし) は 95% を返す", () => {
    const deal = makeDeal({ currentStage: "kickoff" });
    expect(recommendProbability(deal)).toBe(95);
  });
});

describe("weightedAmount", () => {
  it("expectedAmountJpy × probabilityPct / 100", () => {
    const deal = makeDeal({ expectedAmountJpy: 10_000_000, probabilityPct: 50 });
    expect(weightedAmount(deal)).toBe(5_000_000);
  });

  it("won は 100% で全額", () => {
    const deal = makeDeal({
      currentStage: "won",
      expectedAmountJpy: 3_000_000,
      probabilityPct: 100,
    });
    expect(weightedAmount(deal)).toBe(3_000_000);
  });

  it("lost は 0%", () => {
    const deal = makeDeal({
      currentStage: "lost",
      expectedAmountJpy: 5_000_000,
      probabilityPct: 0,
    });
    expect(weightedAmount(deal)).toBe(0);
  });
});
