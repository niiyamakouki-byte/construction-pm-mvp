/**
 * DealStore — unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { DealStore, _resetDealStore } from "../deal-store.js";
import type { Deal } from "../types.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

function makeDeal(id: string, customerName = "テスト顧客"): Deal {
  const now = new Date().toISOString();
  return {
    id,
    customerName,
    currentStage: "inquiry",
    expectedAmountJpy: 1_000_000,
    probabilityPct: 5,
    expectedCloseDate: "2026-08-01",
    ownerName: "新山光輝",
    stageHistory: [],
    createdAt: now,
    updatedAt: now,
  };
}

beforeEach(() => {
  localStorage.clear();
  _resetDealStore();
});

describe("DealStore#getAll", () => {
  it("空の場合は[]を返す", () => {
    const s = new DealStore();
    expect(s.getAll()).toHaveLength(0);
  });
});

describe("DealStore#ensureSeed", () => {
  it("30件のシードデータを生成する", () => {
    const s = new DealStore();
    s.ensureSeed();
    expect(s.getAll()).toHaveLength(30);
  });

  it("2回呼び出しても重複しない (idempotent)", () => {
    const s = new DealStore();
    s.ensureSeed();
    s.ensureSeed();
    expect(s.getAll()).toHaveLength(30);
  });

  it("シードをサンプルとして識別し、実名を含まない", () => {
    const s = new DealStore();
    s.ensureSeed();
    expect(s.isSampleData()).toBe(true);
    expect(s.getAll().every((deal) => deal.ownerName === "担当者A")).toBe(true);
    expect(JSON.stringify(s.getAll())).not.toContain("新山光輝");
  });

  it("空状態を選ぶと再訪時もシードを再生成しない", () => {
    const s = new DealStore();
    s.ensureSeed();
    s.startEmpty();
    s.ensureSeed();
    expect(s.getAll()).toEqual([]);
    expect(s.isSampleData()).toBe(false);
  });
});

describe("DealStore#save", () => {
  it("新規 deal を追加できる", () => {
    const s = new DealStore();
    s.save(makeDeal("d-001"));
    expect(s.getAll()).toHaveLength(1);
  });

  it("既存 deal を上書き更新できる", () => {
    const s = new DealStore();
    const deal = makeDeal("d-001", "初期顧客");
    s.save(deal);
    const updated = { ...deal, customerName: "更新顧客" };
    s.save(updated);
    expect(s.getAll()).toHaveLength(1);
    expect(s.byId("d-001")?.customerName).toBe("更新顧客");
  });

  it("deal-added イベントが発火する", () => {
    const s = new DealStore();
    const spy = vi.fn();
    s.addEventListener("deal-added", spy);
    s.save(makeDeal("d-001"));
    expect(spy).toHaveBeenCalledOnce();
  });

  it("deal-updated イベントが発火する", () => {
    const s = new DealStore();
    const spy = vi.fn();
    s.addEventListener("deal-updated", spy);
    const deal = makeDeal("d-001");
    s.save(deal);
    s.save({ ...deal, customerName: "更新" });
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe("DealStore#byId", () => {
  it("存在するIDで deal を返す", () => {
    const s = new DealStore();
    s.save(makeDeal("d-001", "田中"));
    expect(s.byId("d-001")?.customerName).toBe("田中");
  });

  it("存在しないIDは null を返す", () => {
    const s = new DealStore();
    expect(s.byId("nonexistent")).toBeNull();
  });
});

describe("DealStore#byStage", () => {
  it("ステージで絞り込める", () => {
    const s = new DealStore();
    s.save(makeDeal("d-001"));
    s.save({ ...makeDeal("d-002"), currentStage: "proposal" });
    expect(s.byStage("inquiry")).toHaveLength(1);
    expect(s.byStage("proposal")).toHaveLength(1);
    expect(s.byStage("won")).toHaveLength(0);
  });
});

describe("DealStore#subscribe", () => {
  it("変更を受け取れる", () => {
    const s = new DealStore();
    const received: Deal[][] = [];
    const unsub = s.subscribe((deals) => received.push(deals));
    s.save(makeDeal("d-001"));
    expect(received).toHaveLength(1);
    unsub();
    s.save(makeDeal("d-002"));
    expect(received).toHaveLength(1); // unsubscribe後は受け取らない
  });
});

describe("DealStore#clearAll", () => {
  it("全件削除できる", () => {
    const s = new DealStore();
    s.save(makeDeal("d-001"));
    s.save(makeDeal("d-002"));
    s.clearAll();
    expect(s.getAll()).toHaveLength(0);
  });
});

describe("DealStore FIFO 1000件", () => {
  it("1001件以上追加すると古いものが削除される", () => {
    const s = new DealStore();
    for (let i = 0; i < 1001; i++) {
      s.save(makeDeal(`d-${String(i).padStart(4, "0")}`));
    }
    const all = s.getAll();
    expect(all.length).toBe(1000);
    // 最初の deal は削除されている
    expect(all.find((d) => d.id === "d-0000")).toBeUndefined();
  });
});
