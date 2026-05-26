/**
 * Tests for MarginAlertStore.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { MarginAlertStore, _resetMarginAlertStore } from "../margin-alert-store.js";
import type { MarginAlert, MarginAlertLevel } from "../types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

let _counter = 0;

function makeAlert(overrides: Partial<MarginAlert> = {}): MarginAlert {
  return {
    id: `ma-${++_counter}`,
    projectId: "p1",
    projectName: "テスト案件",
    level: "warning",
    marginRatioPct: 22,
    forecastMarginRatioPct: 20,
    deltaFromTargetPct: -5,
    causeTag: ["原価増"],
    suggestedAction_ja: "週次レビュー対象。粗利改善案を3つ用意",
    raisedAt: new Date().toISOString(),
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
  _resetMarginAlertStore();
  _counter = 0;
});

// ── 基本操作 ────────────────────────────────────────────────────────────────

describe("MarginAlertStore - 基本操作", () => {
  it("初期状態で all() は空配列", () => {
    const store = new MarginAlertStore();
    expect(store.all()).toHaveLength(0);
  });

  it("add() でアラートが永続化される", () => {
    const store = new MarginAlertStore();
    const alert = makeAlert();
    store.add(alert);
    expect(store.all()).toHaveLength(1);
    expect(store.all()[0].id).toBe(alert.id);
  });

  it("複数 add() で順序保持", () => {
    const store = new MarginAlertStore();
    const a1 = makeAlert({ id: "a1" });
    const a2 = makeAlert({ id: "a2" });
    store.add(a1);
    store.add(a2);
    const all = store.all();
    expect(all[0].id).toBe("a1");
    expect(all[1].id).toBe("a2");
  });
});

// ── FIFO 5000件 ────────────────────────────────────────────────────────────

describe("MarginAlertStore - FIFO 5000件", () => {
  it("5001件追加時に先頭が削除される", { timeout: 30_000 }, () => {
    const store = new MarginAlertStore();
    const first = makeAlert({ id: "first" });
    store.add(first);
    for (let i = 0; i < 5000; i++) {
      store.add(makeAlert({ id: `bulk-${i}` }));
    }
    const all = store.all();
    expect(all).toHaveLength(5000);
    // first should be evicted
    expect(all.find((a) => a.id === "first")).toBeUndefined();
  });

  it("5000件ちょうどは全て保持される", { timeout: 30_000 }, () => {
    const store = new MarginAlertStore();
    for (let i = 0; i < 5000; i++) {
      store.add(makeAlert({ id: `bulk-${i}` }));
    }
    expect(store.all()).toHaveLength(5000);
  });
});

// ── 永続化 (localStorage) ─────────────────────────────────────────────────

describe("MarginAlertStore - 永続化", () => {
  it("別インスタンスでも同じ localStorage から読み込める", () => {
    const store1 = new MarginAlertStore();
    store1.add(makeAlert({ id: "persisted" }));

    const store2 = new MarginAlertStore();
    expect(store2.all()[0].id).toBe("persisted");
  });
});

// ── イベント ───────────────────────────────────────────────────────────────

describe("MarginAlertStore - イベント", () => {
  it("add() で 'alert-added' イベントが発火", () => {
    const store = new MarginAlertStore();
    let fired = false;
    store.addEventListener("alert-added", () => { fired = true; });
    store.add(makeAlert());
    expect(fired).toBe(true);
  });

  it("dismiss() で 'alert-dismissed' イベントが発火", () => {
    const store = new MarginAlertStore();
    const alert = makeAlert({ id: "to-dismiss" });
    store.add(alert);
    let fired = false;
    store.addEventListener("alert-dismissed", () => { fired = true; });
    store.dismiss("to-dismiss");
    expect(fired).toBe(true);
  });

  it("存在しない id を dismiss しても false-fire しない", () => {
    const store = new MarginAlertStore();
    let fired = false;
    store.addEventListener("alert-dismissed", () => { fired = true; });
    store.dismiss("nonexistent");
    expect(fired).toBe(false);
  });
});

// ── dismiss ────────────────────────────────────────────────────────────────

describe("MarginAlertStore - dismiss", () => {
  it("dismiss() でアラートが削除される", () => {
    const store = new MarginAlertStore();
    store.add(makeAlert({ id: "del" }));
    store.add(makeAlert({ id: "keep" }));
    store.dismiss("del");
    const all = store.all();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("keep");
  });
});

// ── byProject フィルタ ─────────────────────────────────────────────────────

describe("MarginAlertStore - byProject", () => {
  it("byProject() は指定 projectId のみ返す", () => {
    const store = new MarginAlertStore();
    store.add(makeAlert({ id: "a1", projectId: "p1" }));
    store.add(makeAlert({ id: "a2", projectId: "p2" }));
    store.add(makeAlert({ id: "a3", projectId: "p1" }));
    const p1 = store.byProject("p1");
    expect(p1).toHaveLength(2);
    expect(p1.every((a) => a.projectId === "p1")).toBe(true);
  });
});

// ── byLevel フィルタ ───────────────────────────────────────────────────────

describe("MarginAlertStore - byLevel", () => {
  it("byLevel() は指定 level のみ返す", () => {
    const store = new MarginAlertStore();
    store.add(makeAlert({ id: "w1", level: "warning" }));
    store.add(makeAlert({ id: "c1", level: "critical" }));
    store.add(makeAlert({ id: "w2", level: "warning" }));
    const warnings = store.byLevel("warning");
    expect(warnings).toHaveLength(2);
    expect(warnings.every((a) => a.level === "warning")).toBe(true);
  });
});

// ── since フィルタ ─────────────────────────────────────────────────────────

describe("MarginAlertStore - since", () => {
  it("since() は指定日時以降のアラートのみ返す", () => {
    const store = new MarginAlertStore();
    const old = makeAlert({ id: "old", raisedAt: "2020-01-01T00:00:00.000Z" });
    const recent = makeAlert({ id: "recent", raisedAt: new Date().toISOString() });
    store.add(old);
    store.add(recent);
    const result = store.since(new Date("2024-01-01"));
    expect(result.every((a) => a.id !== "old")).toBe(true);
    expect(result.some((a) => a.id === "recent")).toBe(true);
  });
});

// ── clear ──────────────────────────────────────────────────────────────────

describe("MarginAlertStore - clear", () => {
  it("clear() で全件削除される", () => {
    const store = new MarginAlertStore();
    store.add(makeAlert());
    store.add(makeAlert());
    store.clear();
    expect(store.all()).toHaveLength(0);
  });
});
