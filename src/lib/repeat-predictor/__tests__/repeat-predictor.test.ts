/**
 * Tests for repeat-predictor — probability synthesis and prediction output.
 */

import { describe, expect, it } from "vitest";
import { predictRepeat } from "../repeat-predictor.js";
import type { RepeatSignal, PredictionConfig } from "../types.js";
import { DEFAULT_PREDICTION_CONFIG } from "../types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

function sig(overrides: Partial<RepeatSignal> = {}): RepeatSignal {
  return {
    jobsCount: 3,
    lastJobMonthsAgo: 4,
    avgIntervalMonths: 6,
    totalRevenue: 10_000_000,
    avgMarginPct: 28,
    lastSatisfactionScore: 4,
    complaintCount: 0,
    referralCount: 1,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("predictRepeat — output shape", () => {
  it("全フィールドが正しく返る", () => {
    const pred = predictRepeat("c001", sig());
    expect(pred.customerId).toBe("c001");
    expect(pred.repeatProbability).toBeGreaterThanOrEqual(0);
    expect(pred.repeatProbability).toBeLessThanOrEqual(1);
    expect(pred.predictedNextOrderMonths).toBeGreaterThanOrEqual(1);
    expect(pred.confidenceLevel).toMatch(/^(low|med|high)$/);
    expect(pred.segment).toMatch(/^(vip|loyal|promising|dormant|at_risk)$/);
    expect(typeof pred.reasoning_ja).toBe("string");
    expect(pred.reasoning_ja.length).toBeGreaterThan(0);
    expect(typeof pred.recommendedAction_ja).toBe("string");
    expect(pred.recommendedAction_ja.length).toBeGreaterThan(0);
    expect(pred.scoreBreakdown).toBeDefined();
  });

  it("scoreBreakdown の全値が [0,1] の範囲", () => {
    const pred = predictRepeat("c001", sig());
    for (const val of Object.values(pred.scoreBreakdown)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });
});

describe("predictRepeat — probability ranges", () => {
  it("全ての条件が良好なら確率が高い (>0.7)", () => {
    const pred = predictRepeat(
      "c-vip",
      sig({
        jobsCount: 6,
        lastJobMonthsAgo: 1,
        totalRevenue: 35_000_000,
        lastSatisfactionScore: 5,
        referralCount: 3,
        complaintCount: 0,
      }),
    );
    expect(pred.repeatProbability).toBeGreaterThan(0.7);
  });

  it("休眠顧客・クレームありなら確率が低い (<0.35)", () => {
    const pred = predictRepeat(
      "c-bad",
      sig({
        jobsCount: 1,
        lastJobMonthsAgo: 30,
        totalRevenue: 500_000,
        lastSatisfactionScore: 1,
        referralCount: 0,
        complaintCount: 3,
      }),
    );
    expect(pred.repeatProbability).toBeLessThan(0.35);
  });

  it("確率は常に [0,1]", () => {
    const extremeSig: RepeatSignal = {
      jobsCount: 100,
      lastJobMonthsAgo: 0,
      avgIntervalMonths: 1,
      totalRevenue: 999_000_000,
      avgMarginPct: 50,
      lastSatisfactionScore: 5,
      complaintCount: 0,
      referralCount: 99,
    };
    const pred = predictRepeat("c-max", extremeSig);
    expect(pred.repeatProbability).toBeLessThanOrEqual(1);
    expect(pred.repeatProbability).toBeGreaterThanOrEqual(0);
  });
});

describe("predictRepeat — next order prediction", () => {
  it("avgInterval=6、3ヶ月前 → 次回は約3ヶ月後", () => {
    const pred = predictRepeat(
      "c001",
      sig({ avgIntervalMonths: 6, lastJobMonthsAgo: 3 }),
    );
    expect(pred.predictedNextOrderMonths).toBeGreaterThanOrEqual(1);
    expect(pred.predictedNextOrderMonths).toBeLessThanOrEqual(5);
  });

  it("単一案件 (avgIntervalMonths=null) の場合もフロア1以上", () => {
    const pred = predictRepeat(
      "c-single",
      sig({ jobsCount: 1, avgIntervalMonths: null, lastJobMonthsAgo: 2 }),
    );
    expect(pred.predictedNextOrderMonths).toBeGreaterThanOrEqual(1);
  });

  it("過去の発注間隔を超えていても最低1ヶ月後", () => {
    const pred = predictRepeat(
      "c-overdue",
      sig({ avgIntervalMonths: 6, lastJobMonthsAgo: 10 }),
    );
    expect(pred.predictedNextOrderMonths).toBe(1);
  });
});

describe("predictRepeat — confidence level", () => {
  it("案件1件のみ → low", () => {
    const pred = predictRepeat("c001", sig({ jobsCount: 1, lastSatisfactionScore: null }));
    expect(pred.confidenceLevel).toBe("low");
  });

  it("案件2件 → med", () => {
    const pred = predictRepeat("c001", sig({ jobsCount: 2, lastSatisfactionScore: null }));
    expect(pred.confidenceLevel).toBe("med");
  });

  it("案件3件以上 + 満足度あり → high", () => {
    const pred = predictRepeat("c001", sig({ jobsCount: 3, lastSatisfactionScore: 4 }));
    expect(pred.confidenceLevel).toBe("high");
  });
});

describe("predictRepeat — segment assignment", () => {
  it("クレーム多数 → at_risk", () => {
    const pred = predictRepeat(
      "c-risk",
      sig({ complaintCount: 2 }),
    );
    expect(pred.segment).toBe("at_risk");
  });

  it("超優良顧客 → vip", () => {
    const pred = predictRepeat(
      "c-vip",
      sig({
        jobsCount: 6,
        lastJobMonthsAgo: 2,
        totalRevenue: 35_000_000,
        referralCount: 3,
        complaintCount: 0,
        lastSatisfactionScore: 5,
      }),
    );
    expect(pred.segment).toBe("vip");
  });

  it("休眠顧客 → dormant", () => {
    const pred = predictRepeat(
      "c-dormant",
      sig({
        lastJobMonthsAgo: 18,
        jobsCount: 2,
        complaintCount: 0,
        totalRevenue: 3_000_000,
        referralCount: 0,
      }),
    );
    expect(pred.segment).toBe("dormant");
  });
});

describe("predictRepeat — custom config", () => {
  it("recency ウェイトを極端に大きくすると最近の顧客の確率が上がる", () => {
    const heavyRecencyConfig: PredictionConfig = {
      weights: {
        recency: 0.9,
        frequency: 0.025,
        monetary: 0.025,
        satisfaction: 0.025,
        referral: 0.025,
      },
    };

    const recentSig = sig({ lastJobMonthsAgo: 1 });
    const dormantSig = sig({ lastJobMonthsAgo: 30 });

    const recentPred = predictRepeat("c-recent", recentSig, heavyRecencyConfig);
    const dormantPred = predictRepeat("c-dormant", dormantSig, heavyRecencyConfig);

    expect(recentPred.repeatProbability).toBeGreaterThan(dormantPred.repeatProbability);
  });
});
