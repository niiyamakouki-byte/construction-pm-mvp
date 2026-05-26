/**
 * livestream-store.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  livestreamStore,
  _resetLivestreamStore,
} from "../livestream-store.js";
import { makeLivestreamSessionId } from "../types.js";
import type { LivestreamSession, OwnerNotificationPreference } from "../types.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

const defaultPrefs: OwnerNotificationPreference = {
  ownerName: "田中施主",
  projectId: "proj-001",
  channels: ["email"],
  digestFrequency: "immediate",
  quietHours: { start: "22:00", end: "07:00" },
};

function makeSession(id: string, projectId = "proj-001"): LivestreamSession {
  return {
    id: makeLivestreamSessionId(id),
    projectId,
    ownerName: "田中施主",
    posts: [],
    notificationPrefs: { ...defaultPrefs, projectId },
    totalDurationSec: 0,
    lastActivityAt: "2026-05-09T00:00:00.000Z",
  };
}

beforeEach(() => {
  localStorage.clear();
  _resetLivestreamStore();
});

describe("add / getAll", () => {
  it("追加したセッションが getAll で取得できる", () => {
    const s = makeSession("ls-1");
    livestreamStore.add(s);
    expect(livestreamStore.getAll()).toHaveLength(1);
  });

  it("複数追加できる", () => {
    livestreamStore.add(makeSession("ls-1"));
    livestreamStore.add(makeSession("ls-2"));
    expect(livestreamStore.getAll()).toHaveLength(2);
  });
});

describe("get", () => {
  it("IDで取得できる", () => {
    const s = makeSession("ls-1");
    livestreamStore.add(s);
    const found = livestreamStore.get(makeLivestreamSessionId("ls-1"));
    expect(found?.id).toBe("ls-1");
  });

  it("存在しないIDは null", () => {
    expect(livestreamStore.get(makeLivestreamSessionId("nonexistent"))).toBeNull();
  });
});

describe("update", () => {
  it("部分更新できる", () => {
    const s = makeSession("ls-1");
    livestreamStore.add(s);
    const updated = livestreamStore.update(makeLivestreamSessionId("ls-1"), {
      totalDurationSec: 300,
    });
    expect(updated?.totalDurationSec).toBe(300);
  });

  it("存在しないIDは null", () => {
    expect(livestreamStore.update(makeLivestreamSessionId("nonexistent"), {})).toBeNull();
  });
});

describe("remove", () => {
  it("削除後は getAll に含まれない", () => {
    const s = makeSession("ls-1");
    livestreamStore.add(s);
    livestreamStore.remove(makeLivestreamSessionId("ls-1"));
    expect(livestreamStore.getAll()).toHaveLength(0);
  });
});

describe("clear", () => {
  it("全件削除できる", () => {
    livestreamStore.add(makeSession("ls-1"));
    livestreamStore.add(makeSession("ls-2"));
    livestreamStore.clear();
    expect(livestreamStore.getAll()).toHaveLength(0);
  });
});

describe("subscribe", () => {
  it("add 時にリスナーが呼ばれる", () => {
    const listener = vi.fn();
    const unsubscribe = livestreamStore.subscribe(listener);
    livestreamStore.add(makeSession("ls-1"));
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("unsubscribe 後はリスナーが呼ばれない", () => {
    const listener = vi.fn();
    const unsubscribe = livestreamStore.subscribe(listener);
    unsubscribe();
    livestreamStore.add(makeSession("ls-1"));
    expect(listener).not.toHaveBeenCalled();
  });
});
