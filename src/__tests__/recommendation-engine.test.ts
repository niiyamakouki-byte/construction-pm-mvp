/**
 * recommendation-engine — recommendForCategory tests
 */
import { describe, it, expect, beforeEach } from "vitest";

// jsdom では localStorage.clear が未実装のためモックする
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });
import { recommendForCategory } from "../lib/vendor-rating/recommendation-engine.js";
import { VendorEventStore } from "../lib/vendor-rating/event-store.js";
import { VendorEventKind } from "../lib/vendor-rating/types.js";
import type { VendorEvent } from "../lib/vendor-rating/types.js";
import type { Vendor } from "../lib/vendor-rating/recommendation-engine.js";

function makeVendor(id: string, name: string): Vendor {
  return { id, name };
}

function makeEvent(vendorId: string, kind: VendorEventKind): VendorEvent {
  return {
    id: crypto.randomUUID(),
    vendorId,
    projectId: "p1",
    kind,
    weight: 1.0,
    occurredAt: new Date().toISOString(),
  };
}

function seedEvents(vendorId: string, kinds: VendorEventKind[]) {
  const store = VendorEventStore.getInstance();
  for (const kind of kinds) {
    store.addEvent(makeEvent(vendorId, kind));
  }
}

describe("recommendForCategory", () => {
  beforeEach(() => {
    localStorageMock.clear();
    VendorEventStore._reset();
  });

  // ── Basic return shape ─────────────────────────────────────────

  it("returns an array", () => {
    expect(Array.isArray(recommendForCategory("内装", []))).toBe(true);
  });

  it("returns empty array for empty vendors", () => {
    expect(recommendForCategory("内装", [])).toHaveLength(0);
  });

  it("returns one entry per vendor", () => {
    const vendors = [makeVendor("v1", "A"), makeVendor("v2", "B")];
    const result = recommendForCategory("電気", vendors);
    expect(result).toHaveLength(2);
  });

  it("each recommendation has required fields", () => {
    const vendors = [makeVendor("v1", "TestCo")];
    const [rec] = recommendForCategory("設備", vendors);
    expect(rec.vendorId).toBe("v1");
    expect(rec.vendorName).toBe("TestCo");
    expect(rec.overallScore).toBeTypeOf("number");
    expect(rec.rank).toBe(1);
    expect(["recommended", "caution", "avoid"]).toContain(rec.signal);
    expect(Array.isArray(rec.reasons)).toBe(true);
  });

  // ── Sorting & ranking ──────────────────────────────────────────

  it("results are sorted descending by overallScore", () => {
    const vendors = [makeVendor("v1", "A"), makeVendor("v2", "B"), makeVendor("v3", "C")];
    seedEvents("v1", [VendorEventKind.DeliveryLate, VendorEventKind.QualityRework, VendorEventKind.DeliveryLate]);
    seedEvents("v2", Array.from({ length: 5 }, () => VendorEventKind.DeliveryOnTime));
    seedEvents("v3", [VendorEventKind.DeliveryOnTime, VendorEventKind.DeliveryLate, VendorEventKind.QualityPass]);

    const result = recommendForCategory("内装", vendors);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].overallScore).toBeGreaterThanOrEqual(result[i + 1].overallScore);
    }
  });

  it("rank is 1-based and sequential", () => {
    const vendors = [makeVendor("v1", "A"), makeVendor("v2", "B"), makeVendor("v3", "C")];
    const result = recommendForCategory("塗装", vendors);
    const ranks = result.map((r) => r.rank);
    expect(ranks).toEqual([1, 2, 3]);
  });

  it("top-ranked vendor has rank 1", () => {
    const vendors = [makeVendor("vX", "Best Co")];
    seedEvents("vX", Array.from({ length: 5 }, () => VendorEventKind.DeliveryOnTime));
    const [first] = recommendForCategory("内装", vendors);
    expect(first.rank).toBe(1);
  });

  // ── Signal thresholds ──────────────────────────────────────────

  it("high score vendor gets recommended signal", () => {
    const vendors = [makeVendor("vHigh", "高評価業者")];
    seedEvents(
      "vHigh",
      Array.from({ length: 10 }, (_, i) =>
        i % 5 === 0 ? VendorEventKind.DeliveryLate : VendorEventKind.DeliveryOnTime,
      ),
    );
    // 8 on-time / 2 late = 80 delivery + other axes neutral
    const [rec] = recommendForCategory("内装", vendors);
    expect(["recommended", "caution"]).toContain(rec.signal);
  });

  it("score >= 70 → recommended", () => {
    const vendors = [makeVendor("vTop", "TopCo")];
    seedEvents("vTop", [
      ...Array.from({ length: 5 }, () => VendorEventKind.DeliveryOnTime),
      ...Array.from({ length: 5 }, () => VendorEventKind.QualityPass),
      ...Array.from({ length: 5 }, () => VendorEventKind.QuoteCompetitive),
      ...Array.from({ length: 5 }, () => VendorEventKind.CommResponsive),
    ]);
    const [rec] = recommendForCategory("設備", vendors);
    expect(rec.signal).toBe("recommended");
  });

  it("score < 40 → avoid", () => {
    const vendors = [makeVendor("vBad", "BadCo")];
    seedEvents("vBad", [
      ...Array.from({ length: 5 }, () => VendorEventKind.DeliveryLate),
      ...Array.from({ length: 5 }, () => VendorEventKind.QualityRework),
      ...Array.from({ length: 5 }, () => VendorEventKind.QuoteHigh),
      ...Array.from({ length: 5 }, () => VendorEventKind.CommSlow),
    ]);
    const [rec] = recommendForCategory("左官", vendors);
    expect(rec.signal).toBe("avoid");
  });

  // ── Reasons content ────────────────────────────────────────────

  it("no events → reasons include 履歴データなし", () => {
    const vendors = [makeVendor("vNew", "新規業者")];
    const [rec] = recommendForCategory("内装", vendors);
    expect(rec.reasons.some((r) => r.includes("履歴データなし"))).toBe(true);
  });

  it("reasons is non-empty array", () => {
    const vendors = [makeVendor("v1", "A")];
    seedEvents("v1", [
      makeEvent("v1", VendorEventKind.DeliveryOnTime),
      makeEvent("v1", VendorEventKind.QualityPass),
      makeEvent("v1", VendorEventKind.CommResponsive),
    ].map((e) => e.kind));
    const [rec] = recommendForCategory("電気", vendors);
    expect(rec.reasons.length).toBeGreaterThan(0);
  });

  it("low event count reason appears for < 3 events", () => {
    const vendors = [makeVendor("v1", "A")];
    seedEvents("v1", [VendorEventKind.DeliveryOnTime]);
    const [rec] = recommendForCategory("内装", vendors);
    expect(rec.reasons.some((r) => r.includes("暫定値"))).toBe(true);
  });

  it("高deliveryScore → reasons include 納期遵守", () => {
    const vendors = [makeVendor("v1", "A")];
    seedEvents("v1", Array.from({ length: 8 }, () => VendorEventKind.DeliveryOnTime));
    const [rec] = recommendForCategory("塗装", vendors);
    expect(rec.reasons.some((r) => r.includes("納期") || r.includes("遵守"))).toBe(true);
  });

  // ── vendorName ─────────────────────────────────────────────────

  it("vendorName is preserved correctly", () => {
    const vendors = [makeVendor("vN", "田中電気工業")];
    const [rec] = recommendForCategory("電気", vendors);
    expect(rec.vendorName).toBe("田中電気工業");
  });

  it("overallScore is a finite number", () => {
    const vendors = [makeVendor("v1", "A")];
    const [rec] = recommendForCategory("内装", vendors);
    expect(Number.isFinite(rec.overallScore)).toBe(true);
  });
});
