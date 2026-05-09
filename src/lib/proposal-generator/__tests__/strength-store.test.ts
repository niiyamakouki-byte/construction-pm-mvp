/**
 * StrengthStore unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { StrengthStore, _resetStrengthStore } from "../strength-store.js";
import type { LaportaStrength } from "../types.js";

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
  _resetStrengthStore();
});

function makeStrength(overrides: Partial<LaportaStrength> = {}): LaportaStrength {
  return {
    id: "str-test-1",
    titleJa: "テスト強み",
    bodyJa: "説明テキスト",
    weight: 0.8,
    ...overrides,
  };
}

describe("StrengthStore.ensureSeed", () => {
  it("8件のシードデータを投入する", () => {
    const store = new StrengthStore();
    store.ensureSeed();
    expect(store.getAll().length).toBe(8);
  });

  it("2回呼んでも重複しない (idempotent)", () => {
    const store = new StrengthStore();
    store.ensureSeed();
    store.ensureSeed();
    expect(store.getAll().length).toBe(8);
  });
});

describe("StrengthStore.getAll", () => {
  it("空の場合は空配列を返す", () => {
    const s = new StrengthStore();
    expect(s.getAll()).toEqual([]);
  });
});

describe("StrengthStore.save", () => {
  it("新規強みを追加できる", () => {
    const s = new StrengthStore();
    s.save(makeStrength());
    expect(s.getAll()).toHaveLength(1);
  });

  it("同じIDで save すると更新される", () => {
    const s = new StrengthStore();
    s.save(makeStrength({ titleJa: "初期" }));
    s.save(makeStrength({ titleJa: "更新後" }));
    const all = s.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].titleJa).toBe("更新後");
  });
});

describe("StrengthStore.byId", () => {
  it("存在するIDで取得できる", () => {
    const s = new StrengthStore();
    s.save(makeStrength({ id: "str-abc" }));
    const found = s.byId("str-abc");
    expect(found).not.toBeNull();
    expect(found?.id).toBe("str-abc");
  });

  it("存在しないIDは null を返す", () => {
    const s = new StrengthStore();
    expect(s.byId("nonexistent")).toBeNull();
  });
});

describe("StrengthStore.clearAll", () => {
  it("全件削除できる", () => {
    const s = new StrengthStore();
    s.save(makeStrength());
    s.clearAll();
    expect(s.getAll()).toHaveLength(0);
  });
});

describe("StrengthStore.subscribe", () => {
  it("save 後にリスナーが呼ばれる", () => {
    const s = new StrengthStore();
    const listener = vi.fn();
    s.subscribe(listener);
    s.save(makeStrength());
    expect(listener).toHaveBeenCalledOnce();
  });

  it("unsubscribe 後はリスナーが呼ばれない", () => {
    const s = new StrengthStore();
    const listener = vi.fn();
    const unsub = s.subscribe(listener);
    unsub();
    s.save(makeStrength());
    expect(listener).not.toHaveBeenCalled();
  });
});
