/**
 * types unit tests — makeChangeOrderId, label constants.
 */

import { describe, it, expect } from "vitest";
import {
  makeChangeOrderId,
  CHANGE_ORDER_KIND_LABELS,
  CHANGE_ORDER_STATUS_LABELS,
  APPROVAL_ROLE_LABELS,
} from "../types.js";

describe("makeChangeOrderId", () => {
  it("文字列をChangeOrderId型に変換する", () => {
    const id = makeChangeOrderId("co-123");
    expect(id).toBe("co-123");
  });

  it("空文字でも変換できる", () => {
    const id = makeChangeOrderId("");
    expect(id).toBe("");
  });
});

describe("CHANGE_ORDER_KIND_LABELS", () => {
  it("全てのChangeOrderKindにラベルが定義されている", () => {
    expect(CHANGE_ORDER_KIND_LABELS.addition).toBe("追加工事");
    expect(CHANGE_ORDER_KIND_LABELS.modification).toBe("仕様変更");
    expect(CHANGE_ORDER_KIND_LABELS.deletion).toBe("削除・省略");
    expect(CHANGE_ORDER_KIND_LABELS.materialUpgrade).toBe("材料グレードアップ");
    expect(CHANGE_ORDER_KIND_LABELS.scheduleShift).toBe("工程変更");
  });
});

describe("CHANGE_ORDER_STATUS_LABELS", () => {
  it("全てのChangeOrderStatusにラベルが定義されている", () => {
    expect(CHANGE_ORDER_STATUS_LABELS.requested).toBe("要望受付");
    expect(CHANGE_ORDER_STATUS_LABELS.estimating).toBe("見積中");
    expect(CHANGE_ORDER_STATUS_LABELS.ownerApproval).toBe("施主承認待ち");
    expect(CHANGE_ORDER_STATUS_LABELS.supervisorApproval).toBe("監督承認待ち");
    expect(CHANGE_ORDER_STATUS_LABELS.executiveApproval).toBe("社長承認待ち");
    expect(CHANGE_ORDER_STATUS_LABELS.approved).toBe("承認済");
    expect(CHANGE_ORDER_STATUS_LABELS.rejected).toBe("却下");
  });
});

describe("APPROVAL_ROLE_LABELS", () => {
  it("全てのロールにラベルが定義されている", () => {
    expect(APPROVAL_ROLE_LABELS.owner).toBe("施主");
    expect(APPROVAL_ROLE_LABELS.supervisor).toBe("監督");
    expect(APPROVAL_ROLE_LABELS.executive).toBe("社長");
  });
});
