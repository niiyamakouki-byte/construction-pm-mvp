/**
 * Tests for ranking-builder.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { buildRankingSnapshot } from "../ranking-builder.js";
import { addProject, _resetProjectStore } from "../../store.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeProject(id: string, budget: number) {
  addProject({
    id,
    name: `案件${id}`,
    description: "内装工事",
    status: "active",
    startDate: "2025-01-01",
    budget,
    includeWeekends: false,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  });
}

beforeEach(() => {
  vi.stubGlobal("localStorage", (() => {
    const store = new Map<string, string>();
    return {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => { store.clear(); },
      get length() { return store.size; },
      key: (i: number) => [...store.keys()][i] ?? null,
    };
  })());
  _resetProjectStore();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("buildRankingSnapshot", () => {
  it("プロジェクトなし → totalProjects=0, entries=[]", () => {
    const snap = buildRankingSnapshot("marginRatioPct");
    expect(snap.totalProjects).toBe(0);
    expect(snap.entries).toHaveLength(0);
  });

  it("generatedAt は ISO 8601 文字列", () => {
    const snap = buildRankingSnapshot("marginAmount");
    expect(() => new Date(snap.generatedAt)).not.toThrow();
    expect(snap.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("sortKey がスナップショットに保存される", () => {
    const snap = buildRankingSnapshot("marginPerMonth");
    expect(snap.sortKey).toBe("marginPerMonth");
  });

  it("3案件 → entries が3件", () => {
    makeProject("p1", 10_000_000);
    makeProject("p2", 8_000_000);
    makeProject("p3", 6_000_000);
    const snap = buildRankingSnapshot("marginRatioPct");
    expect(snap.entries).toHaveLength(3);
  });

  it("avgMarginRatioPct が数値として返る", () => {
    makeProject("p-avg-1", 10_000_000);
    makeProject("p-avg-2", 5_000_000);
    const snap = buildRankingSnapshot("marginRatioPct");
    expect(typeof snap.avgMarginRatioPct).toBe("number");
  });

  it("コストなし → avgMarginRatioPct=100", () => {
    makeProject("p-full", 10_000_000);
    const snap = buildRankingSnapshot("marginRatioPct");
    // No orders, so margin = 100%
    expect(snap.avgMarginRatioPct).toBeCloseTo(100, 1);
  });

  it("totalProjects が entries.length と一致する", () => {
    makeProject("p-tc-1", 10_000_000);
    makeProject("p-tc-2", 8_000_000);
    const snap = buildRankingSnapshot("marginAmount");
    expect(snap.totalProjects).toBe(snap.entries.length);
  });

  it("forecastDelta ソート → entries が返る", () => {
    makeProject("p-fd-1", 10_000_000);
    makeProject("p-fd-2", 5_000_000);
    const snap = buildRankingSnapshot("forecastDelta");
    expect(snap.entries.length).toBeGreaterThanOrEqual(2);
  });
});
