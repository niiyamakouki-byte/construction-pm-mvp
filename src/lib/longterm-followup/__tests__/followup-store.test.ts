/**
 * followup-store.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  followupStore,
  _resetFollowupStore,
} from "../followup-store.js";
import { makeFollowupScheduleId, makeFollowupCheckpointId } from "../types.js";
import type { FollowupSchedule } from "../types.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

function makeSchedule(id: string, projectId = "proj-001"): FollowupSchedule {
  return {
    id: makeFollowupScheduleId(id),
    projectId,
    ownerId: "owner-001",
    handoverDate: "2025-04-01T00:00:00.000Z",
    registeredAt: "2025-04-01T00:00:00.000Z",
    checkpointIds: [makeFollowupCheckpointId("chk-1")],
    isActive: true,
  };
}

beforeEach(() => {
  localStorage.clear();
  _resetFollowupStore();
});

describe("add / getAll", () => {
  it("追加したスケジュールが getAll で取得できる", () => {
    const s = makeSchedule("sched-1");
    followupStore.add(s);
    expect(followupStore.getAll()).toHaveLength(1);
  });

  it("複数追加できる", () => {
    followupStore.add(makeSchedule("sched-1"));
    followupStore.add(makeSchedule("sched-2"));
    expect(followupStore.getAll()).toHaveLength(2);
  });

  it("getAll は新しい順に返す", () => {
    followupStore.add(makeSchedule("sched-1", "proj-001"));
    followupStore.add(makeSchedule("sched-2", "proj-002"));
    const all = followupStore.getAll();
    expect(all[0].projectId).toBe("proj-002");
  });
});

describe("get", () => {
  it("IDで取得できる", () => {
    const s = makeSchedule("sched-1");
    followupStore.add(s);
    const found = followupStore.get(makeFollowupScheduleId("sched-1"));
    expect(found?.id).toBe("sched-1");
  });

  it("存在しないIDは null", () => {
    expect(followupStore.get(makeFollowupScheduleId("nonexistent"))).toBeNull();
  });
});

describe("update", () => {
  it("部分更新できる", () => {
    const s = makeSchedule("sched-1");
    followupStore.add(s);
    const updated = followupStore.update(makeFollowupScheduleId("sched-1"), {
      isActive: false,
    });
    expect(updated?.isActive).toBe(false);
  });

  it("存在しないIDは null", () => {
    expect(followupStore.update(makeFollowupScheduleId("nonexistent"), {})).toBeNull();
  });

  it("更新後に getAll で変更が反映される", () => {
    followupStore.add(makeSchedule("sched-1"));
    followupStore.update(makeFollowupScheduleId("sched-1"), { isActive: false });
    const found = followupStore.get(makeFollowupScheduleId("sched-1"));
    expect(found?.isActive).toBe(false);
  });
});

describe("remove", () => {
  it("削除後は getAll に含まれない", () => {
    const s = makeSchedule("sched-1");
    followupStore.add(s);
    followupStore.remove(makeFollowupScheduleId("sched-1"));
    expect(followupStore.getAll()).toHaveLength(0);
  });
});

describe("clear", () => {
  it("全件削除できる", () => {
    followupStore.add(makeSchedule("sched-1"));
    followupStore.add(makeSchedule("sched-2"));
    followupStore.clear();
    expect(followupStore.getAll()).toHaveLength(0);
  });
});

describe("subscribe", () => {
  it("add 時にリスナーが呼ばれる", () => {
    const listener = vi.fn();
    const unsubscribe = followupStore.subscribe(listener);
    followupStore.add(makeSchedule("sched-1"));
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("unsubscribe 後はリスナーが呼ばれない", () => {
    const listener = vi.fn();
    const unsubscribe = followupStore.subscribe(listener);
    unsubscribe();
    followupStore.add(makeSchedule("sched-1"));
    expect(listener).not.toHaveBeenCalled();
  });

  it("update 時にリスナーが呼ばれる", () => {
    const listener = vi.fn();
    followupStore.add(makeSchedule("sched-1"));
    const unsubscribe = followupStore.subscribe(listener);
    followupStore.update(makeFollowupScheduleId("sched-1"), { isActive: false });
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("remove 時にリスナーが呼ばれる", () => {
    const listener = vi.fn();
    followupStore.add(makeSchedule("sched-1"));
    const unsubscribe = followupStore.subscribe(listener);
    followupStore.remove(makeFollowupScheduleId("sched-1"));
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });
});

describe("FIFO / persist", () => {
  it("localStorage に保存される", () => {
    followupStore.add(makeSchedule("sched-1"));
    const raw = localStorage.getItem("genbahub.longterm_followups");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
  });

  it("singleton: 別インスタンス参照でも同じデータ", () => {
    followupStore.add(makeSchedule("sched-1"));
    _resetFollowupStore();
    // Recreate via proxy — should reload from localStorage
    expect(followupStore.getAll()).toHaveLength(1);
  });
});
