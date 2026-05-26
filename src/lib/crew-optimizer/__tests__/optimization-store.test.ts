/**
 * Tests for CrewOptimizationStore.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { CrewOptimizationStore, _resetCrewOptimizationStore } from "../optimization-store.js";
import type { CrewOptimizationResult } from "../types.js";

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

function makeResult(overrides: Partial<CrewOptimizationResult> = {}): CrewOptimizationResult {
  return {
    schedules: [],
    totalConflicts: 0,
    avgUtilizationPct: 75,
    unassignedTaskIds: [],
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createMockLocalStorage());
  _resetCrewOptimizationStore();
});

describe("CrewOptimizationStore — 基本操作", () => {
  it("初期状態で all() は空配列", () => {
    const store = new CrewOptimizationStore();
    expect(store.all()).toHaveLength(0);
  });

  it("add() でスナップショットが永続化される", () => {
    const store = new CrewOptimizationStore();
    store.add(makeResult());
    expect(store.all()).toHaveLength(1);
  });
});

describe("CrewOptimizationStore — FIFO 50件", () => {
  it("51件追加時に先頭が削除される", () => {
    const store = new CrewOptimizationStore();
    store.add(makeResult({ avgUtilizationPct: 999 }));
    for (let i = 0; i < 50; i++) {
      store.add(makeResult({ avgUtilizationPct: i }));
    }
    const all = store.all();
    expect(all).toHaveLength(50);
    expect(all.find((r) => r.avgUtilizationPct === 999)).toBeUndefined();
  });
});

describe("CrewOptimizationStore — latest", () => {
  it("空状態で latest() は null", () => {
    const store = new CrewOptimizationStore();
    expect(store.latest()).toBeNull();
  });

  it("最後に add したスナップショットが返る", () => {
    const store = new CrewOptimizationStore();
    store.add(makeResult({ avgUtilizationPct: 60 }));
    store.add(makeResult({ avgUtilizationPct: 80 }));
    expect(store.latest()!.avgUtilizationPct).toBe(80);
  });
});

describe("CrewOptimizationStore — EventTarget", () => {
  it("add() で 'optimization-added' イベントが発火", () => {
    const store = new CrewOptimizationStore();
    let fired = false;
    store.addEventListener("optimization-added", () => {
      fired = true;
    });
    store.add(makeResult());
    expect(fired).toBe(true);
  });
});

describe("CrewOptimizationStore — clear", () => {
  it("clear() で全件削除される", () => {
    const store = new CrewOptimizationStore();
    store.add(makeResult());
    store.add(makeResult());
    store.clear();
    expect(store.all()).toHaveLength(0);
  });
});
