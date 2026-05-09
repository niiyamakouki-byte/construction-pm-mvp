/**
 * ChangeOrderStore unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChangeOrderStore, _resetChangeOrderStore } from "../change-order-store.js";
import type { ChangeOrder } from "../types.js";
import { makeChangeOrderId } from "../types.js";

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
  _resetChangeOrderStore();
});

function makeOrder(overrides: Partial<ChangeOrder> = {}): ChangeOrder {
  return {
    id: makeChangeOrderId("co-test-1"),
    projectId: "proj-001",
    kind: "addition",
    status: "requested",
    descriptionJa: "キッチン追加工事",
    requestedBy: "田中様",
    requestedAt: new Date().toISOString(),
    approvalRecords: [],
    ...overrides,
  };
}

describe("ChangeOrderStore.save + get", () => {
  it("保存してIDで取得できる", () => {
    const s = new ChangeOrderStore();
    const order = makeOrder({ id: makeChangeOrderId("co-abc") });
    s.save(order);
    expect(s.get(makeChangeOrderId("co-abc"))).not.toBeNull();
    expect(s.get(makeChangeOrderId("co-abc"))?.projectId).toBe("proj-001");
  });

  it("同じIDで save すると更新される", () => {
    const s = new ChangeOrderStore();
    s.save(makeOrder({ status: "requested" }));
    s.save(makeOrder({ status: "estimating" }));
    expect(s.listRecent()).toHaveLength(1);
    expect(s.listRecent()[0].status).toBe("estimating");
  });

  it("存在しないIDで get すると null を返す", () => {
    const s = new ChangeOrderStore();
    expect(s.get(makeChangeOrderId("nonexistent"))).toBeNull();
  });
});

describe("ChangeOrderStore.listRecent", () => {
  it("新しい順に返す", () => {
    const s = new ChangeOrderStore();
    s.save(makeOrder({ id: makeChangeOrderId("co-old"), requestedAt: new Date(Date.now() - 60000).toISOString() }));
    s.save(makeOrder({ id: makeChangeOrderId("co-new"), requestedAt: new Date().toISOString() }));
    const list = s.listRecent();
    expect(list[0].id).toBe("co-new");
  });

  it("limit で件数を絞れる", () => {
    const s = new ChangeOrderStore();
    for (let i = 0; i < 5; i++) {
      s.save(makeOrder({ id: makeChangeOrderId(`co-${i}`) }));
    }
    expect(s.listRecent(3)).toHaveLength(3);
  });
});

describe("ChangeOrderStore.listByProject", () => {
  it("プロジェクトIDでフィルタリングできる", () => {
    const s = new ChangeOrderStore();
    s.save(makeOrder({ id: makeChangeOrderId("co-p1"), projectId: "proj-001" }));
    s.save(makeOrder({ id: makeChangeOrderId("co-p2"), projectId: "proj-002" }));
    expect(s.listByProject("proj-001")).toHaveLength(1);
    expect(s.listByProject("proj-002")).toHaveLength(1);
    expect(s.listByProject("proj-999")).toHaveLength(0);
  });
});

describe("ChangeOrderStore.listByStatus", () => {
  it("ステータスでフィルタリングできる", () => {
    const s = new ChangeOrderStore();
    s.save(makeOrder({ id: makeChangeOrderId("co-req"), status: "requested" }));
    s.save(makeOrder({ id: makeChangeOrderId("co-est"), status: "estimating" }));
    s.save(makeOrder({ id: makeChangeOrderId("co-app"), status: "approved" }));
    expect(s.listByStatus("requested")).toHaveLength(1);
    expect(s.listByStatus("estimating")).toHaveLength(1);
    expect(s.listByStatus("approved")).toHaveLength(1);
    expect(s.listByStatus("rejected")).toHaveLength(0);
  });
});

describe("ChangeOrderStore.delete", () => {
  it("削除するとリストから消える", () => {
    const s = new ChangeOrderStore();
    const id = makeChangeOrderId("co-del");
    s.save(makeOrder({ id }));
    expect(s.get(id)).not.toBeNull();
    s.delete(id);
    expect(s.get(id)).toBeNull();
  });
});

describe("ChangeOrderStore.clearAll", () => {
  it("全件削除できる", () => {
    const s = new ChangeOrderStore();
    for (let i = 0; i < 3; i++) {
      s.save(makeOrder({ id: makeChangeOrderId(`co-${i}`) }));
    }
    s.clearAll();
    expect(s.listRecent()).toHaveLength(0);
  });
});

describe("ChangeOrderStore.subscribe", () => {
  it("save で listener が呼ばれる", () => {
    const s = new ChangeOrderStore();
    const calls: number[] = [];
    const unsub = s.subscribe(() => calls.push(1));
    s.save(makeOrder());
    expect(calls.length).toBe(1);
    unsub();
    s.save(makeOrder({ id: makeChangeOrderId("co-2") }));
    expect(calls.length).toBe(1); // unsubscribed
  });
});

describe("ChangeOrderStore FIFO", () => {
  it("1000件を超えると古いものが削除される", () => {
    const s = new ChangeOrderStore();
    for (let i = 0; i < 1001; i++) {
      s.save(makeOrder({ id: makeChangeOrderId(`co-${i}`) }));
    }
    // FIFO: first one should be gone
    expect(s.get(makeChangeOrderId("co-0"))).toBeNull();
  });
});
