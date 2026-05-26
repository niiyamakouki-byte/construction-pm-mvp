/**
 * Tests for rfm-scorer — boundary values.
 */

import { describe, expect, it } from "vitest";
import {
  recencyScore,
  frequencyScore,
  monetaryScore,
  satisfactionScore,
  referralScore,
  computeAllScores,
} from "../rfm-scorer.js";
import type { RepeatSignal } from "../types.js";

// ── Fixture helpers ────────────────────────────────────────────────────────

function baseSignal(overrides: Partial<RepeatSignal> = {}): RepeatSignal {
  return {
    jobsCount: 1,
    lastJobMonthsAgo: 3,
    avgIntervalMonths: null,
    totalRevenue: 1000000,
    avgMarginPct: 25,
    lastSatisfactionScore: 4,
    complaintCount: 0,
    referralCount: 0,
    ...overrides,
  };
}

// ── recencyScore ──────────────────────────────────────────────────────────

describe("recencyScore — boundary values", () => {
  it("0ヶ月前 → 1.0", () => {
    expect(recencyScore(baseSignal({ lastJobMonthsAgo: 0 }))).toBe(1.0);
  });
  it("3ヶ月前 → 1.0 (境界)", () => {
    expect(recencyScore(baseSignal({ lastJobMonthsAgo: 3 }))).toBe(1.0);
  });
  it("3.1ヶ月前 → 0.8", () => {
    expect(recencyScore(baseSignal({ lastJobMonthsAgo: 3.1 }))).toBe(0.8);
  });
  it("6ヶ月前 → 0.8 (境界)", () => {
    expect(recencyScore(baseSignal({ lastJobMonthsAgo: 6 }))).toBe(0.8);
  });
  it("6.1ヶ月前 → 0.5", () => {
    expect(recencyScore(baseSignal({ lastJobMonthsAgo: 6.1 }))).toBe(0.5);
  });
  it("12ヶ月前 → 0.5 (境界)", () => {
    expect(recencyScore(baseSignal({ lastJobMonthsAgo: 12 }))).toBe(0.5);
  });
  it("12.1ヶ月前 → 0.2", () => {
    expect(recencyScore(baseSignal({ lastJobMonthsAgo: 12.1 }))).toBe(0.2);
  });
  it("24ヶ月前 → 0.2 (境界)", () => {
    expect(recencyScore(baseSignal({ lastJobMonthsAgo: 24 }))).toBe(0.2);
  });
  it("24.1ヶ月前 → 0.0", () => {
    expect(recencyScore(baseSignal({ lastJobMonthsAgo: 24.1 }))).toBe(0.0);
  });
  it("999ヶ月前 (案件なし) → 0.0", () => {
    expect(recencyScore(baseSignal({ lastJobMonthsAgo: 999 }))).toBe(0.0);
  });
});

// ── frequencyScore ────────────────────────────────────────────────────────

describe("frequencyScore — step values", () => {
  it("0件 → 0.0", () => {
    expect(frequencyScore(baseSignal({ jobsCount: 0 }))).toBe(0.0);
  });
  it("1件 → 0.1", () => {
    expect(frequencyScore(baseSignal({ jobsCount: 1 }))).toBe(0.1);
  });
  it("2件 → 0.3", () => {
    expect(frequencyScore(baseSignal({ jobsCount: 2 }))).toBe(0.3);
  });
  it("3件 → 0.5", () => {
    expect(frequencyScore(baseSignal({ jobsCount: 3 }))).toBe(0.5);
  });
  it("4件 → 0.7", () => {
    expect(frequencyScore(baseSignal({ jobsCount: 4 }))).toBe(0.7);
  });
  it("5件 → 0.85", () => {
    expect(frequencyScore(baseSignal({ jobsCount: 5 }))).toBe(0.85);
  });
  it("6件以上 → 1.0", () => {
    expect(frequencyScore(baseSignal({ jobsCount: 6 }))).toBe(1.0);
    expect(frequencyScore(baseSignal({ jobsCount: 100 }))).toBe(1.0);
  });
});

// ── monetaryScore ─────────────────────────────────────────────────────────

