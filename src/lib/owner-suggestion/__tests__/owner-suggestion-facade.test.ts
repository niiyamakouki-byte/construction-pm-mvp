/**
 * owner-suggestion-facade.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createSuggestion,
  presentToOwner,
  markPlanDecision,
  exportPDF,
  listAllSuggestions,
  listSuggestionsByProject,
  getSuggestion,
  removeSuggestion,
} from "../owner-suggestion-facade.js";
import { _resetOwnerSuggestionStore } from "../owner-suggestion-store.js";
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
  ownerName: "佐藤花子",
  budget: 8000000,
  familySize: 4,
  ageRange: "40s",
  lifestyle: ["cooking", "entertain_guests"],
  priorityRanking: "qualityFirst",
};

beforeEach(() => {
  localStorage.clear();
  _resetOwnerSuggestionStore();
});

describe("createSuggestion", () => {
  it("提案が作成される", () => {
    const s = createSuggestion("proj-001", testProfile, 8000000);
    expect(s.id).toMatch(/^os-/);
    expect(s.projectId).toBe("proj-001");
    expect(s.ownerProfile).toEqual(testProfile);
    expect(s.plans).toHaveLength(3);
    expect(s.generatedAt).toBeTruthy();
  });

  it("ストアに保存される", () => {
    const s = createSuggestion("proj-001", testProfile, 8000000);
    expect(getSuggestion(s.id)).not.toBeNull();
  });

  it("now パラメータが generatedAt に反映される", () => {
    const now = new Date("2025-01-15T12:00:00.000Z");
    const s = createSuggestion("proj-001", testProfile, 8000000, now);
    expect(s.generatedAt).toBe("2025-01-15T12:00:00.000Z");
  });
});

describe("presentToOwner", () => {
  it("presentedAt が設定される", () => {
    const s = createSuggestion("proj-001", testProfile, 8000000);
    const now = new Date("2025-06-01T00:00:00.000Z");
    const updated = presentToOwner(s.id, now);
    expect(updated?.presentedAt).toBe("2025-06-01T00:00:00.000Z");
  });

  it("存在しないIDは null", () => {
    expect(presentToOwner("nonexistent")).toBeNull();
  });
});

describe("markPlanDecision", () => {
  it("採用決定で decidedPlanId が設定される", () => {
    const s = createSuggestion("proj-001", testProfile, 8000000);
    const planId = s.plans[1].id;
    const updated = markPlanDecision(s.id, planId, true);
    expect(updated?.decidedPlanId).toBe(planId);
  });

  it("採用決定で対象プランが accepted になる", () => {
    const s = createSuggestion("proj-001", testProfile, 8000000);
    const planId = s.plans[1].id;
    const updated = markPlanDecision(s.id, planId, true);
    const plan = updated?.plans.find((p) => p.id === planId);
    expect(plan?.status).toBe("accepted");
  });

  it("採用決定で他プランが rejected になる", () => {
    const s = createSuggestion("proj-001", testProfile, 8000000);
    const planId = s.plans[1].id;
    const updated = markPlanDecision(s.id, planId, true);
    const others = updated?.plans.filter((p) => p.id !== planId);
    for (const p of others ?? []) {
      expect(p.status).toBe("rejected");
    }
  });

  it("見送りで rejected になる", () => {
    const s = createSuggestion("proj-001", testProfile, 8000000);
    const planId = s.plans[0].id;
    const updated = markPlanDecision(s.id, planId, false);
    const plan = updated?.plans.find((p) => p.id === planId);
    expect(plan?.status).toBe("rejected");
  });

  it("存在しないIDは null", () => {
    expect(markPlanDecision("nonexistent", "p1", true)).toBeNull();
  });
});

describe("exportPDF", () => {
  it("markdown フォーマットで文字列を返す", () => {
    const s = createSuggestion("proj-001", testProfile, 8000000);
    const result = exportPDF(s.id, "markdown");
    expect(result).toContain("施主提案書");
  });

  it("html フォーマットで DOCTYPE を含む", () => {
    const s = createSuggestion("proj-001", testProfile, 8000000);
    const result = exportPDF(s.id, "html");
    expect(result).toContain("<!DOCTYPE html>");
  });

  it("存在しないIDは null", () => {
    expect(exportPDF("nonexistent", "markdown")).toBeNull();
  });
});

describe("listAllSuggestions", () => {
  it("全提案を返す", () => {
    createSuggestion("proj-A", testProfile, 8000000);
    createSuggestion("proj-B", testProfile, 9000000);
    expect(listAllSuggestions()).toHaveLength(2);
  });
});

describe("listSuggestionsByProject", () => {
  it("プロジェクトIDで絞り込める", () => {
    createSuggestion("proj-A", testProfile, 8000000);
    createSuggestion("proj-B", testProfile, 8000000);
    expect(listSuggestionsByProject("proj-A")).toHaveLength(1);
    expect(listSuggestionsByProject("proj-B")).toHaveLength(1);
  });
});

describe("removeSuggestion", () => {
  it("削除後は getSuggestion で null", () => {
    const s = createSuggestion("proj-001", testProfile, 8000000);
    removeSuggestion(s.id);
    expect(getSuggestion(s.id)).toBeNull();
  });
});
