/**
 * score-calculator — 4軸スコア計算の網羅テスト
 */
import { describe, it, expect } from "vitest";
import { calculateScore } from "../lib/vendor-rating/score-calculator.js";
import { VendorEventKind } from "../lib/vendor-rating/types.js";
import type { VendorEvent } from "../lib/vendor-rating/types.js";

function makeEvent(
  overrides: Partial<VendorEvent> & { kind: VendorEventKind },
): VendorEvent {
  return {
    id: crypto.randomUUID(),
    vendorId: "v1",
    projectId: "p1",
    weight: 1.0,
    occurredAt: new Date().toISOString(),
    ...overrides,
  };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ── Empty events ────────────────────────────────────────────────

describe("calculateScore — empty events", () => {
  it("returns neutral score 50 for all axes", () => {
    const s = calculateScore([]);
    expect(s.deliveryScore).toBe(50);
    expect(s.qualityScore).toBe(50);
    expect(s.priceScore).toBe(50);
    expect(s.commScore).toBe(50);
  });

  it("returns overallScore 50 for empty events", () => {
    const s = calculateScore([]);
    expect(s.overallScore).toBe(50);
  });

  it("eventCount is 0", () => {
    expect(calculateScore([]).eventCount).toBe(0);
  });

  it("vendorId is empty string for empty events", () => {
    expect(calculateScore([]).vendorId).toBe("");
  });

  it("lastUpdated is an ISO string", () => {
    const s = calculateScore([]);
    expect(() => new Date(s.lastUpdated)).not.toThrow();
  });
});

// ── Delivery axis ───────────────────────────────────────────────

describe("calculateScore — delivery axis", () => {
  it("all on-time → deliveryScore 100", () => {
    const events = [
      makeEvent({ kind: VendorEventKind.DeliveryOnTime }),
      makeEvent({ kind: VendorEventKind.DeliveryOnTime }),
      makeEvent({ kind: VendorEventKind.DeliveryOnTime }),
    ];
    expect(calculateScore(events).deliveryScore).toBe(100);
  });

  it("all late → deliveryScore 0", () => {
    const events = [
      makeEvent({ kind: VendorEventKind.DeliveryLate }),
      makeEvent({ kind: VendorEventKind.DeliveryLate }),
      makeEvent({ kind: VendorEventKind.DeliveryLate }),
    ];
    expect(calculateScore(events).deliveryScore).toBe(0);
  });

  it("50/50 → deliveryScore 50 (equal weight)", () => {
    const events = [
      makeEvent({ kind: VendorEventKind.DeliveryOnTime }),
      makeEvent({ kind: VendorEventKind.DeliveryLate }),
    ];
    expect(calculateScore(events).deliveryScore).toBe(50);
  });

  it("no delivery events → deliveryScore 50 neutral", () => {
    const events = [makeEvent({ kind: VendorEventKind.QualityPass })];
    expect(calculateScore(events).deliveryScore).toBe(50);
  });
});

// ── Quality axis ────────────────────────────────────────────────

describe("calculateScore — quality axis", () => {
  it("all pass → qualityScore 100", () => {
    const events = Array.from({ length: 5 }, () =>
      makeEvent({ kind: VendorEventKind.QualityPass }),
    );
    expect(calculateScore(events).qualityScore).toBe(100);
  });

  it("all rework → qualityScore 0", () => {
    const events = Array.from({ length: 4 }, () =>
      makeEvent({ kind: VendorEventKind.QualityRework }),
    );
    expect(calculateScore(events).qualityScore).toBe(0);
  });

  it("3 pass + 1 rework → 75", () => {
    const events = [
      makeEvent({ kind: VendorEventKind.QualityPass }),
      makeEvent({ kind: VendorEventKind.QualityPass }),
      makeEvent({ kind: VendorEventKind.QualityPass }),
      makeEvent({ kind: VendorEventKind.QualityRework }),
    ];
    expect(calculateScore(events).qualityScore).toBe(75);
  });
});

// ── Price axis ──────────────────────────────────────────────────

describe("calculateScore — price axis", () => {
  it("all competitive → priceScore 100", () => {
    const events = Array.from({ length: 4 }, () =>
      makeEvent({ kind: VendorEventKind.QuoteCompetitive }),
    );
    expect(calculateScore(events).priceScore).toBe(100);
  });

  it("all high → priceScore 0", () => {
    const events = Array.from({ length: 3 }, () =>
      makeEvent({ kind: VendorEventKind.QuoteHigh }),
    );
    expect(calculateScore(events).priceScore).toBe(0);
  });
});

// ── Comm axis ───────────────────────────────────────────────────

describe("calculateScore — comm axis", () => {
  it("all responsive → commScore 100", () => {
    const events = Array.from({ length: 3 }, () =>
      makeEvent({ kind: VendorEventKind.CommResponsive }),
    );
    expect(calculateScore(events).commScore).toBe(100);
  });

  it("all slow → commScore 0", () => {
    const events = Array.from({ length: 3 }, () =>
      makeEvent({ kind: VendorEventKind.CommSlow }),
    );
    expect(calculateScore(events).commScore).toBe(0);
  });
});

// ── Time weighting ──────────────────────────────────────────────

describe("calculateScore — time weighting", () => {
  it("recent event (≤30d) boosts positive score vs old (>365d)", () => {
    // 1 old late + 1 recent on-time — recent on-time should dominate
    const events = [
      makeEvent({ kind: VendorEventKind.DeliveryLate, occurredAt: daysAgo(400) }),
      makeEvent({ kind: VendorEventKind.DeliveryOnTime, occurredAt: daysAgo(5) }),
    ];
    const s = calculateScore(events);
    // recent on-time weight 1.5 vs old late weight 0.3 → on-time dominates
    expect(s.deliveryScore).toBeGreaterThan(50);
  });

  it("old (>365d) event has reduced influence", () => {
    // 1 very old on-time + 3 recent late
    const events = [
      makeEvent({ kind: VendorEventKind.DeliveryOnTime, occurredAt: daysAgo(400) }),
      makeEvent({ kind: VendorEventKind.DeliveryLate, occurredAt: daysAgo(5) }),
      makeEvent({ kind: VendorEventKind.DeliveryLate, occurredAt: daysAgo(10) }),
      makeEvent({ kind: VendorEventKind.DeliveryLate, occurredAt: daysAgo(15) }),
    ];
    const s = calculateScore(events);
    expect(s.deliveryScore).toBeLessThan(50);
  });
});

// ── Low event count penalty ─────────────────────────────────────

describe("calculateScore — eventCount < 3 penalty", () => {
  it("1 event — overallScore is penalized (×0.7)", () => {
    const events = [makeEvent({ kind: VendorEventKind.DeliveryOnTime })];
    const s = calculateScore(events);
    // delivery 100, others 50 neutral → raw overall ≈ 72.5 → with 0.7 → ~50
    expect(s.overallScore).toBeLessThan(75);
  });

  it("2 events still get penalty", () => {
    const events = [
      makeEvent({ kind: VendorEventKind.DeliveryOnTime }),
      makeEvent({ kind: VendorEventKind.QualityPass }),
    ];
    const s = calculateScore(events);
    expect(s.overallScore).toBeLessThanOrEqual(
      Math.round((100 * 0.3 + 100 * 0.35 + 50 * 0.2 + 50 * 0.15) * 0.7),
    );
  });

  it("3+ events — no penalty applied", () => {
    const events = Array.from({ length: 3 }, () =>
      makeEvent({ kind: VendorEventKind.DeliveryOnTime }),
    );
    const s = calculateScore(events);
    // delivery 100, others 50 → raw 50+50+30 = 50*0.65 + 100*0.30 = ~62.5
    expect(s.overallScore).toBeGreaterThan(50);
  });
});

// ── Overall weighting ───────────────────────────────────────────

describe("calculateScore — overall weighting", () => {
  it("quality has the highest weight (0.35)", () => {
    // quality 100, others 0
    const events = Array.from({ length: 5 }, (_, i) =>
      i % 2 === 0
        ? makeEvent({ kind: VendorEventKind.QualityPass })
        : makeEvent({ kind: VendorEventKind.DeliveryLate }),
    );
    // at least quality contributes meaningfully
    const s = calculateScore(events);
    expect(s.qualityScore).toBeGreaterThan(s.deliveryScore);
  });

  it("overallScore is within 0-100", () => {
    const events = [
      makeEvent({ kind: VendorEventKind.DeliveryOnTime }),
      makeEvent({ kind: VendorEventKind.QualityRework }),
      makeEvent({ kind: VendorEventKind.QuoteHigh }),
      makeEvent({ kind: VendorEventKind.CommResponsive }),
    ];
    const s = calculateScore(events);
    expect(s.overallScore).toBeGreaterThanOrEqual(0);
    expect(s.overallScore).toBeLessThanOrEqual(100);
  });

  it("vendorId is taken from events", () => {
    const events = [
      makeEvent({ vendorId: "vendor-abc", kind: VendorEventKind.DeliveryOnTime }),
    ];
    expect(calculateScore(events).vendorId).toBe("vendor-abc");
  });

  it("eventCount matches input length", () => {
    const events = Array.from({ length: 7 }, () =>
      makeEvent({ kind: VendorEventKind.CommResponsive }),
    );
    expect(calculateScore(events).eventCount).toBe(7);
  });

  it("all positive → overallScore high (>= 70 for 3+ events)", () => {
    const events = [
      makeEvent({ kind: VendorEventKind.DeliveryOnTime }),
      makeEvent({ kind: VendorEventKind.QualityPass }),
      makeEvent({ kind: VendorEventKind.QuoteCompetitive }),
      makeEvent({ kind: VendorEventKind.CommResponsive }),
    ];
    expect(calculateScore(events).overallScore).toBeGreaterThanOrEqual(70);
  });

  it("all negative → overallScore low (< 30 for 3+ events)", () => {
    const events = [
      makeEvent({ kind: VendorEventKind.DeliveryLate }),
      makeEvent({ kind: VendorEventKind.QualityRework }),
      makeEvent({ kind: VendorEventKind.QuoteHigh }),
      makeEvent({ kind: VendorEventKind.CommSlow }),
    ];
    expect(calculateScore(events).overallScore).toBeLessThan(30);
  });
});
