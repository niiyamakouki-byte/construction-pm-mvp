/**
 * vendor-rating types — enum values, shape validation
 */
import { describe, it, expect } from "vitest";
import { VendorEventKind } from "../lib/vendor-rating/types.js";
import type {
  VendorEvent,
  VendorScore,
  VendorRecommendation,
} from "../lib/vendor-rating/types.js";

// ── VendorEventKind enum ────────────────────────────────────────

describe("VendorEventKind", () => {
  it("DeliveryOnTime has correct string value", () => {
    expect(VendorEventKind.DeliveryOnTime).toBe("delivery_on_time");
  });

  it("DeliveryLate has correct string value", () => {
    expect(VendorEventKind.DeliveryLate).toBe("delivery_late");
  });

  it("QualityPass has correct string value", () => {
    expect(VendorEventKind.QualityPass).toBe("quality_pass");
  });

  it("QualityRework has correct string value", () => {
    expect(VendorEventKind.QualityRework).toBe("quality_rework");
  });

  it("QuoteCompetitive has correct string value", () => {
    expect(VendorEventKind.QuoteCompetitive).toBe("quote_competitive");
  });

  it("QuoteHigh has correct string value", () => {
    expect(VendorEventKind.QuoteHigh).toBe("quote_high");
  });

  it("CommResponsive has correct string value", () => {
    expect(VendorEventKind.CommResponsive).toBe("comm_responsive");
  });

  it("CommSlow has correct string value", () => {
    expect(VendorEventKind.CommSlow).toBe("comm_slow");
  });

  it("has exactly 8 values", () => {
    const values = Object.values(VendorEventKind);
    expect(values).toHaveLength(8);
  });
});

// ── VendorEvent shape ───────────────────────────────────────────

describe("VendorEvent type shape", () => {
  it("accepts a minimal valid event without notes", () => {
    const event: VendorEvent = {
      id: "e1",
      vendorId: "v1",
      projectId: "p1",
      kind: VendorEventKind.DeliveryOnTime,
      weight: 1.0,
      occurredAt: "2025-01-01T00:00:00Z",
    };
    expect(event.id).toBe("e1");
    expect(event.weight).toBe(1.0);
  });

  it("accepts optional notes field", () => {
    const event: VendorEvent = {
      id: "e2",
      vendorId: "v2",
      projectId: "p2",
      kind: VendorEventKind.QualityRework,
      weight: 1.5,
      occurredAt: "2025-06-01T00:00:00Z",
      notes: "クロス張り直し",
    };
    expect(event.notes).toBe("クロス張り直し");
  });

  it("weight can be a float", () => {
    const event: VendorEvent = {
      id: "e3",
      vendorId: "v3",
      projectId: "p3",
      kind: VendorEventKind.CommSlow,
      weight: 0.5,
      occurredAt: "2025-03-01T00:00:00Z",
    };
    expect(event.weight).toBe(0.5);
  });
});

// ── VendorScore shape ───────────────────────────────────────────

describe("VendorScore type shape", () => {
  it("accepts a fully populated score", () => {
    const score: VendorScore = {
      vendorId: "v1",
      deliveryScore: 80,
      qualityScore: 70,
      priceScore: 60,
      commScore: 90,
      overallScore: 75,
      eventCount: 10,
      lastUpdated: "2025-12-01T00:00:00Z",
    };
    expect(score.overallScore).toBe(75);
    expect(score.eventCount).toBe(10);
  });

  it("scores can be 0", () => {
    const score: VendorScore = {
      vendorId: "v2",
      deliveryScore: 0,
      qualityScore: 0,
      priceScore: 0,
      commScore: 0,
      overallScore: 0,
      eventCount: 5,
      lastUpdated: new Date().toISOString(),
    };
    expect(score.deliveryScore).toBe(0);
  });
});

// ── VendorRecommendation shape ──────────────────────────────────

describe("VendorRecommendation type shape", () => {
  it("accepts recommended signal", () => {
    const rec: VendorRecommendation = {
      vendorId: "v1",
      vendorName: "田中工務店",
      overallScore: 80,
      rank: 1,
      signal: "recommended",
      reasons: ["納期遵守率が高い"],
    };
    expect(rec.signal).toBe("recommended");
    expect(rec.rank).toBe(1);
  });

  it("accepts caution signal", () => {
    const rec: VendorRecommendation = {
      vendorId: "v2",
      vendorName: "山田電気",
      overallScore: 55,
      rank: 2,
      signal: "caution",
      reasons: ["直近5件中2件納期遅延"],
    };
    expect(rec.signal).toBe("caution");
  });

  it("accepts avoid signal", () => {
    const rec: VendorRecommendation = {
      vendorId: "v3",
      vendorName: "佐藤塗装",
      overallScore: 30,
      rank: 3,
      signal: "avoid",
      reasons: ["品質問題の履歴あり"],
    };
    expect(rec.signal).toBe("avoid");
  });

  it("reasons is an array of strings", () => {
    const rec: VendorRecommendation = {
      vendorId: "v4",
      vendorName: "鈴木設備",
      overallScore: 72,
      rank: 1,
      signal: "recommended",
      reasons: ["競争力のある価格設定", "レスポンスが良好"],
    };
    expect(rec.reasons).toHaveLength(2);
    expect(rec.reasons[0]).toBeTypeOf("string");
  });
});
