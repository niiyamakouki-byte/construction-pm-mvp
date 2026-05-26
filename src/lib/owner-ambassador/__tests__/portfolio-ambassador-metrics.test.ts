/**
 * portfolio-ambassador-metrics.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  totalActiveAmbassadors,
  pendingReferralInquiries,
  monthlyRewardPayoutJpy,
  mostProductiveAmbassadorName,
} from "../portfolio-ambassador-metrics.js";
import {
  createAmbassador,
  issueReferralLink,
  recordReferralInquiry,
  updateInquiryStatus,
  finalizeReferralReward,
  _resetFacade,
} from "../ambassador-facade.js";
import { _resetAmbassadorStore } from "../ambassador-store.js";
import { _resetLinkCounter } from "../referral-link-generator.js";
import { _resetInquiryCounter } from "../inquiry-tracker.js";
import { _resetRewardCounter } from "../reward-calculator.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

const NOW = new Date("2026-05-09T10:00:00.000Z");

beforeEach(() => {
  localStorage.clear();
  _resetAmbassadorStore();
  _resetFacade();
  _resetLinkCounter();
  _resetInquiryCounter();
  _resetRewardCounter();
});

describe("totalActiveAmbassadors", () => {
  it("アンバサダー0件のとき 0", () => {
    expect(totalActiveAmbassadors()).toBe(0);
  });

  it("3名登録で 3 を返す", () => {
    createAmbassador("田中", "proj-001", NOW);
    createAmbassador("鈴木", "proj-002", NOW);
    createAmbassador("山田", "proj-003", NOW);
    expect(totalActiveAmbassadors()).toBe(3);
  });
});

describe("pendingReferralInquiries", () => {
  it("問合せ0件のとき 0", () => {
    expect(pendingReferralInquiries()).toBe(0);
  });

  it("pending 問合せ数を返す", () => {
    const amb = createAmbassador("田中", "proj-001", NOW);
    const link = issueReferralLink(amb.id, "line", 90, NOW)!;
    recordReferralInquiry(link.id, "山田", "説明1", NOW);
    recordReferralInquiry(link.id, "鈴木", "説明2", NOW);
    expect(pendingReferralInquiries()).toBe(2);
  });
});

describe("monthlyRewardPayoutJpy", () => {
  it("報酬0件のとき 0", () => {
    expect(monthlyRewardPayoutJpy()).toBe(0);
  });

  it("未払い報酬合計を返す", () => {
    const amb = createAmbassador("田中", "proj-001", NOW);
    const link = issueReferralLink(amb.id, "line", 90, NOW)!;
    const inq = recordReferralInquiry(link.id, "山田", "説明", NOW)!;
    updateInquiryStatus(inq.id, "contacted", undefined, NOW);
    updateInquiryStatus(inq.id, "quoted", undefined, NOW);
    updateInquiryStatus(inq.id, "contracted", 10_000_000, NOW);
    finalizeReferralReward(inq.id, "cash", NOW);
    expect(monthlyRewardPayoutJpy()).toBeGreaterThan(0);
  });
});

describe("mostProductiveAmbassadorName", () => {
  it("アンバサダー0件のとき null", () => {
    expect(mostProductiveAmbassadorName()).toBeNull();
  });

  it("最も成約数が多いアンバサダーの名前を返す", () => {
    const amb1 = createAmbassador("田中", "proj-001", NOW);
    const amb2 = createAmbassador("鈴木", "proj-002", NOW);

    // amb2 に1件成約
    const link2 = issueReferralLink(amb2.id, "line", 90, NOW)!;
    const inq2 = recordReferralInquiry(link2.id, "山田", "説明", NOW)!;
    updateInquiryStatus(inq2.id, "contacted", undefined, NOW);
    updateInquiryStatus(inq2.id, "quoted", undefined, NOW);
    updateInquiryStatus(inq2.id, "contracted", 5_000_000, NOW);
    finalizeReferralReward(inq2.id, "cash", NOW);

    void amb1; // 0件成約
    expect(mostProductiveAmbassadorName()).toBe("鈴木");
  });
});
