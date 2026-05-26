/**
 * inquiry-tracker.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createInquiry,
  transitionStatus,
  isValidTransition,
  shouldExpire,
  applyExpiry,
  _resetInquiryCounter,
} from "../inquiry-tracker.js";
import { makeReferralLinkId, makeOwnerAmbassadorId } from "../types.js";

const LINK_ID = makeReferralLinkId("rl-001");
const AMB_ID = makeOwnerAmbassadorId("amb-001");
const NOW = new Date("2026-05-09T10:00:00.000Z");

beforeEach(() => {
  _resetInquiryCounter();
});

describe("createInquiry", () => {
  it("pending ステータスで作成される", () => {
    const inq = createInquiry(LINK_ID, AMB_ID, "山田太郎", "リフォームを検討中", NOW);
    expect(inq.status).toBe("pending");
    expect(inq.inquirerName).toBe("山田太郎");
    expect(inq.id).toMatch(/^ri-/);
  });

  it("createdAt / updatedAt が now と一致する", () => {
    const inq = createInquiry(LINK_ID, AMB_ID, "山田太郎", "説明", NOW);
    expect(inq.createdAt).toBe(NOW.toISOString());
    expect(inq.updatedAt).toBe(NOW.toISOString());
  });
});

describe("isValidTransition", () => {
  it("pending → contacted は有効", () => {
    expect(isValidTransition("pending", "contacted")).toBe(true);
  });

  it("pending → expired は有効", () => {
    expect(isValidTransition("pending", "expired")).toBe(true);
  });

  it("pending → contracted は無効", () => {
    expect(isValidTransition("pending", "contracted")).toBe(false);
  });

  it("contacted → quoted は有効", () => {
    expect(isValidTransition("contacted", "quoted")).toBe(true);
  });

  it("quoted → contracted は有効", () => {
    expect(isValidTransition("quoted", "contracted")).toBe(true);
  });

  it("contracted → completed は有効", () => {
    expect(isValidTransition("contracted", "completed")).toBe(true);
  });

  it("completed → pending は無効 (終端ステータス)", () => {
    expect(isValidTransition("completed", "pending")).toBe(false);
  });

  it("expired → contacted は無効 (終端ステータス)", () => {
    expect(isValidTransition("expired", "contacted")).toBe(false);
  });
});

describe("transitionStatus", () => {
  it("有効な遷移でステータスが変わる", () => {
    const inq = createInquiry(LINK_ID, AMB_ID, "山田", "検討中", NOW);
    const updated = transitionStatus(inq, "contacted", undefined, NOW);
    expect(updated?.status).toBe("contacted");
  });

  it("無効な遷移は null を返す", () => {
    const inq = createInquiry(LINK_ID, AMB_ID, "山田", "検討中", NOW);
    const result = transitionStatus(inq, "contracted", undefined, NOW);
    expect(result).toBeNull();
  });

  it("contracted 遷移時に contractAmountJpy が設定される", () => {
    const inq = createInquiry(LINK_ID, AMB_ID, "山田", "検討中", NOW);
    const c = transitionStatus(inq, "contacted", undefined, NOW)!;
    const q = transitionStatus(c, "quoted", undefined, NOW)!;
    const contracted = transitionStatus(q, "contracted", 8_000_000, NOW);
    expect(contracted?.contractAmountJpy).toBe(8_000_000);
  });

  it("updatedAt が更新される", () => {
    const inq = createInquiry(LINK_ID, AMB_ID, "山田", "検討中", NOW);
    const laterDate = new Date("2026-06-01T00:00:00.000Z");
    const updated = transitionStatus(inq, "contacted", undefined, laterDate);
    expect(updated?.updatedAt).toBe(laterDate.toISOString());
  });
});

describe("shouldExpire / applyExpiry", () => {
  it("180日経過していない場合は shouldExpire = false", () => {
    const inq = createInquiry(LINK_ID, AMB_ID, "山田", "検討中", NOW);
    const check = new Date(NOW.getTime() + 179 * 24 * 60 * 60 * 1000);
    expect(shouldExpire(inq, check)).toBe(false);
  });

  it("180日経過した場合は shouldExpire = true", () => {
    const inq = createInquiry(LINK_ID, AMB_ID, "山田", "検討中", NOW);
    const check = new Date(NOW.getTime() + 180 * 24 * 60 * 60 * 1000);
    expect(shouldExpire(inq, check)).toBe(true);
  });

  it("completed ステータスは shouldExpire = false", () => {
    const inq = createInquiry(LINK_ID, AMB_ID, "山田", "検討中", NOW);
    const c = transitionStatus(inq, "contacted", undefined, NOW)!;
    const q = transitionStatus(c, "quoted", undefined, NOW)!;
    const contracted = transitionStatus(q, "contracted", 5_000_000, NOW)!;
    const completed = transitionStatus(contracted, "completed", undefined, NOW)!;
    const check = new Date(NOW.getTime() + 365 * 24 * 60 * 60 * 1000);
    expect(shouldExpire(completed, check)).toBe(false);
  });

  it("applyExpiry が expired に変更する", () => {
    const inq = createInquiry(LINK_ID, AMB_ID, "山田", "検討中", NOW);
    const check = new Date(NOW.getTime() + 180 * 24 * 60 * 60 * 1000);
    const result = applyExpiry(inq, check);
    expect(result.status).toBe("expired");
  });

  it("期限未到達なら applyExpiry は元のオブジェクトを返す", () => {
    const inq = createInquiry(LINK_ID, AMB_ID, "山田", "検討中", NOW);
    const check = new Date(NOW.getTime() + 1 * 24 * 60 * 60 * 1000);
    const result = applyExpiry(inq, check);
    expect(result).toBe(inq); // same reference
  });
});
