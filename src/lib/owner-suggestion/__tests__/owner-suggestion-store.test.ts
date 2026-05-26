/**
 * owner-suggestion-store.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ownerSuggestionStore,
  _resetOwnerSuggestionStore,
} from "../owner-suggestion-store.js";
import { makeOwnerSuggestionId } from "../types.js";
import type { OwnerSuggestion } from "../types.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

function makeSuggestion(id: string, projectId = "proj-001"): OwnerSuggestion {
  return {
    id: makeOwnerSuggestionId(id),
    projectId,
    ownerProfile: {
      ownerName: "テスト施主",
      budget: 8000000,
      familySize: 3,
      ageRange: "40s",
      lifestyle: ["cooking"],
      priorityRanking: "balancedFirst" as never,
    },
    plans: [
      { id: "p1", kind: "budget_focused", status: "draft", titleJa: "A", conceptJa: "", estimatedCost: 6800000, estimatedDays: 45, rationaleJa: "", materialHighlights: [], maintenanceForecast: [], riskNotes: [] },
      { id: "p2", kind: "balanced", status: "draft", titleJa: "B", conceptJa: "", estimatedCost: 8000000, estimatedDays: 55, rationaleJa: "", materialHighlights: [], maintenanceForecast: [], riskNotes: [] },
      { id: "p3", kind: "premium", status: "draft", titleJa: "C", conceptJa: "", estimatedCost: 9600000, estimatedDays: 70, rationaleJa: "", materialHighlights: [], maintenanceForecast: [], riskNotes: [] },
    ],
    generatedAt: "2025-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  localStorage.clear();
  _resetOwnerSuggestionStore();
});

describe("add / getAll", () => {
  it("追加した提案が getAll で取得できる", () => {
    const s = makeSuggestion("os-1");
    ownerSuggestionStore.add(s);
    expect(ownerSuggestionStore.getAll()).toHaveLength(1);
  });

  it("複数追加できる", () => {
    ownerSuggestionStore.add(makeSuggestion("os-1"));
    ownerSuggestionStore.add(makeSuggestion("os-2"));
    expect(ownerSuggestionStore.getAll()).toHaveLength(2);
  });
});

describe("get", () => {
  it("IDで取得できる", () => {
    const s = makeSuggestion("os-1");
    ownerSuggestionStore.add(s);
    const found = ownerSuggestionStore.get(makeOwnerSuggestionId("os-1"));
    expect(found?.id).toBe("os-1");
  });

  it("存在しないIDは null", () => {
    expect(ownerSuggestionStore.get(makeOwnerSuggestionId("nonexistent"))).toBeNull();
  });
});

describe("update", () => {
  it("部分更新できる", () => {
    const s = makeSuggestion("os-1");
    ownerSuggestionStore.add(s);
    const updated = ownerSuggestionStore.update(makeOwnerSuggestionId("os-1"), {
      presentedAt: "2025-06-01T00:00:00.000Z",
    });
    expect(updated?.presentedAt).toBe("2025-06-01T00:00:00.000Z");
  });

  it("存在しないIDは null", () => {
    expect(ownerSuggestionStore.update(makeOwnerSuggestionId("nonexistent"), {})).toBeNull();
  });
});

describe("remove", () => {
  it("削除後は getAll に含まれない", () => {
    const s = makeSuggestion("os-1");
    ownerSuggestionStore.add(s);
    ownerSuggestionStore.remove(makeOwnerSuggestionId("os-1"));
    expect(ownerSuggestionStore.getAll()).toHaveLength(0);
  });
});

describe("clear", () => {
  it("全件削除できる", () => {
    ownerSuggestionStore.add(makeSuggestion("os-1"));
    ownerSuggestionStore.add(makeSuggestion("os-2"));
    ownerSuggestionStore.clear();
    expect(ownerSuggestionStore.getAll()).toHaveLength(0);
  });
});

describe("subscribe", () => {
  it("add 時にリスナーが呼ばれる", () => {
    const listener = vi.fn();
    const unsubscribe = ownerSuggestionStore.subscribe(listener);
    ownerSuggestionStore.add(makeSuggestion("os-1"));
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("unsubscribe 後はリスナーが呼ばれない", () => {
    const listener = vi.fn();
    const unsubscribe = ownerSuggestionStore.subscribe(listener);
    unsubscribe();
    ownerSuggestionStore.add(makeSuggestion("os-1"));
    expect(listener).not.toHaveBeenCalled();
  });
});
