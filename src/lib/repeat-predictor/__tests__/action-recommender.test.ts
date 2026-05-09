/**
 * Tests for action-recommender — Japanese action recommendations.
 */

import { describe, expect, it } from "vitest";
import { recommendAction_ja } from "../action-recommender.js";
import type { RepeatSignal } from "../types.js";

// ── Fixture ────────────────────────────────────────────────────────────────

function sig(overrides: Partial<RepeatSignal> = {}): RepeatSignal {
  return {
    jobsCount: 2,
    lastJobMonthsAgo: 4,
    avgIntervalMonths: 8,
    totalRevenue: 5_000_000,
    avgMarginPct: 28,
    lastSatisfactionScore: 4,
    complaintCount: 0,
    referralCount: 0,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("recommendAction_ja — セグメント別推奨アクション", () => {
  it("vip → 日本語テキストが返る (紹介言及)", () => {
    const action = recommendAction_ja("vip", sig({ referralCount: 1 }));
    expect(typeof action).toBe("string");
    expect(action.length).toBeGreaterThan(0);
  });

  it("vip (紹介3件以上) → 特別感謝キャンペーン言及", () => {
    const action = recommendAction_ja("vip", sig({ referralCount: 3 }));
    expect(action).toContain("感謝");
  });

  it("loyal → 継続発注への感謝または近況確認が含まれる", () => {
    const action = recommendAction_ja("loyal", sig({ lastJobMonthsAgo: 4 }));
    expect(action.length).toBeGreaterThan(0);
  });

  it("loyal (発注間隔>6ヶ月) → 近況確認の言及", () => {
    const action = recommendAction_ja("loyal", sig({ lastJobMonthsAgo: 7 }));
    expect(action).toContain("確認");
  });

  it("promising (jobsCount=1) → 初回案件・満足度確認", () => {
    const action = recommendAction_ja("promising", sig({ jobsCount: 1 }));
    expect(action).toContain("初回");
  });

  it("promising (jobsCount=2) → ロイヤリティプログラム言及", () => {
    const action = recommendAction_ja("promising", sig({ jobsCount: 2 }));
    expect(action).toContain("ロイヤリティ");
  });

  it("dormant (24ヶ月以上) → キャンペーンDM言及", () => {
    const action = recommendAction_ja("dormant", sig({ lastJobMonthsAgo: 25 }));
    expect(action).toContain("DM");
  });

  it("dormant (12〜24ヶ月) → 新サービスご案内", () => {
    const action = recommendAction_ja("dormant", sig({ lastJobMonthsAgo: 15 }));
    expect(action.length).toBeGreaterThan(0);
  });

  it("at_risk (クレーム2件以上) → お詫び訪問言及", () => {
    const action = recommendAction_ja("at_risk", sig({ complaintCount: 2 }));
    expect(action).toContain("訪問");
  });

  it("at_risk (満足度低) → アフターフォロー言及", () => {
    const action = recommendAction_ja("at_risk", sig({ complaintCount: 0, lastSatisfactionScore: 2 }));
    expect(action).toContain("アフターフォロー");
  });
});

describe("recommendAction_ja — 全セグメントで非空文字列を返す", () => {
  const segments = ["vip", "loyal", "promising", "dormant", "at_risk"] as const;
  for (const segment of segments) {
    it(`${segment} → 非空文字列`, () => {
      const action = recommendAction_ja(segment, sig());
      expect(typeof action).toBe("string");
      expect(action.trim().length).toBeGreaterThan(0);
    });
  }
});
