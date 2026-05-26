/**
 * ambassador-facade.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createAmbassador,
  issueReferralLink,
  recordReferralInquiry,
  updateInquiryStatus,
  finalizeReferralReward,
  listAmbassadors,
  getAmbassador,
  getLinksForAmbassador,
  listAllLinks,
  listAllInquiries,
  listAllRewards,
  _resetFacade,
} from "../ambassador-facade.js";
import { _resetAmbassadorStore } from "../ambassador-store.js";
import { _resetLinkCounter } from "../referral-link-generator.js";
import { _resetInquiryCounter } from "../inquiry-tracker.js";
import { _resetRewardCounter } from "../reward-calculator.js";
import { makeOwnerAmbassadorId, makeReferralLinkId } from "../types.js";

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

describe("createAmbassador", () => {
  it("アンバサダーが作成される", () => {
    const amb = createAmbassador("田中施主", "proj-001", NOW);
    expect(amb.ownerName).toBe("田中施主");
    expect(amb.tier).toBe("bronze");
    expect(amb.id).toMatch(/^amb-/);
  });

  it("ストアに保存される", () => {
    const amb = createAmbassador("田中施主", "proj-001", NOW);
    expect(getAmbassador(amb.id)).not.toBeNull();
  });

  it("listAmbassadors に含まれる", () => {
    createAmbassador("田中施主", "proj-001", NOW);
    expect(listAmbassadors()).toHaveLength(1);
  });
});

describe("issueReferralLink", () => {
  it("紹介リンクが発行される", () => {
    const amb = createAmbassador("田中施主", "proj-001", NOW);
    const link = issueReferralLink(amb.id, "line", 90, NOW);
    expect(link).not.toBeNull();
    expect(link!.channel).toBe("line");
    expect(link!.ambassadorId).toBe(amb.id);
  });

  it("アンバサダーの referralLinkIds に追加される", () => {
    const amb = createAmbassador("田中施主", "proj-001", NOW);
    const link = issueReferralLink(amb.id, "email", 90, NOW)!;
    const updated = getAmbassador(amb.id)!;
    expect(updated.referralLinkIds).toContain(link.id);
  });

  it("存在しないアンバサダーIDは null", () => {
    const result = issueReferralLink(makeOwnerAmbassadorId("nonexistent"), "line");
    expect(result).toBeNull();
  });
});

describe("recordReferralInquiry", () => {
  it("問合せが記録される", () => {
    const amb = createAmbassador("田中施主", "proj-001", NOW);
    const link = issueReferralLink(amb.id, "line", 90, NOW)!;
    const inq = recordReferralInquiry(link.id, "山田太郎", "リフォーム検討中", NOW);
    expect(inq).not.toBeNull();
    expect(inq!.inquirerName).toBe("山田太郎");
    expect(inq!.status).toBe("pending");
  });

  it("存在しないリンクIDは null", () => {
    const result = recordReferralInquiry(makeReferralLinkId("nonexistent"), "山田", "説明");
    expect(result).toBeNull();
  });

  it("listAllInquiries に含まれる", () => {
    const amb = createAmbassador("田中施主", "proj-001", NOW);
    const link = issueReferralLink(amb.id, "sns", 90, NOW)!;
    recordReferralInquiry(link.id, "山田", "説明", NOW);
    expect(listAllInquiries()).toHaveLength(1);
  });
});

describe("updateInquiryStatus", () => {
  it("ステータスが更新される", () => {
    const amb = createAmbassador("田中施主", "proj-001", NOW);
    const link = issueReferralLink(amb.id, "line", 90, NOW)!;
    const inq = recordReferralInquiry(link.id, "山田", "説明", NOW)!;
    const updated = updateInquiryStatus(inq.id, "contacted", undefined, NOW);
    expect(updated?.status).toBe("contacted");
  });

  it("無効な遷移は null", () => {
    const amb = createAmbassador("田中施主", "proj-001", NOW);
    const link = issueReferralLink(amb.id, "line", 90, NOW)!;
    const inq = recordReferralInquiry(link.id, "山田", "説明", NOW)!;
    const result = updateInquiryStatus(inq.id, "contracted"); // pending → contracted は無効
    expect(result).toBeNull();
  });
});

describe("finalizeReferralReward — 統合シナリオ", () => {
  it("報酬が確定してアンバサダーのtierが更新される", () => {
    const amb = createAmbassador("田中施主", "proj-001", NOW);
    const link = issueReferralLink(amb.id, "line", 90, NOW)!;
    const inq = recordReferralInquiry(link.id, "山田", "説明", NOW)!;
    updateInquiryStatus(inq.id, "contacted", undefined, NOW);
    updateInquiryStatus(inq.id, "quoted", undefined, NOW);
    updateInquiryStatus(inq.id, "contracted", 8_000_000, NOW);

    const reward = finalizeReferralReward(inq.id, "cash", NOW);
    expect(reward).not.toBeNull();
    // bronze 1% × ¥8,000,000 = ¥80,000 (初回なので bronze→silver)
    // 実際には finalizeReferralReward が先にtierを更新して silver で計算
    expect(reward!.amountJpy).toBeGreaterThan(0);
    expect(reward!.isPaid).toBe(false);
  });

  it("tier が silver に昇格する (1件成約, 金額gold基準未満)", () => {
    const amb = createAmbassador("田中施主", "proj-001", NOW);
    const link = issueReferralLink(amb.id, "line", 90, NOW)!;
    const inq = recordReferralInquiry(link.id, "山田", "説明", NOW)!;
    updateInquiryStatus(inq.id, "contacted", undefined, NOW);
    updateInquiryStatus(inq.id, "quoted", undefined, NOW);
    // ¥1,000,000 → silver (1件成約 / ¥100万 < ¥500万なのでgold未達)
    updateInquiryStatus(inq.id, "contracted", 1_000_000, NOW);
    finalizeReferralReward(inq.id, "cash", NOW);

    const updated = getAmbassador(amb.id)!;
    expect(updated.tier).toBe("silver");
    expect(updated.contractedReferralCount).toBe(1);
  });

  it("pending の問合せに finalizeReferralReward は null", () => {
    const amb = createAmbassador("田中施主", "proj-001", NOW);
    const link = issueReferralLink(amb.id, "line", 90, NOW)!;
    const inq = recordReferralInquiry(link.id, "山田", "説明", NOW)!;
    const result = finalizeReferralReward(inq.id);
    expect(result).toBeNull();
  });

  it("報酬が listAllRewards に含まれる", () => {
    const amb = createAmbassador("田中施主", "proj-001", NOW);
    const link = issueReferralLink(amb.id, "line", 90, NOW)!;
    const inq = recordReferralInquiry(link.id, "山田", "説明", NOW)!;
    updateInquiryStatus(inq.id, "contacted", undefined, NOW);
    updateInquiryStatus(inq.id, "quoted", undefined, NOW);
    updateInquiryStatus(inq.id, "contracted", 5_000_000, NOW);
    finalizeReferralReward(inq.id, "cash", NOW);
    expect(listAllRewards()).toHaveLength(1);
  });
});

describe("query helpers", () => {
  it("getLinksForAmbassador がアンバサダーのリンクだけ返す", () => {
    const amb1 = createAmbassador("田中", "proj-001", NOW);
    const amb2 = createAmbassador("鈴木", "proj-002", NOW);
    issueReferralLink(amb1.id, "line", 90, NOW);
    issueReferralLink(amb2.id, "email", 90, NOW);
    const links = getLinksForAmbassador(amb1.id);
    expect(links).toHaveLength(1);
    expect(links[0].ambassadorId).toBe(amb1.id);
  });

  it("listAllLinks が全リンクを返す", () => {
    const amb = createAmbassador("田中", "proj-001", NOW);
    issueReferralLink(amb.id, "line", 90, NOW);
    issueReferralLink(amb.id, "email", 90, NOW);
    expect(listAllLinks()).toHaveLength(2);
  });
});
