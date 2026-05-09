/**
 * types.test.ts — HandoverPackage 型定義のテスト
 */

import { describe, it, expect } from "vitest";
import {
  makeHandoverPackageId,
  DOCUMENT_KIND_LABELS,
  PACKAGE_STATUS_LABELS,
} from "../types.js";
import type {
  HandoverDocumentKind,
  HandoverPackageStatus,
} from "../types.js";

describe("makeHandoverPackageId", () => {
  it("文字列をブランド型に変換する", () => {
    const id = makeHandoverPackageId("hp-001");
    expect(id).toBe("hp-001");
  });

  it("異なる文字列は別のIDになる", () => {
    const a = makeHandoverPackageId("hp-001");
    const b = makeHandoverPackageId("hp-002");
    expect(a).not.toBe(b);
  });
});

describe("DOCUMENT_KIND_LABELS", () => {
  const kinds: HandoverDocumentKind[] = [
    "equipment_manual",
    "warranty_certificate",
    "maintenance_schedule",
    "aftercare_contact",
    "key_handover_record",
    "completion_inspection",
    "as_built_drawing",
  ];

  it("全7種別にラベルが定義されている", () => {
    expect(Object.keys(DOCUMENT_KIND_LABELS)).toHaveLength(7);
  });

  it.each(kinds)("%s のラベルが日本語で定義されている", (kind) => {
    expect(DOCUMENT_KIND_LABELS[kind]).toBeTruthy();
    expect(typeof DOCUMENT_KIND_LABELS[kind]).toBe("string");
  });

  it("equipment_manual ラベルが正しい", () => {
    expect(DOCUMENT_KIND_LABELS.equipment_manual).toBe("設備マニュアル");
  });

  it("warranty_certificate ラベルが正しい", () => {
    expect(DOCUMENT_KIND_LABELS.warranty_certificate).toBe("保証書");
  });

  it("key_handover_record ラベルが正しい", () => {
    expect(DOCUMENT_KIND_LABELS.key_handover_record).toBe("鍵引渡し記録");
  });
});

describe("PACKAGE_STATUS_LABELS", () => {
  const statuses: HandoverPackageStatus[] = [
    "draft",
    "documents_collected",
    "review",
    "delivered",
    "archived",
  ];

  it("全5ステータスにラベルが定義されている", () => {
    expect(Object.keys(PACKAGE_STATUS_LABELS)).toHaveLength(5);
  });

  it.each(statuses)("%s のラベルが日本語で定義されている", (status) => {
    expect(PACKAGE_STATUS_LABELS[status]).toBeTruthy();
    expect(typeof PACKAGE_STATUS_LABELS[status]).toBe("string");
  });

  it("draft ラベルが正しい", () => {
    expect(PACKAGE_STATUS_LABELS.draft).toBe("下書き");
  });

  it("delivered ラベルが正しい", () => {
    expect(PACKAGE_STATUS_LABELS.delivered).toBe("引渡し完了");
  });
});