describe("monetaryScore — revenue tiers", () => {
  it("500K JPY → 0.1", () => {
    expect(monetaryScore(baseSignal({ totalRevenue: 500_000 }))).toBe(0.1);
  });
  it("1M JPY (境界) → 0.3", () => {
    expect(monetaryScore(baseSignal({ totalRevenue: 1_000_000 }))).toBe(0.3);
  });
  it("5M JPY (境界) → 0.5", () => {
    expect(monetaryScore(baseSignal({ totalRevenue: 5_000_000 }))).toBe(0.5);
  });
  it("10M JPY (境界) → 0.7", () => {
    expect(monetaryScore(baseSignal({ totalRevenue: 10_000_000 }))).toBe(0.7);
  });
  it("20M JPY (境界) → 0.9", () => {
    expect(monetaryScore(baseSignal({ totalRevenue: 20_000_000 }))).toBe(0.9);
  });
  it("30M JPY (境界) → 1.0", () => {
    expect(monetaryScore(baseSignal({ totalRevenue: 30_000_000 }))).toBe(1.0);
  });
  it("50M JPY → 1.0", () => {
    expect(monetaryScore(baseSignal({ totalRevenue: 50_000_000 }))).toBe(1.0);
  });
});

// ── satisfactionScore ─────────────────────────────────────────────────────

describe("satisfactionScore — score + complaint penalty", () => {
  it("満足度5/5、クレームなし → 1.0", () => {
    expect(satisfactionScore(baseSignal({ lastSatisfactionScore: 5, complaintCount: 0 }))).toBe(1.0);
  });
  it("満足度4/5 → 0.8", () => {
    expect(satisfactionScore(baseSignal({ lastSatisfactionScore: 4, complaintCount: 0 }))).toBe(0.8);
  });
  it("満足度3/5 → 0.6", () => {
    expect(satisfactionScore(baseSignal({ lastSatisfactionScore: 3, complaintCount: 0 }))).toBe(0.6);
  });
  it("満足度2/5 → 0.4", () => {
    expect(satisfactionScore(baseSignal({ lastSatisfactionScore: 2, complaintCount: 0 }))).toBe(0.4);
  });
  it("満足度1/5 → 0.2", () => {
    expect(satisfactionScore(baseSignal({ lastSatisfactionScore: 1, complaintCount: 0 }))).toBe(0.2);
  });
  it("満足度null → 0.5 (中立デフォルト)", () => {
    expect(satisfactionScore(baseSignal({ lastSatisfactionScore: null, complaintCount: 0 }))).toBe(0.5);
  });
  it("クレーム1件で -0.1 ペナルティ", () => {
    expect(satisfactionScore(baseSignal({ lastSatisfactionScore: 4, complaintCount: 1 }))).toBeCloseTo(0.7);
  });
  it("クレーム多数でフロアは0以上", () => {
    const score = satisfactionScore(baseSignal({ lastSatisfactionScore: 1, complaintCount: 10 }));
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

// ── referralScore ─────────────────────────────────────────────────────────

describe("referralScore — step values", () => {
  it("紹介0件 → 0.0", () => {
    expect(referralScore(baseSignal({ referralCount: 0 }))).toBe(0.0);
  });
  it("紹介1件 → 0.4", () => {
    expect(referralScore(baseSignal({ referralCount: 1 }))).toBe(0.4);
  });
  it("紹介2件 → 0.7", () => {
    expect(referralScore(baseSignal({ referralCount: 2 }))).toBe(0.7);
  });
  it("紹介3件以上 → 1.0", () => {
    expect(referralScore(baseSignal({ referralCount: 3 }))).toBe(1.0);
    expect(referralScore(baseSignal({ referralCount: 10 }))).toBe(1.0);
  });
});

// ── computeAllScores ──────────────────────────────────────────────────────

describe("computeAllScores", () => {
  it("全スコアが [0,1] の範囲内", () => {
    const s = computeAllScores(baseSignal({
      jobsCount: 4,
      lastJobMonthsAgo: 5,
      totalRevenue: 8_000_000,
      lastSatisfactionScore: 4,
      referralCount: 2,
    }));
    for (const val of Object.values(s)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });
});
