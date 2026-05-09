/**
 * Tests for ProfitRankingStore.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { ProfitRankingStore, _resetProfitRankingStore } from "../profit-ranking-store.js";
import type { ProfitRankingSnapshot } from "../types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<ProfitRankingSnapshot> = {}): ProfitRankingSnapshot {
  return {
    entries: [],
    generatedAt: new Date().toISOString(),
    sortKey: "marginRatioPct",
    totalProjects: 3,
    avgMarginRatioPct: 28.5,
    ...overrides,
  };
}

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createMockLocalStorage());
  _resetProfitRankingStore();
});

// ── 基本操作 ────────────────────────────────────────────────────────────────

describe("ProfitRankingStore - 基本操作", () => {
  it("初期状態で all() は空配列", () => {
    const store = new ProfitRankingStore();
    expect(store.all()).toHaveLength(0);
  });

  it("add() でスナップショットが永続化される", () => {
    const store = new ProfitRankingStore();
    store.add(makeSnapshot());
    expect(store.all()).toHaveLength(1);
  });

  it("複数 add() で順序保持", () => {
    const store = new ProfitRankingStore();
    store.add(makeSnapshot({ totalProjects: 1 }));
    store.add(makeSnapshot({ totalProjects: 2 }));
    const all = store.all();
    expect(all[0].totalProjects).toBe(1);
    expect(all[1].totalProjects).toBe(2);
  });
});

// ── latest ─────────────────────────────────────────────────────────────────

describe("ProfitRankingStore - latest", () => {
  it("空状態で latest() は null", () => {
    const store = new ProfitRankingStore();
    expect(store.latest()).toBeNull();
  });

  it("最後に add したスナップショットが返る", () => {
    const store = new ProfitRankingStore();
    store.add(makeSnapshot({ totalProjects: 1 }));
    store.add(makeSnapshot({ totalProjects: 5 }));
    expect(store.latest()!.totalProjects).toBe(5);
  });
});

// ── FIFO 50件 ──────────────────────────────────────────────────────────────

describe("ProfitRankingStore - FIFO 50件", () => {
  it("51件追加時に先頭が削除される", () => {
    const store = new ProfitRankingStore();
    store.add(makeSnapshot({ totalProjects: 999 }));
    for (let i = 0; i < 50; i++) {
      store.add(makeSnapshot({ totalProjects: i }));
    }
    const all = store.all();
    expect(all).toHaveLength(50);
    expect(all.find((s) => s.totalProjects === 999)).toBeUndefined();
  });
});

// ── イベント ───────────────────────────────────────────────────────────────

describe("ProfitRankingStore - イベント", () => {
  it("add() で 'snapshot-added' イベントが発火", () => {
    const store = new ProfitRankingStore();
    let fired = false;
    store.addEventListener("snapshot-added", () => { fired = true; });
    store.add(makeSnapshot());
    expect(fired).toBe(true);
  });
});

// ── 永続化 ─────────────────────────────────────────────────────────────────

describe("ProfitRankingStore - 永続化", () => {
  it("別インスタンスでも同じ localStorage から読み込める", () => {
    const store1 = new ProfitRankingStore();
    store1.add(makeSnapshot({ totalProjects: 7 }));
    const store2 = new ProfitRankingStore();
    expect(store2.all()[0].totalProjects).toBe(7);
  });
});

// ── clear ──────────────────────────────────────────────────────────────────

describe("ProfitRankingStore - clear", () => {
  it("clear() で全件削除される", () => {
    const store = new ProfitRankingStore();
    store.add(makeSnapshot());
    store.add(makeSnapshot());
    store.clear();
    expect(store.all()).toHaveLength(0);
  });
});
