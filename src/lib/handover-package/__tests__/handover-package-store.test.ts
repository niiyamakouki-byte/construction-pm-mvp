/**
 * HandoverPackageStore unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { HandoverPackageStore, _resetHandoverPackageStore } from "../handover-package-store.js";
import type { HandoverPackage } from "../types.js";
import { makeHandoverPackageId } from "../types.js";

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
  _resetHandoverPackageStore();
});

function makePackage(overrides: Partial<HandoverPackage> = {}): HandoverPackage {
  return {
    id: makeHandoverPackageId("hp-test-1"),
    projectId: "proj-001",
    ownerName: "田中様",
    completedAt: new Date().toISOString(),
    status: "draft",
    documents: [],
    maintenanceSchedule: [],
    ...overrides,
  };
}

describe("HandoverPackageStore.save + get", () => {
  it("保存してIDで取得できる", () => {
    const s = new HandoverPackageStore();
    const pkg = makePackage({ id: makeHandoverPackageId("hp-abc") });
    s.save(pkg);
    expect(s.get(makeHandoverPackageId("hp-abc"))).not.toBeNull();
    expect(s.get(makeHandoverPackageId("hp-abc"))?.projectId).toBe("proj-001");
  });

  it("同じIDで save すると更新される", () => {
    const s = new HandoverPackageStore();
    s.save(makePackage({ status: "draft" }));
    s.save(makePackage({ status: "documents_collected" }));
    expect(s.listRecent()).toHaveLength(1);
    expect(s.listRecent()[0].status).toBe("documents_collected");
  });

  it("存在しないIDで get すると null を返す", () => {
    const s = new HandoverPackageStore();
    expect(s.get(makeHandoverPackageId("nonexistent"))).toBeNull();
  });
});

describe("HandoverPackageStore.listRecent", () => {
  it("新しい順に返す", () => {
    const s = new HandoverPackageStore();
    s.save(makePackage({ id: makeHandoverPackageId("hp-old"), completedAt: new Date(Date.now() - 60000).toISOString() }));
    s.save(makePackage({ id: makeHandoverPackageId("hp-new"), completedAt: new Date().toISOString() }));
    const list = s.listRecent();
    expect(list[0].id).toBe("hp-new");
  });

  it("limit で件数を絞れる", () => {
    const s = new HandoverPackageStore();
    for (let i = 0; i < 5; i++) {
      s.save(makePackage({ id: makeHandoverPackageId(`hp-${i}`) }));
    }
    expect(s.listRecent(3)).toHaveLength(3);
  });
});

describe("HandoverPackageStore.listByProject", () => {
  it("プロジェクトIDでフィルタリングできる", () => {
    const s = new HandoverPackageStore();
    s.save(makePackage({ id: makeHandoverPackageId("hp-p1"), projectId: "proj-001" }));
    s.save(makePackage({ id: makeHandoverPackageId("hp-p2"), projectId: "proj-002" }));
    expect(s.listByProject("proj-001")).toHaveLength(1);
    expect(s.listByProject("proj-002")).toHaveLength(1);
    expect(s.listByProject("proj-999")).toHaveLength(0);
  });
});

describe("HandoverPackageStore.listByStatus", () => {
  it("ステータスでフィルタリングできる", () => {
    const s = new HandoverPackageStore();
    s.save(makePackage({ id: makeHandoverPackageId("hp-draft"), status: "draft" }));
    s.save(makePackage({ id: makeHandoverPackageId("hp-docs"), status: "documents_collected" }));
    s.save(makePackage({ id: makeHandoverPackageId("hp-del"), status: "delivered" }));
    expect(s.listByStatus("draft")).toHaveLength(1);
    expect(s.listByStatus("documents_collected")).toHaveLength(1);
    expect(s.listByStatus("delivered")).toHaveLength(1);
    expect(s.listByStatus("archived")).toHaveLength(0);
  });
});

describe("HandoverPackageStore.delete", () => {
  it("削除するとリストから消える", () => {
    const s = new HandoverPackageStore();
    const id = makeHandoverPackageId("hp-del");
    s.save(makePackage({ id }));
    expect(s.get(id)).not.toBeNull();
    s.delete(id);
    expect(s.get(id)).toBeNull();
  });
});

describe("HandoverPackageStore.clearAll", () => {
  it("全件削除できる", () => {
    const s = new HandoverPackageStore();
    for (let i = 0; i < 3; i++) {
      s.save(makePackage({ id: makeHandoverPackageId(`hp-${i}`) }));
    }
    s.clearAll();
    expect(s.listRecent()).toHaveLength(0);
  });
});

describe("HandoverPackageStore.subscribe", () => {
  it("save で listener が呼ばれる", () => {
    const s = new HandoverPackageStore();
    const calls: number[] = [];
    const unsub = s.subscribe(() => calls.push(1));
    s.save(makePackage());
    expect(calls.length).toBe(1);
    unsub();
    s.save(makePackage({ id: makeHandoverPackageId("hp-2") }));
    expect(calls.length).toBe(1); // unsubscribed
  });

  it("delete で listener が呼ばれる", () => {
    const s = new HandoverPackageStore();
    const id = makeHandoverPackageId("hp-sub-del");
    s.save(makePackage({ id }));
    const calls: number[] = [];
    const unsub = s.subscribe(() => calls.push(1));
    s.delete(id);
    expect(calls.length).toBe(1);
    unsub();
  });

  it("clearAll で listener が呼ばれる", () => {
    const s = new HandoverPackageStore();
    s.save(makePackage());
    const calls: number[] = [];
    const unsub = s.subscribe(() => calls.push(1));
    s.clearAll();
    expect(calls.length).toBe(1);
    unsub();
  });
});

describe("HandoverPackageStore FIFO", () => {
  it("1000件を超えると古いものが削除される", () => {
    const s = new HandoverPackageStore();
    for (let i = 0; i < 1001; i++) {
      s.save(makePackage({ id: makeHandoverPackageId(`hp-${i}`) }));
    }
    // FIFO: first one should be gone
    expect(s.get(makeHandoverPackageId("hp-0"))).toBeNull();
  });
});

describe("HandoverPackageStore — documents and schedule persistence", () => {
  it("documents が保存・復元される", () => {
    const s = new HandoverPackageStore();
    const pkg = makePackage({
      id: makeHandoverPackageId("hp-doc"),
      documents: [
        {
          id: "doc-1",
          kind: "equipment_manual",
          titleJa: "エアコン取扱説明書",
        },
      ],
    });
    s.save(pkg);
    const loaded = s.get(makeHandoverPackageId("hp-doc"));
    expect(loaded?.documents).toHaveLength(1);
    expect(loaded?.documents[0].titleJa).toBe("エアコン取扱説明書");
  });

  it("maintenanceSchedule が保存・復元される", () => {
    const s = new HandoverPackageStore();
    const pkg = makePackage({
      id: makeHandoverPackageId("hp-sched"),
      maintenanceSchedule: [
        {
          intervalMonths: 1,
          descriptionJa: "1ヶ月点検",
          scheduledAt: new Date().toISOString(),
        },
      ],
    });
    s.save(pkg);
    const loaded = s.get(makeHandoverPackageId("hp-sched"));
    expect(loaded?.maintenanceSchedule).toHaveLength(1);
    expect(loaded?.maintenanceSchedule[0].intervalMonths).toBe(1);
  });
});
