import { describe, expect, it } from "vitest";
import {
  type SafetyIncident,
  computeTrend,
  recordIncident,
  summarizeWeek,
} from "../site-safety-incident.js";

// ── Helpers ───────────────────────────────────────────────

function makeInput(
  overrides: Partial<Omit<SafetyIncident, "id" | "createdAt" | "resolved">> = {},
): Omit<SafetyIncident, "id" | "createdAt" | "resolved"> {
  return {
    projectId: "proj-1",
    date: "2025-04-14",
    reportedBy: "tanaka",
    category: "near-miss",
    location: "2F 足場",
    description: "脚立から滑落しそうになった",
    cause: "足場不整備",
    correctiveAction: "足場点検実施",
    severity: 2,
    ...overrides,
  };
}

function makeIncident(overrides: Partial<SafetyIncident> = {}): SafetyIncident {
  return {
    id: "inc-1",
    projectId: "proj-1",
    date: "2025-04-14",
    reportedBy: "tanaka",
    category: "near-miss",
    location: "2F 足場",
    description: "テスト",
    cause: "足場不整備",
    correctiveAction: "点検実施",
    severity: 2,
    resolved: false,
    createdAt: new Date(),
    ...overrides,
  };
}

// ── recordIncident ────────────────────────────────────────

describe("recordIncident", () => {
  it("assigns a UUID id", () => {
    const inc = recordIncident(makeInput());
    expect(inc.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("initialises resolved to false", () => {
    const inc = recordIncident(makeInput());
    expect(inc.resolved).toBe(false);
  });

  it("assigns a createdAt Date", () => {
    const before = new Date();
    const inc = recordIncident(makeInput());
    const after = new Date();
    expect(inc.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(inc.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("preserves all input fields", () => {
    const input = makeInput({ category: "medical", severity: 4, reportedBy: "suzuki" });
    const inc = recordIncident(input);
    expect(inc.category).toBe("medical");
    expect(inc.severity).toBe(4);
    expect(inc.reportedBy).toBe("suzuki");
    expect(inc.projectId).toBe("proj-1");
  });

  it("generates unique ids for separate calls", () => {
    const a = recordIncident(makeInput());
    const b = recordIncident(makeInput());
    expect(a.id).not.toBe(b.id);
  });
});

// ── summarizeWeek ─────────────────────────────────────────

describe("summarizeWeek", () => {
  it("returns zero totals for empty incidents", () => {
    const report = summarizeWeek([], "2025-04-14");
    expect(report.totalIncidents).toBe(0);
    expect(report.unresolvedCount).toBe(0);
    expect(report.riskScore).toBe(0);
    expect(report.topCauses).toHaveLength(0);
    expect(report.byCategory["near-miss"]).toBe(0);
  });

  it("counts incidents in the week (Mon–Sun)", () => {
    const incidents = [
      makeIncident({ date: "2025-04-14", category: "near-miss" }),   // Mon
      makeIncident({ id: "2", date: "2025-04-17", category: "first-aid" }), // Thu
      makeIncident({ id: "3", date: "2025-04-20", category: "medical" }),   // Sun
      makeIncident({ id: "4", date: "2025-04-21", category: "lost-time" }), // next Mon — excluded
    ];
    const report = summarizeWeek(incidents, "2025-04-14");
    expect(report.totalIncidents).toBe(3);
    expect(report.byCategory["near-miss"]).toBe(1);
    expect(report.byCategory["first-aid"]).toBe(1);
    expect(report.byCategory["medical"]).toBe(1);
    expect(report.byCategory["lost-time"]).toBe(0);
  });

  it("counts all 5 categories correctly", () => {
    const incidents = [
      makeIncident({ id: "a", date: "2025-04-14", category: "near-miss" }),
      makeIncident({ id: "b", date: "2025-04-15", category: "first-aid" }),
      makeIncident({ id: "c", date: "2025-04-16", category: "medical" }),
      makeIncident({ id: "d", date: "2025-04-17", category: "lost-time" }),
      makeIncident({ id: "e", date: "2025-04-18", category: "fatality" }),
    ];
    const report = summarizeWeek(incidents, "2025-04-14");
    for (const cat of ["near-miss", "first-aid", "medical", "lost-time", "fatality"] as const) {
      expect(report.byCategory[cat]).toBe(1);
    }
    expect(report.totalIncidents).toBe(5);
  });

  it("counts unresolved incidents", () => {
    const incidents = [
      makeIncident({ id: "1", resolved: false }),
      makeIncident({ id: "2", resolved: true }),
      makeIncident({ id: "3", resolved: false }),
    ];
    const report = summarizeWeek(incidents, "2025-04-14");
    expect(report.unresolvedCount).toBe(2);
  });

  it("returns topCauses with up to 3 entries sorted by count", () => {
    const incidents = [
      makeIncident({ id: "1", cause: "足場不整備" }),
      makeIncident({ id: "2", cause: "足場不整備" }),
      makeIncident({ id: "3", cause: "足場不整備" }),
      makeIncident({ id: "4", cause: "ヘルメット未着用" }),
      makeIncident({ id: "5", cause: "ヘルメット未着用" }),
      makeIncident({ id: "6", cause: "照明不足" }),
    ];
    const report = summarizeWeek(incidents, "2025-04-14");
    expect(report.topCauses).toHaveLength(3);
    expect(report.topCauses[0]).toEqual({ cause: "足場不整備", count: 3 });
    expect(report.topCauses[1]).toEqual({ cause: "ヘルメット未着用", count: 2 });
    expect(report.topCauses[2]).toEqual({ cause: "照明不足", count: 1 });
  });

  it("riskScore is 0 for empty incidents", () => {
    const report = summarizeWeek([], "2025-04-14");
    expect(report.riskScore).toBe(0);
  });

  it("riskScore increases with severity", () => {
    const low = summarizeWeek(
      [makeIncident({ severity: 1 })],
      "2025-04-14",
    );
    const high = summarizeWeek(
      [makeIncident({ severity: 5 })],
      "2025-04-14",
    );
    expect(high.riskScore).toBeGreaterThan(low.riskScore);
  });

  it("riskScore is clipped to 100", () => {
    const incidents = Array.from({ length: 30 }, (_, i) =>
      makeIncident({ id: `i-${i}`, severity: 5 }),
    );
    const report = summarizeWeek(incidents, "2025-04-14");
    expect(report.riskScore).toBeLessThanOrEqual(100);
  });
});

// ── computeTrend ──────────────────────────────────────────

describe("computeTrend", () => {
  const ref = "2025-04-28"; // Mon Apr 28 = week 4
  // weeks: Apr 7, Apr 14, Apr 21, Apr 28

  it("returns 4 weekStarts in chronological order", () => {
    const result = computeTrend([], ref);
    expect(result.weekStarts).toHaveLength(4);
    expect(result.weekStarts[3]).toBe("2025-04-28");
    expect(result.weekStarts[2]).toBe("2025-04-21");
    expect(result.weekStarts[1]).toBe("2025-04-14");
    expect(result.weekStarts[0]).toBe("2025-04-07");
  });

  it("returns stable trend when no incidents", () => {
    const result = computeTrend([], ref);
    expect(result.trend).toBe("stable");
    expect(result.incidentCounts).toEqual([0, 0, 0, 0]);
  });

  it("detects improving trend (monotone decreasing last 3 weeks)", () => {
    const incidents = [
      // week Apr 14: 3 incidents
      makeIncident({ id: "a", date: "2025-04-14" }),
      makeIncident({ id: "b", date: "2025-04-15" }),
      makeIncident({ id: "c", date: "2025-04-16" }),
      // week Apr 21: 2 incidents
      makeIncident({ id: "d", date: "2025-04-21" }),
      makeIncident({ id: "e", date: "2025-04-22" }),
      // week Apr 28: 1 incident
      makeIncident({ id: "f", date: "2025-04-28" }),
    ];
    const result = computeTrend(incidents, ref);
    expect(result.trend).toBe("improving");
    expect(result.incidentCounts[1]).toBe(3);
    expect(result.incidentCounts[2]).toBe(2);
    expect(result.incidentCounts[3]).toBe(1);
  });

  it("detects worsening trend (monotone increasing last 3 weeks)", () => {
    const incidents = [
      // week Apr 14: 1
      makeIncident({ id: "a", date: "2025-04-14" }),
      // week Apr 21: 2
      makeIncident({ id: "b", date: "2025-04-21" }),
      makeIncident({ id: "c", date: "2025-04-22" }),
      // week Apr 28: 3
      makeIncident({ id: "d", date: "2025-04-28" }),
      makeIncident({ id: "e", date: "2025-04-29" }),
      makeIncident({ id: "f", date: "2025-04-30" }),
    ];
    const result = computeTrend(incidents, ref);
    expect(result.trend).toBe("worsening");
  });

  it("detects stable trend when counts fluctuate", () => {
    const incidents = [
      // week Apr 14: 2
      makeIncident({ id: "a", date: "2025-04-14" }),
      makeIncident({ id: "b", date: "2025-04-15" }),
      // week Apr 21: 1
      makeIncident({ id: "c", date: "2025-04-21" }),
      // week Apr 28: 2
      makeIncident({ id: "d", date: "2025-04-28" }),
      makeIncident({ id: "e", date: "2025-04-29" }),
    ];
    const result = computeTrend(incidents, ref);
    expect(result.trend).toBe("stable");
  });

  it("riskScores array has 4 elements and is non-negative", () => {
    const incidents = [makeIncident({ date: "2025-04-21", severity: 3 })];
    const result = computeTrend(incidents, ref);
    expect(result.riskScores).toHaveLength(4);
    for (const score of result.riskScores) {
      expect(score).toBeGreaterThanOrEqual(0);
    }
  });

  it("projectId is populated from first incident", () => {
    const incidents = [makeIncident({ projectId: "proj-99" })];
    const result = computeTrend(incidents, "2025-04-14");
    expect(result.projectId).toBe("proj-99");
  });
});
