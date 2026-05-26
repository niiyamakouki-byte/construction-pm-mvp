/**
 * warranty-tracker unit tests.
 */

import { describe, it, expect } from "vitest";
import {
  warrantyDocuments,
  getExpiringSoon,
  getExpired,
  daysUntilExpiry,
  sortByExpiry,
  isWarrantyActive,
} from "../warranty-tracker.js";
import type { HandoverDocument } from "../types.js";

function makeDoc(overrides: Partial<HandoverDocument> = {}): HandoverDocument {
  return {
    id: "doc-1",
    kind: "warranty_certificate",
    titleJa: "エアコン保証書",
    ...overrides,
  };
}

describe("warrantyDocuments", () => {
  it("expiresAt のあるドキュメントのみを返す", () => {
    const docs = [
      makeDoc({ id: "d1", expiresAt: "2026-01-01T00:00:00.000Z" }),
      makeDoc({ id: "d2" }), // no expiresAt
      makeDoc({ id: "d3", expiresAt: "2027-01-01T00:00:00.000Z" }),
    ];
    const result = warrantyDocuments(docs);
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.id)).toEqual(["d1", "d3"]);
  });

  it("expiresAt が全くない場合は空配列を返す", () => {
    const docs = [makeDoc({ id: "d1" }), makeDoc({ id: "d2" })];
    expect(warrantyDocuments(docs)).toHaveLength(0);
  });
});

describe("getExpiringSoon", () => {
  it("30日以内に失効するドキュメントを返す", () => {
    const asOf = new Date("2025-01-01T00:00:00.000Z");
    const docs = [
      makeDoc({ id: "d1", expiresAt: "2025-01-15T00:00:00.000Z" }), // 14 days → within 30
      makeDoc({ id: "d2", expiresAt: "2025-02-10T00:00:00.000Z" }), // 40 days → outside 30
      makeDoc({ id: "d3", expiresAt: "2024-12-01T00:00:00.000Z" }), // already expired
    ];
    const result = getExpiringSoon(docs, 30, asOf);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("d1");
  });

  it("expiresAt がないドキュメントは除外される", () => {
    const asOf = new Date("2025-01-01T00:00:00.000Z");
    const docs = [makeDoc({ id: "d1" })];
    expect(getExpiringSoon(docs, 30, asOf)).toHaveLength(0);
  });

  it("失効当日は含まれない (既失効)", () => {
    const asOf = new Date("2025-01-01T00:00:00.000Z");
    const docs = [makeDoc({ id: "d1", expiresAt: "2025-01-01T00:00:00.000Z" })];
    expect(getExpiringSoon(docs, 30, asOf)).toHaveLength(0);
  });
});

describe("getExpired", () => {
  it("失効済みのドキュメントを返す", () => {
    const asOf = new Date("2025-06-01T00:00:00.000Z");
    const docs = [
      makeDoc({ id: "d1", expiresAt: "2025-01-01T00:00:00.000Z" }), // expired
      makeDoc({ id: "d2", expiresAt: "2026-01-01T00:00:00.000Z" }), // still valid
    ];
    const result = getExpired(docs, asOf);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("d1");
  });

  it("expiresAt が asOf と同じ日は失効済みとして返す", () => {
    const asOf = new Date("2025-01-01T00:00:00.000Z");
    const docs = [makeDoc({ id: "d1", expiresAt: "2025-01-01T00:00:00.000Z" })];
    expect(getExpired(docs, asOf)).toHaveLength(1);
  });
});

describe("daysUntilExpiry", () => {
  it("有効期限まで残り日数を正しく返す", () => {
    const asOf = new Date("2025-01-01T00:00:00.000Z");
    const doc = makeDoc({ expiresAt: "2025-01-31T00:00:00.000Z" });
    expect(daysUntilExpiry(doc, asOf)).toBe(30);
  });

  it("失効済みは負の値を返す", () => {
    const asOf = new Date("2025-02-01T00:00:00.000Z");
    const doc = makeDoc({ expiresAt: "2025-01-01T00:00:00.000Z" });
    expect(daysUntilExpiry(doc, asOf)).toBeLessThan(0);
  });

  it("expiresAt がない場合は null を返す", () => {
    const doc = makeDoc();
    expect(daysUntilExpiry(doc)).toBeNull();
  });
});

describe("sortByExpiry", () => {
  it("有効期限の早い順に並べ替える", () => {
    const docs = [
      makeDoc({ id: "d1", expiresAt: "2027-01-01T00:00:00.000Z" }),
      makeDoc({ id: "d2", expiresAt: "2025-06-01T00:00:00.000Z" }),
      makeDoc({ id: "d3", expiresAt: "2026-01-01T00:00:00.000Z" }),
    ];
    const sorted = sortByExpiry(docs);
    expect(sorted[0].id).toBe("d2");
    expect(sorted[1].id).toBe("d3");
    expect(sorted[2].id).toBe("d1");
  });

  it("expiresAt がないドキュメントは除外される", () => {
    const docs = [
      makeDoc({ id: "d1", expiresAt: "2026-01-01T00:00:00.000Z" }),
      makeDoc({ id: "d2" }), // no expiresAt
    ];
    const sorted = sortByExpiry(docs);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe("d1");
  });

  it("元の配列を変更しない", () => {
    const docs = [
      makeDoc({ id: "d1", expiresAt: "2027-01-01T00:00:00.000Z" }),
      makeDoc({ id: "d2", expiresAt: "2025-01-01T00:00:00.000Z" }),
    ];
    const original = [...docs];
    sortByExpiry(docs);
    expect(docs[0].id).toBe(original[0].id);
  });
});

describe("isWarrantyActive", () => {
  it("有効期限内は true を返す", () => {
    const asOf = new Date("2025-01-01T00:00:00.000Z");
    const doc = makeDoc({ expiresAt: "2026-01-01T00:00:00.000Z" });
    expect(isWarrantyActive(doc, asOf)).toBe(true);
  });

  it("有効期限切れは false を返す", () => {
    const asOf = new Date("2025-01-01T00:00:00.000Z");
    const doc = makeDoc({ expiresAt: "2024-01-01T00:00:00.000Z" });
    expect(isWarrantyActive(doc, asOf)).toBe(false);
  });

  it("expiresAt がない場合は false を返す", () => {
    const doc = makeDoc();
    expect(isWarrantyActive(doc)).toBe(false);
  });
});
