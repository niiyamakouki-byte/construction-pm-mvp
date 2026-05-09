/**
 * Tests for HistoricalStore (delay-predictor)
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  HistoricalStore,
  getHistoricalStore,
  _resetHistoricalStore,
} from "../../lib/delay-predictor/historical-store.js";
import { WeatherCondition } from "../../lib/delay-predictor/types.js";
import type { HistoricalTaskRecord } from "../../lib/delay-predictor/types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

let _counter = 0;

function makeRecord(overrides: Partial<HistoricalTaskRecord> = {}): HistoricalTaskRecord {
  return {
    id: `rec-${++_counter}`,
    taskKind: "内装",
    plannedDays: 5,
    actualDays: 6,
    weather: [WeatherCondition.sunny],
    laborAvailabilityRatio: 1.0,
    season: "spring",
    ...overrides,
  };
}

// ── Setup ──────────────────────────────────────────────────────────────────

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
  _resetHistoricalStore();
});

// ── Seed ───────────────────────────────────────────────────────────────────

describe("HistoricalStore seed", () => {
  it("起動時に空の場合は seed 50件が投入される", () => {
    const store = new HistoricalStore();
    expect(store.all().length).toBe(50);
  });

  it("既存データがある場合は seed しない", () => {
    const store1 = new HistoricalStore();
    store1.add(makeRecord({ id: "extra-1" }));
    const totalAfterAdd = store1.all().length;

    const store2 = new HistoricalStore();
    // re-use same localStorage — should not reseed
    expect(store2.all().length).toBe(totalAfterAdd);
  });
});

// ── add / all ─────────────────────────────────────────────────────────────

describe("HistoricalStore add / all", () => {
  it("add でレコードが追加される", () => {
    const store = new HistoricalStore();
    const before = store.all().length;
    store.add(makeRecord({ id: "new-1" }));
    expect(store.all().length).toBe(before + 1);
  });

  it("add で 'change' イベントが発火する", () => {
    const store = new HistoricalStore();
    let fired = false;
    store.addEventListener("change", () => { fired = true; });
    store.add(makeRecord({ id: "ev-1" }));
    expect(fired).toBe(true);
  });
});

// ── filterByKind ──────────────────────────────────────────────────────────

describe("HistoricalStore filterByKind", () => {
  it("指定 taskKind のレコードのみ返す", () => {
    const store = new HistoricalStore();
    const 内装 = store.filterByKind("内装");
    expect(内装.every((r) => r.taskKind === "内装")).toBe(true);
    expect(内装.length).toBeGreaterThan(0);
  });

  it("存在しない kind は空配列", () => {
    const store = new HistoricalStore();
    expect(store.filterByKind("存在しない工種")).toHaveLength(0);
  });
});

// ── filterBySeason ────────────────────────────────────────────────────────

describe("HistoricalStore filterBySeason", () => {
  it("指定 season のレコードのみ返す", () => {
    const store = new HistoricalStore();
    const winter = store.filterBySeason("winter");
    expect(winter.every((r) => r.season === "winter")).toBe(true);
    expect(winter.length).toBeGreaterThan(0);
  });

  it("全シーズンに 1件以上の seed レコードが存在する", () => {
    const store = new HistoricalStore();
    for (const season of ["spring", "summer", "autumn", "winter"] as const) {
      expect(store.filterBySeason(season).length).toBeGreaterThan(0);
    }
  });
});

// ── Singleton ─────────────────────────────────────────────────────────────

describe("getHistoricalStore singleton", () => {
  it("同じインスタンスを返す", () => {
    const a = getHistoricalStore();
    const b = getHistoricalStore();
    expect(a).toBe(b);
  });

  it("_resetHistoricalStore で新インスタンスが返る", () => {
    const a = getHistoricalStore();
    _resetHistoricalStore();
    const b = getHistoricalStore();
    expect(a).not.toBe(b);
  });
});
