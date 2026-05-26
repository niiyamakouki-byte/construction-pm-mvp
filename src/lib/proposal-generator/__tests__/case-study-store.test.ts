/**
 * CaseStudyStore unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CaseStudyStore, _resetCaseStudyStore } from "../case-study-store.js";
import type { CaseStudy } from "../types.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

beforeEach(() => {
  localStorage.clear();
  _resetCaseStudyStore();
});

function makeCase(overrides: Partial<CaseStudy> = {}): CaseStudy {
  return {
    id: "case-test-1",
    projectName: "テストプロジェクト",
    workCategory: "kitchen",
    workScale: "medium",
    scaleJa: "中規模",
    completedYearMonth: "2025-06",
    anonymizedClient: "テスト区T様邸",
    summaryJa: "テスト概要",
    achievementJa: "テスト実績",
    ...overrides,
  };
}

describe("CaseStudyStore.ensureSeed", () => {
  it("12件のシードデータを投入する", () => {
    const s = new CaseStudyStore();
    s.ensureSeed();
    expect(s.getAll().length).toBe(12);
  });

  it("2回呼んでも重複しない (idempotent)", () => {
    const s = new CaseStudyStore();
    s.ensureSeed();
    s.ensureSeed();
    expect(s.getAll().length).toBe(12);
  });
});

describe("CaseStudyStore.getAll", () => {
  it("空の場合は空配列を返す", () => {
    const s = new CaseStudyStore();
    expect(s.getAll()).toEqual([]);
  });
});

describe("CaseStudyStore.byCategory", () => {
  it("workCategory でフィルタリングできる", () => {
    const s = new CaseStudyStore();
    s.save(makeCase({ id: "c1", workCategory: "kitchen" }));
    s.save(makeCase({ id: "c2", workCategory: "bath" }));
    const kitchens = s.byCategory("kitchen");
    expect(kitchens).toHaveLength(1);
    expect(kitchens[0].workCategory).toBe("kitchen");
  });
});

describe("CaseStudyStore.byScale", () => {
  it("workScale でフィルタリングできる", () => {
    const s = new CaseStudyStore();
    s.save(makeCase({ id: "c1", workScale: "small" }));
    s.save(makeCase({ id: "c2", workScale: "large" }));
    const small = s.byScale("small");
    expect(small).toHaveLength(1);
  });
});

describe("CaseStudyStore.save", () => {
  it("同じIDで save すると更新される", () => {
    const s = new CaseStudyStore();
    s.save(makeCase({ summaryJa: "初期" }));
    s.save(makeCase({ summaryJa: "更新後" }));
    const all = s.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].summaryJa).toBe("更新後");
  });
});

describe("CaseStudyStore.byId", () => {
  it("存在するIDで取得できる", () => {
    const s = new CaseStudyStore();
    s.save(makeCase({ id: "case-xyz" }));
    expect(s.byId("case-xyz")).not.toBeNull();
  });

  it("存在しないIDは null", () => {
    const s = new CaseStudyStore();
    expect(s.byId("none")).toBeNull();
  });
});

describe("CaseStudyStore.clearAll", () => {
  it("全件削除できる", () => {
    const s = new CaseStudyStore();
    s.save(makeCase());
    s.clearAll();
    expect(s.getAll()).toHaveLength(0);
  });
});

describe("CaseStudyStore seed — category coverage", () => {
  it("full_renovation ケースが含まれる", () => {
    const s = new CaseStudyStore();
    s.ensureSeed();
    expect(s.byCategory("full_renovation").length).toBeGreaterThan(0);
  });

  it("store_fit ケースが含まれる", () => {
    const s = new CaseStudyStore();
    s.ensureSeed();
    expect(s.byCategory("store_fit").length).toBeGreaterThan(0);
  });

  it("exterior ケースが含まれる", () => {
    const s = new CaseStudyStore();
    s.ensureSeed();
    expect(s.byCategory("exterior").length).toBeGreaterThan(0);
  });
});
