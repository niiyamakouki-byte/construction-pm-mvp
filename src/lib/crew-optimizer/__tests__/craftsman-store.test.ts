/**
 * Tests for CraftsmanStore.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { CraftsmanStore, _resetCraftsmanStore } from "../craftsman-store.js";
import type { Craftsman } from "../types.js";

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

function makeCraftsman(id: string): Craftsman {
  return {
    id,
    name: `職人 ${id}`,
    skills: ["demolition"],
    dailyRate: 25000,
    baseLocationLat: 35.68,
    baseLocationLng: 139.69,
    maxConcurrentSites: 2,
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createMockLocalStorage());
  _resetCraftsmanStore();
});

describe("CraftsmanStore — 基本操作", () => {
  it("初期状態で all() は空配列", () => {
    const store = new CraftsmanStore();
    expect(store.all()).toHaveLength(0);
  });

  it("add() で職人が追加される", () => {
    const store = new CraftsmanStore();
    store.add(makeCraftsman("c001"));
    expect(store.all()).toHaveLength(1);
  });

  it("findById() が正しく動作する", () => {
    const store = new CraftsmanStore();
    store.add(makeCraftsman("c001"));
    expect(store.findById("c001")?.id).toBe("c001");
    expect(store.findById("c999")).toBeUndefined();
  });
});

describe("CraftsmanStore — 200名上限", () => {
  it("201名追加時に先頭が削除される", () => {
    const store = new CraftsmanStore();
    store.add(makeCraftsman("first"));
    for (let i = 0; i < 200; i++) {
      store.add(makeCraftsman(`c${String(i).padStart(3, "0")}`));
    }
    const all = store.all();
    expect(all).toHaveLength(200);
    expect(all.find((c) => c.id === "first")).toBeUndefined();
  });
});

describe("CraftsmanStore — seed", () => {
  it("ensureSeed() で seed 30名が読み込まれる", () => {
    const store = new CraftsmanStore();
    store.ensureSeed();
    expect(store.all()).toHaveLength(30);
  });

  it("ensureSeed() は既存データがある場合は何もしない", () => {
    const store = new CraftsmanStore();
    store.add(makeCraftsman("c001"));
    store.ensureSeed();
    expect(store.all()).toHaveLength(1);
  });
});

describe("CraftsmanStore — EventTarget", () => {
  it("add() で 'craftsman-added' イベントが発火", () => {
    const store = new CraftsmanStore();
    let fired = false;
    store.addEventListener("craftsman-added", () => {
      fired = true;
    });
    store.add(makeCraftsman("c001"));
    expect(fired).toBe(true);
  });
});

describe("CraftsmanStore — clear", () => {
  it("clear() で全件削除される", () => {
    const store = new CraftsmanStore();
    store.add(makeCraftsman("c001"));
    store.add(makeCraftsman("c002"));
    store.clear();
    expect(store.all()).toHaveLength(0);
  });
});
