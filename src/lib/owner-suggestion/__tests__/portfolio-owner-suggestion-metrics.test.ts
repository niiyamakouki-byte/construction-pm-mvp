/**
 * portfolio-owner-suggestion-metrics.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  pendingOwnerSuggestions,
  acceptedSuggestionRate,
  mostPopularPlanKind,
  avgBudgetGap,
} from "../portfolio-owner-suggestion-metrics.js";
import { _resetOwnerSuggestionStore } from "../owner-suggestion-store.js";
import { createSuggestion, markPlanDecision } from "../owner-suggestion-facade.js";
import type { OwnerProfile } from "../types.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

const testProfile: OwnerProfile = {
  ownerName: "田中一郎",
  budget: 8000000,
  familySize: 2,
  ageRange: "40s",
  lifestyle: [],
  priorityRanking: "qualityFirst",
};

beforeEach(() => {
  localStorage.clear();
  _resetOwnerSuggestionStore();
});

describe("pendingOwnerSuggestions", () => {
  it("データなしの場合は 0", () => {
    expect(pendingOwnerSuggestions()).toBe(0);
  });

  it("未決定の提案をカウントする", () => {
    createSuggestion("proj-1", testProfile, 8000000);
    createSuggestion("proj-2", testProfile, 8000000);
    expect(pendingOwnerSuggestions()).toBe(2);
  });

  it("採用決定済みは除外される", () => {
    const s = createSuggestion("proj-1", testProfile, 8000000);
    markPlanDecision(s.id, s.plans[1].id, true);
    expect(pendingOwnerSuggestions()).toBe(0);
  });
});

describe("acceptedSuggestionRate", () => {
  it("データなしの場合は 0", () => {
    expect(acceptedSuggestionRate()).toBe(0);
  });

  it("1提案採用済みで正しい採用率", () => {
    const s = createSuggestion("proj-1", testProfile, 8000000);
    markPlanDecision(s.id, s.plans[1].id, true);
    // plans[1] accepted, plans[0] & [2] rejected => 1 accepted / (1+2) rejected = 1/3
    const rate = acceptedSuggestionRate();
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThanOrEqual(1);
  });
});

describe("mostPopularPlanKind", () => {
  it("データなしの場合は null", () => {
    expect(mostPopularPlanKind()).toBeNull();
  });

  it("採用なしの場合は null", () => {
    createSuggestion("proj-1", testProfile, 8000000);
    expect(mostPopularPlanKind()).toBeNull();
  });

  it("採用済みプランの kind を返す", () => {
    const s = createSuggestion("proj-1", testProfile, 8000000);
    const planId = s.plans[1].id; // balanced
    markPlanDecision(s.id, planId, true);
    const kind = mostPopularPlanKind();
    expect(kind).toBeTruthy();
  });
});

describe("avgBudgetGap", () => {
  it("データなしの場合は 0", () => {
    expect(avgBudgetGap()).toBe(0);
  });

  it("採用なしの場合は 0", () => {
    createSuggestion("proj-1", testProfile, 8000000);
    expect(avgBudgetGap()).toBe(0);
  });

  it("budget_focused (×0.85) を採用した場合は負のギャップ", () => {
    const s = createSuggestion("proj-1", testProfile, 8000000);
    markPlanDecision(s.id, s.plans[0].id, true); // budget_focused
    const gap = avgBudgetGap();
    expect(gap).toBeLessThan(0); // 6,800,000 - 8,000,000 = -1,200,000
  });

  it("premium (×1.2) を採用した場合は正のギャップ", () => {
    const s = createSuggestion("proj-1", testProfile, 8000000);
    markPlanDecision(s.id, s.plans[2].id, true); // premium
    const gap = avgBudgetGap();
    expect(gap).toBeGreaterThan(0); // 9,600,000 - 8,000,000 = 1,600,000
  });
});
