/**
 * MeetingStore unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MeetingStore, _resetMeetingStore } from "../meeting-store.js";
import type { MeetingSession } from "../types.js";
import { makeMeetingId } from "../types.js";

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
  _resetMeetingStore();
});

function makeSession(overrides: Partial<MeetingSession> = {}): MeetingSession {
  return {
    id: makeMeetingId("meeting-test-1"),
    projectId: "proj-001",
    scheduledAt: new Date().toISOString(),
    kind: "weekly_progress",
    agendaItems: [],
    participants: ["新山"],
    ...overrides,
  };
}

describe("MeetingStore.save + get", () => {
  it("保存してIDで取得できる", () => {
    const s = new MeetingStore();
    const session = makeSession({ id: makeMeetingId("m-abc") });
    s.save(session);
    expect(s.get(makeMeetingId("m-abc"))).not.toBeNull();
    expect(s.get(makeMeetingId("m-abc"))?.projectId).toBe("proj-001");
  });

  it("同じIDで save すると更新される", () => {
    const s = new MeetingStore();
    s.save(makeSession({ participants: ["田中"] }));
    s.save(makeSession({ participants: ["鈴木"] }));
    expect(s.listRecent()).toHaveLength(1);
    expect(s.listRecent()[0].participants).toEqual(["鈴木"]);
  });
});

describe("MeetingStore.listRecent", () => {
  it("新しい順に返す", () => {
    const s = new MeetingStore();
    const old = makeSession({ id: makeMeetingId("m-old"), scheduledAt: new Date(Date.now() - 60000).toISOString() });
    const fresh = makeSession({ id: makeMeetingId("m-fresh"), scheduledAt: new Date().toISOString() });
    s.save(old);
    s.save(fresh);
    const list = s.listRecent();
    expect(list[0].id).toBe("m-fresh");
  });

  it("limit で件数を絞れる", () => {
    const s = new MeetingStore();
    for (let i = 0; i < 5; i++) {
      s.save(makeSession({ id: makeMeetingId(`m-${i}`) }));
    }
    expect(s.listRecent(3)).toHaveLength(3);
  });
});

describe("MeetingStore.listByProject", () => {
  it("プロジェクトIDでフィルタリングできる", () => {
    const s = new MeetingStore();
    s.save(makeSession({ id: makeMeetingId("m-p1"), projectId: "proj-001" }));
    s.save(makeSession({ id: makeMeetingId("m-p2"), projectId: "proj-002" }));
    expect(s.listByProject("proj-001")).toHaveLength(1);
    expect(s.listByProject("proj-001")[0].id).toBe("m-p1");
  });
});

describe("MeetingStore.latestForProject", () => {
  it("最新セッションを返す", () => {
    const s = new MeetingStore();
    const older = makeSession({
      id: makeMeetingId("m-older"),
      projectId: "proj-001",
      scheduledAt: new Date("2026-01-01").toISOString(),
    });
    const newer = makeSession({
      id: makeMeetingId("m-newer"),
      projectId: "proj-001",
      scheduledAt: new Date("2026-02-01").toISOString(),
    });
    s.save(older);
    s.save(newer);
    expect(s.latestForProject("proj-001")?.id).toBe("m-newer");
  });

  it("プロジェクトが存在しない場合 null を返す", () => {
    const s = new MeetingStore();
    expect(s.latestForProject("proj-none")).toBeNull();
  });
});

describe("MeetingStore.delete", () => {
  it("IDを指定して削除できる", () => {
    const s = new MeetingStore();
    s.save(makeSession({ id: makeMeetingId("m-del") }));
    s.delete(makeMeetingId("m-del"));
    expect(s.get(makeMeetingId("m-del"))).toBeNull();
  });
});

describe("MeetingStore FIFO 1000件", () => {
  it("1001件目を追加すると最古が削除される", () => {
    const s = new MeetingStore();
    for (let i = 1; i <= 1000; i++) {
      s.save(makeSession({ id: makeMeetingId(`m-${i.toString().padStart(4, "0")}`) }));
    }
    s.save(makeSession({ id: makeMeetingId("m-1001") }));
    expect(s.listRecent(1000).length).toBeLessThanOrEqual(1000);
    expect(s.get(makeMeetingId("m-0001"))).toBeNull();
  });
});

describe("MeetingStore.clearAll", () => {
  it("全件削除できる", () => {
    const s = new MeetingStore();
    s.save(makeSession());
    s.clearAll();
    expect(s.listRecent()).toHaveLength(0);
  });
});

describe("MeetingStore.subscribe", () => {
  it("save 後にリスナーが呼ばれる", () => {
    const s = new MeetingStore();
    const listener = vi.fn();
    s.subscribe(listener);
    s.save(makeSession());
    expect(listener).toHaveBeenCalledOnce();
  });

  it("delete 後にリスナーが呼ばれる", () => {
    const s = new MeetingStore();
    s.save(makeSession({ id: makeMeetingId("del-1") }));
    const listener = vi.fn();
    s.subscribe(listener);
    s.delete(makeMeetingId("del-1"));
    expect(listener).toHaveBeenCalledOnce();
  });

  it("購読解除するとリスナーが呼ばれなくなる", () => {
    const s = new MeetingStore();
    const listener = vi.fn();
    const unsubscribe = s.subscribe(listener);
    unsubscribe();
    s.save(makeSession({ id: makeMeetingId("m-unsub") }));
    expect(listener).not.toHaveBeenCalled();
  });
});
