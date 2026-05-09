/**
 * ProposalStore unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProposalStore, _resetProposalStore } from "../proposal-store.js";
import type { ProposalDocument } from "../types.js";

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
  _resetProposalStore();
});

function makeDoc(overrides: Partial<ProposalDocument> = {}): ProposalDocument {
  return {
    id: "prop-test-1",
    customerName: "田中花子",
    generatedAt: new Date().toISOString(),
    sections: [],
    totalPriceJpyLower: 1_000_000,
    totalPriceJpyUpper: 3_000_000,
    durationDays: 30,
    validUntil: "2026-06-08",
    ...overrides,
  };
}

describe("ProposalStore.save + get", () => {
  it("保存してIDで取得できる", () => {
    const s = new ProposalStore();
    const doc = makeDoc({ id: "prop-abc" });
    s.save(doc);
    expect(s.get("prop-abc")).not.toBeNull();
    expect(s.get("prop-abc")?.customerName).toBe("田中花子");
  });

  it("同じIDで save すると更新される", () => {
    const s = new ProposalStore();
    s.save(makeDoc({ customerName: "田中花子" }));
    s.save(makeDoc({ customerName: "鈴木太郎" }));
    expect(s.listRecent()).toHaveLength(1);
    expect(s.listRecent()[0].customerName).toBe("鈴木太郎");
  });
});

describe("ProposalStore.listRecent", () => {
  it("新しい順に返す", () => {
    const s = new ProposalStore();
    const old = makeDoc({ id: "p-old", generatedAt: new Date(Date.now() - 60000).toISOString() });
    const fresh = makeDoc({ id: "p-fresh", generatedAt: new Date().toISOString() });
    s.save(old);
    s.save(fresh);
    const list = s.listRecent();
    expect(list[0].id).toBe("p-fresh");
  });

  it("limit で件数を絞れる", () => {
    const s = new ProposalStore();
    for (let i = 0; i < 5; i++) {
      s.save(makeDoc({ id: `p-${i}` }));
    }
    expect(s.listRecent(3)).toHaveLength(3);
  });
});

describe("ProposalStore.listByCustomer", () => {
  it("顧客名でフィルタリングできる", () => {
    const s = new ProposalStore();
    s.save(makeDoc({ id: "p-1", customerName: "田中" }));
    s.save(makeDoc({ id: "p-2", customerName: "佐藤" }));
    expect(s.listByCustomer("田中")).toHaveLength(1);
    expect(s.listByCustomer("田中")[0].id).toBe("p-1");
  });
});

describe("ProposalStore.delete", () => {
  it("IDを指定して削除できる", () => {
    const s = new ProposalStore();
    s.save(makeDoc({ id: "p-del" }));
    s.delete("p-del");
    expect(s.get("p-del")).toBeNull();
  });
});

describe("ProposalStore FIFO 500件", () => {
  it("501件目を追加すると最古が削除される", () => {
    const s = new ProposalStore();
    // Save 500 docs
    for (let i = 1; i <= 500; i++) {
      s.save(makeDoc({ id: `p-${i.toString().padStart(4, "0")}` }));
    }
    // Add 501st
    s.save(makeDoc({ id: "p-0501" }));
    expect(s.listRecent(500).length).toBeLessThanOrEqual(500);
    // Oldest (p-0001) should be trimmed
    expect(s.get("p-0001")).toBeNull();
  });
});

describe("ProposalStore.clearAll", () => {
  it("全件削除できる", () => {
    const s = new ProposalStore();
    s.save(makeDoc());
    s.clearAll();
    expect(s.listRecent()).toHaveLength(0);
  });
});

describe("ProposalStore.subscribe", () => {
  it("save 後にリスナーが呼ばれる", () => {
    const s = new ProposalStore();
    const listener = vi.fn();
    s.subscribe(listener);
    s.save(makeDoc());
    expect(listener).toHaveBeenCalledOnce();
  });

  it("delete 後にリスナーが呼ばれる", () => {
    const s = new ProposalStore();
    s.save(makeDoc({ id: "del-1" }));
    const listener = vi.fn();
    s.subscribe(listener);
    s.delete("del-1");
    expect(listener).toHaveBeenCalledOnce();
  });
});
