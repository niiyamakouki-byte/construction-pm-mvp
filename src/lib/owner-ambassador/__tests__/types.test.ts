/**
 * types.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  makeOwnerAmbassadorId,
  makeReferralLinkId,
  makeReferralInquiryId,
  makeReferralRewardId,
  AMBASSADOR_TIER_LABELS,
  REFERRAL_STATUS_LABELS,
  REWARD_KIND_LABELS,
  REFERRAL_CHANNEL_LABELS,
  TIER_CONFIGS,
} from "../types.js";

describe("branded IDs", () => {
  it("makeOwnerAmbassadorId が文字列を返す", () => {
    const id = makeOwnerAmbassadorId("amb-001");
    expect(id).toBe("amb-001");
  });

  it("makeReferralLinkId が文字列を返す", () => {
    const id = makeReferralLinkId("rl-001");
    expect(id).toBe("rl-001");
  });

  it("makeReferralInquiryId が文字列を返す", () => {
    const id = makeReferralInquiryId("ri-001");
    expect(id).toBe("ri-001");
  });

  it("makeReferralRewardId が文字列を返す", () => {
    const id = makeReferralRewardId("rr-001");
    expect(id).toBe("rr-001");
  });
});

describe("AMBASSADOR_TIER_LABELS", () => {
  it("4tierすべてにラベルがある", () => {
    expect(AMBASSADOR_TIER_LABELS.bronze).toBe("ブロンズ");
    expect(AMBASSADOR_TIER_LABELS.silver).toBe("シルバー");
    expect(AMBASSADOR_TIER_LABELS.gold).toBe("ゴールド");
    expect(AMBASSADOR_TIER_LABELS.platinum).toBe("プラチナ");
  });
});

describe("REFERRAL_STATUS_LABELS", () => {
  it("6ステータスすべてにラベルがある", () => {
    const statuses = ["pending", "contacted", "quoted", "contracted", "completed", "expired"] as const;
    for (const s of statuses) {
      expect(REFERRAL_STATUS_LABELS[s]).toBeTruthy();
    }
  });
});

describe("REWARD_KIND_LABELS", () => {
  it("4種別すべてにラベルがある", () => {
    expect(REWARD_KIND_LABELS.cash).toBe("現金");
    expect(REWARD_KIND_LABELS.giftcard).toBe("ギフトカード");
    expect(REWARD_KIND_LABELS.maintenance_credit).toBeTruthy();
    expect(REWARD_KIND_LABELS.upgrade_credit).toBeTruthy();
  });
});

describe("REFERRAL_CHANNEL_LABELS", () => {
  it("5チャネルすべてにラベルがある", () => {
    const channels = ["line", "email", "sns", "qr_code", "direct_link"] as const;
    for (const ch of channels) {
      expect(REFERRAL_CHANNEL_LABELS[ch]).toBeTruthy();
    }
  });
});

describe("TIER_CONFIGS", () => {
  it("bronze の報酬率は 1%", () => {
    expect(TIER_CONFIGS.bronze.rewardRate).toBe(0.01);
  });

  it("silver の報酬率は 2%", () => {
    expect(TIER_CONFIGS.silver.rewardRate).toBe(0.02);
  });

  it("gold の報酬率は 3%", () => {
    expect(TIER_CONFIGS.gold.rewardRate).toBe(0.03);
  });

  it("platinum の報酬率は 5%", () => {
    expect(TIER_CONFIGS.platinum.rewardRate).toBe(0.05);
  });
});
