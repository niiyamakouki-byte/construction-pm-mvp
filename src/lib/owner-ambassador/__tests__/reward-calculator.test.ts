/**
 * reward-calculator.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { calculateReward, _resetRewardCounter } from "../reward-calculator.js";
import { makeOwnerAmbassadorId, makeReferralInquiryId } from "../types.js";

const AMB_ID = makeOwnerAmbassadorId("amb-001");
const INQ_ID = makeReferralInquiryId("ri-001");
const NOW = new Date("2026-05-09T10:00:00.000Z");

beforeEach(() => {
  _resetRewardCounter();
});

describe("calculateReward — tier別報酬率", () => {
  it("bronze: ¥1,000万 × 1% = ¥100,000", () => {
    const reward = calculateReward(AMB_ID, INQ_ID, 10_000_000, "bronze", "cash", NOW);
    expect(reward.amountJpy).toBe(100_000);
    expect(reward.rewardRate).toBe(0.01);
  });

  it("silver: ¥1,000万 × 2% = ¥200,000", () => {
    const reward = calculateReward(AMB_ID, INQ_ID, 10_000_000, "silver", "cash", NOW);
    expect(reward.amountJpy).toBe(200_000);
    expect(reward.rewardRate).toBe(0.02);
  });

  it("gold: ¥1,000万 × 3% = ¥300,000", () => {
    const reward = calculateReward(AMB_ID, INQ_ID, 10_000_000, "gold", "cash", NOW);
    expect(reward.amountJpy).toBe(300_000);
    expect(reward.rewardRate).toBe(0.03);
  });

  it("platinum: ¥1,000万 × 5% = ¥500,000", () => {
    const reward = calculateReward(AMB_ID, INQ_ID, 10_000_000, "platinum", "cash", NOW);
    expect(reward.amountJpy).toBe(500_000);
    expect(reward.rewardRate).toBe(0.05);
  });
});

describe("calculateReward — 上限¥500,000", () => {
  it("platinum: ¥2,000万 × 5% = ¥1,000,000 → 上限 ¥500,000 に切り詰め", () => {
    const reward = calculateReward(AMB_ID, INQ_ID, 20_000_000, "platinum", "cash", NOW);
    expect(reward.amountJpy).toBe(500_000);
  });

  it("gold: ¥2,000万 × 3% = ¥600,000 → 上限 ¥500,000 に切り詰め", () => {
    const reward = calculateReward(AMB_ID, INQ_ID, 20_000_000, "gold", "cash", NOW);
    expect(reward.amountJpy).toBe(500_000);
  });
});

describe("calculateReward — 税務処理メモ", () => {
  it("¥200,000以下は源泉徴収対象外", () => {
    const reward = calculateReward(AMB_ID, INQ_ID, 5_000_000, "bronze", "cash", NOW);
    // bronze: ¥5,000,000 × 1% = ¥50,000
    expect(reward.taxNoteJa).toContain("源泉徴収対象外");
    expect(reward.taxNoteJa).not.toContain("源泉徴収(10.21%)");
  });

  it("¥200,000超は源泉徴収対象", () => {
    // silver: ¥11,000,000 × 2% = ¥220,000
    const reward = calculateReward(AMB_ID, INQ_ID, 11_000_000, "silver", "cash", NOW);
    expect(reward.taxNoteJa).toContain("源泉徴収(10.21%)");
  });

  it("上限適用時にメモに上限の記載がある", () => {
    const reward = calculateReward(AMB_ID, INQ_ID, 20_000_000, "platinum", "cash", NOW);
    expect(reward.taxNoteJa).toContain("上限");
  });
});

describe("calculateReward — メタデータ", () => {
  it("kind が reward に反映される", () => {
    const reward = calculateReward(AMB_ID, INQ_ID, 5_000_000, "silver", "giftcard", NOW);
    expect(reward.kind).toBe("giftcard");
  });

  it("isPaid は初期値 false", () => {
    const reward = calculateReward(AMB_ID, INQ_ID, 5_000_000, "silver", "cash", NOW);
    expect(reward.isPaid).toBe(false);
  });

  it("calculatedAt が now と一致する", () => {
    const reward = calculateReward(AMB_ID, INQ_ID, 5_000_000, "bronze", "cash", NOW);
    expect(reward.calculatedAt).toBe(NOW.toISOString());
  });
});
