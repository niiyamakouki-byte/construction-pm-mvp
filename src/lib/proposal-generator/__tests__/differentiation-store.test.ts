/**
 * DifferentiationStore unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { DifferentiationStore, _resetDifferentiationStore } from "../differentiation-store.js";
import type { DifferentiationPoint } from "../types.js";

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
  _resetDifferentiationStore();
});

function makePoint(overrides: Partial<DifferentiationPoint> = {}): DifferentiationPoint {
  return {
    id: "diff-test-1",
    axisJa: "テスト軸",
    laportaPositionJa: "ラポルタの強み",
    competitorPositionJa: "競合の弱点",
    advantageJa: "優位性説明",
    ...overrides,
  };
}

describe("DifferentiationStore.ensureSeed", () => {
  it("6軸のシードデータを投入する", () => {
    const s = new DifferentiationStore();
    s.ensureSeed();
    expect(s.getAll().length).toBe(6);
  });

  it("2回呼んでも重複しない (idempotent)", () => {
    const s = new DifferentiationStore();
    s.ensureSeed();
    s.ensureSeed();
    expect(s.getAll().length).toBe(6);
  });
});

describe("DifferentiationStore.save", () => {
  it("新規ポイントを追加できる", () => {
    const s = new DifferentiationStore();
    s.save(makePoint());
    expect(s.getAll()).toHaveLength(1);
  });

  it("同じIDで save すると更新される", () => {
    const s = new DifferentiationStore();
    s.save(makePoint({ axisJa: "初期" }));
    s.save(makePoint({ axisJa: "更新後" }));
    expect(s.getAll()).toHaveLength(1);
    expect(s.getAll()[0].axisJa).toBe("更新後");
  });
});

describe("DifferentiationStore.byId", () => {
  it("存在するIDで取得できる", () => {
    const s = new DifferentiationStore();
    s.save(makePoint({ id: "diff-abc" }));
    expect(s.byId("diff-abc")).not.toBeNull();
  });

  it("存在しないIDは null", () => {
    const s = new DifferentiationStore();
    expect(s.byId("none")).toBeNull();
  });
});

describe("DifferentiationStore.clearAll", () => {
  it("全件削除できる", () => {
    const s = new DifferentiationStore();
    s.save(makePoint());
    s.clearAll();
    expect(s.getAll()).toHaveLength(0);
  });
});

describe("DifferentiationStore seed — axis coverage", () => {
  it("価格軸が含まれる", () => {
    const s = new DifferentiationStore();
    s.ensureSeed();
    expect(s.getAll().some((p) => p.axisJa === "価格")).toBe(true);
  });

  it("工期軸が含まれる", () => {
    const s = new DifferentiationStore();
    s.ensureSeed();
    expect(s.getAll().some((p) => p.axisJa === "工期")).toBe(true);
  });

  it("設計AI軸が含まれる", () => {
    const s = new DifferentiationStore();
    s.ensureSeed();
    expect(s.getAll().some((p) => p.axisJa === "設計AI")).toBe(true);
  });
});
