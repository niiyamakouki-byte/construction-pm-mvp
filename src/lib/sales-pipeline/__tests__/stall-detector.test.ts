/**
 * StallDetector — unit tests.
 */

import { describe, it, expect } from "vitest";
import { detectStalls, currentDwellDays, STANDARD_DWELL_DAYS } from "../stall-detector.js";
import type { Deal } from "../types.js";

function makeDeal(overrides: Partial<Deal> = {}): Deal {
  const now = new Date().toISOString();
  return {
    id: "d-001",
    customerName: "テスト顧客",
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

function makeDealCreatedDaysAgo(daysAgo: number, overrides: Partial<Deal> = {}): Deal {
  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - daysAgo);
  return makeDeal({ createdAt: createdAt.toISOString(), ...overrides });
}

describe("STANDARD_DWELL_DAYS", () => {
  it("inquiry = 1日", () => expect(STANDARD_DWELL_DAYS.inquiry).toBe(1));
  it("first_reply = 3日", () => expect(STANDARD_DWELL_DAYS.first_reply).toBe(3));
  it("site_survey = 7日", () => expect(STANDARD_DWELL_DAYS.site_survey).toBe(7));
  it("proposal = 14日", () => expect(STANDARD_DWELL_DAYS.proposal).toBe(14));
  it("contract = 7日", () => expect(STANDARD_DWELL_DAYS.contract).toBe(7));
  it("kickoff = 3日", () => expect(STANDARD_DWELL_DAYS.kickoff).toBe(3));
});

describe("currentDwellDays", () => {
  it("createdAt から経過日数を返す", () => {
    const deal = makeDealCreatedDaysAgo(5);
    expect(currentDwellDays(deal)).toBe(5);
  });

  it("stageHistory がある場合は最後の遷移日時から計算する", () => {
    const transitionedAt = new Date();
    transitionedAt.setDate(transitionedAt.getDate() - 3);
    const deal = makeDeal({
      stageHistory: [{
        fromStage: "inquiry",
        toStage: "first_reply",
        transitionedAt: transitionedAt.toISOString(),
        daysInPreviousStage: 2,
      }],
    });
    expect(currentDwellDays(deal)).toBe(3);
  });
});

describe("detectStalls", () => {
  it("アクティブでない deal はスキップする", () => {
    const won = makeDeal({ currentStage: "won" });
    const lost = makeDeal({ id: "d-002", currentStage: "lost" });
    expect(detectStalls([won, lost])).toHaveLength(0);
  });

  it("標準日数超過 → warn アラート", () => {
    // first_reply 標準3日, 4日経過 → warn (2倍=6日未満)
    const deal = makeDealCreatedDaysAgo(4, { currentStage: "first_reply" });
    const alerts = detectStalls([deal]);
    const stallAlert = alerts.find((a) => a.alertType === "stalled");
    expect(stallAlert).toBeDefined();
    expect(stallAlert?.severity).toBe("warn");
  });

  it("標準日数の2倍超過 → critical アラート", () => {
    // first_reply 標準3日, 7日経過 → critical (2倍=6日超)
    const deal = makeDealCreatedDaysAgo(7, { currentStage: "first_reply" });
    const alerts = detectStalls([deal]);
    const stallAlert = alerts.find((a) => a.alertType === "stalled");
    expect(stallAlert?.severity).toBe("critical");
  });

  it("クローズ日7日以内 + contract未到達 → critical near_due_no_action", () => {
    const closeDate = new Date();
    closeDate.setDate(closeDate.getDate() + 3);
    const deal = makeDeal({
      currentStage: "proposal",
      expectedCloseDate: closeDate.toISOString().split("T")[0],
    });
    const alerts = detectStalls([deal]);
    const dueAlert = alerts.find((a) => a.alertType === "near_due_no_action");
    expect(dueAlert).toBeDefined();
    expect(dueAlert?.severity).toBe("critical");
  });

  it("1000万以上 + 確度20%以下 → warn low_probability_high_amount", () => {
    const deal = makeDeal({
      currentStage: "proposal",
      expectedAmountJpy: 15_000_000,
      probabilityPct: 15,
    });
    const alerts = detectStalls([deal]);
    const lowProbAlert = alerts.find((a) => a.alertType === "low_probability_high_amount");
    expect(lowProbAlert).toBeDefined();
    expect(lowProbAlert?.severity).toBe("warn");
  });

  it("999万円 + 確度20%以下 → アラートなし (低確度高額ルール対象外)", () => {
    const deal = makeDeal({
      currentStage: "proposal",
      expectedAmountJpy: 9_990_000,
      probabilityPct: 10,
    });
    const alerts = detectStalls([deal]);
    const lowProbAlert = alerts.find((a) => a.alertType === "low_probability_high_amount");
    expect(lowProbAlert).toBeUndefined();
  });

  it("クローズ日10日先 → near_due_no_action なし", () => {
    const closeDate = new Date();
    closeDate.setDate(closeDate.getDate() + 10);
    const deal = makeDeal({
      currentStage: "proposal",
      expectedCloseDate: closeDate.toISOString().split("T")[0],
    });
    const alerts = detectStalls([deal]);
    const dueAlert = alerts.find((a) => a.alertType === "near_due_no_action");
    expect(dueAlert).toBeUndefined();
  });

  it("contract ステージはクローズ日チェック対象外", () => {
    const closeDate = new Date();
    closeDate.setDate(closeDate.getDate() + 3);
    const deal = makeDeal({
      currentStage: "contract",
      expectedCloseDate: closeDate.toISOString().split("T")[0],
    });
    const alerts = detectStalls([deal]);
    const dueAlert = alerts.find((a) => a.alertType === "near_due_no_action");
    expect(dueAlert).toBeUndefined();
  });
});
