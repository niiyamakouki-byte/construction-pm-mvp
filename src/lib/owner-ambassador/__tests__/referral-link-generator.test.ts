/**
 * referral-link-generator.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  generateReferralLink,
  isLinkActive,
  incrementClickCount,
  _resetLinkCounter,
} from "../referral-link-generator.js";
import { makeOwnerAmbassadorId } from "../types.js";

const AMB_ID = makeOwnerAmbassadorId("amb-001");
const NOW = new Date("2026-05-09T10:00:00.000Z");

beforeEach(() => {
  _resetLinkCounter();
});

describe("generateReferralLink", () => {
  it("ReferralLink オブジェクトを返す", () => {
    const link = generateReferralLink(AMB_ID, "line", 90, NOW);
    expect(link.id).toMatch(/^rl-/);
    expect(link.ambassadorId).toBe(AMB_ID);
    expect(link.channel).toBe("line");
    expect(link.isActive).toBe(true);
    expect(link.clickCount).toBe(0);
  });

  it("URL に ambassadorId と channel が含まれる", () => {
    const link = generateReferralLink(AMB_ID, "email", 90, NOW);
    expect(link.url).toContain("amb-001");
    expect(link.url).toContain("email");
  });

  it("QRコード用テキストが URL と同じ", () => {
    const link = generateReferralLink(AMB_ID, "qr_code", 90, NOW);
    expect(link.qrText).toBe(link.url);
  });

  it("createdAt が now と一致する", () => {
    const link = generateReferralLink(AMB_ID, "sns", 90, NOW);
    expect(link.createdAt).toBe(NOW.toISOString());
  });

  it("expiresAt が expiryDays 後になる", () => {
    const link = generateReferralLink(AMB_ID, "direct_link", 30, NOW);
    const expected = new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(link.expiresAt).toBe(expected.toISOString());
  });

  it("expiryDays 省略時は 90日", () => {
    const link = generateReferralLink(AMB_ID, "line", undefined, NOW);
    const expected = new Date(NOW.getTime() + 90 * 24 * 60 * 60 * 1000);
    expect(link.expiresAt).toBe(expected.toISOString());
  });

  it("連続生成でIDが重複しない", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const link = generateReferralLink(AMB_ID, "line", 90, NOW);
      ids.add(link.id);
    }
    expect(ids.size).toBe(10);
  });
});

describe("isLinkActive", () => {
  it("有効期限内のリンクは true", () => {
    const link = generateReferralLink(AMB_ID, "line", 90, NOW);
    const checkDate = new Date(NOW.getTime() + 1 * 24 * 60 * 60 * 1000); // 1日後
    expect(isLinkActive(link, checkDate)).toBe(true);
  });

  it("有効期限切れのリンクは false", () => {
    const link = generateReferralLink(AMB_ID, "line", 1, NOW);
    const checkDate = new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000); // 2日後
    expect(isLinkActive(link, checkDate)).toBe(false);
  });

  it("isActive=false のリンクは false", () => {
    const link = { ...generateReferralLink(AMB_ID, "line", 90, NOW), isActive: false };
    expect(isLinkActive(link, NOW)).toBe(false);
  });
});

describe("incrementClickCount", () => {
  it("クリック数が1増える", () => {
    const link = generateReferralLink(AMB_ID, "line", 90, NOW);
    const updated = incrementClickCount(link);
    expect(updated.clickCount).toBe(1);
  });

  it("元のオブジェクトは変化しない (immutable)", () => {
    const link = generateReferralLink(AMB_ID, "line", 90, NOW);
    incrementClickCount(link);
    expect(link.clickCount).toBe(0);
  });
});
