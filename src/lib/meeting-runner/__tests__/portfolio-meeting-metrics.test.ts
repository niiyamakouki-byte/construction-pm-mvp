/**
 * portfolio-meeting-metrics unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  meetingsThisMonth,
  avgUnresolvedItemsCount,
  mostActiveProjectId,
} from "../portfolio-meeting-metrics.js";
import { MeetingStore, _resetMeetingStore } from "../meeting-store.js";
import type { MeetingSession, MeetingMinutes } from "../types.js";
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
  const now = new Date();
  return {
    id: makeMeetingId(`m-${Math.random()}`),
    projectId: "proj-001",
    scheduledAt: now.toISOString(),
    kind: "weekly_progress",
    agendaItems: [],
    participants: ["新山"],
    ...overrides,
  };
}

function makeMinutes(unresolvedCount: number): MeetingMinutes {
  return {
    meetingId: makeMeetingId("m-x"),
    decisions: [],
    actionItems: [],
    unresolvedItems: Array.from({ length: unresolvedCount }, (_, i) => ({
      id: `u-${i}`,
      title: `未解決${i}`,
      source: "previous_unresolved" as const,
      priority: 3 as const,
      estimatedMinutes: 10,
      owner: "テスト",
      status: "deferred" as const,
    })),
  };
}

describe("meetingsThisMonth", () => {
  it("今月のセッション数を正しくカウントする", () => {
    const now = new Date();
    const s = new MeetingStore();
    s.save(makeSession({ scheduledAt: now.toISOString() }));
    s.save(makeSession({ scheduledAt: now.toISOString() }));
    expect(meetingsThisMonth()).toBe(2);
  });

  it("先月のセッションはカウントしない", () => {
    const s = new MeetingStore();
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    s.save(makeSession({ scheduledAt: lastMonth.toISOString() }));
    expect(meetingsThisMonth()).toBe(0);
  });

  it("セッションがなければ 0 を返す", () => {
    expect(meetingsThisMonth()).toBe(0);
  });
});

describe("avgUnresolvedItemsCount", () => {
  it("minutes のないセッションは除外する", () => {
    const s = new MeetingStore();
    s.save(makeSession()); // no minutes
    expect(avgUnresolvedItemsCount()).toBe(0);
  });

  it("未解決事項の平均を正しく計算する", () => {
    const s = new MeetingStore();
    s.save(makeSession({
      id: makeMeetingId("m-a1"),
      minutes: makeMinutes(2),
    }));
    s.save(makeSession({
      id: makeMeetingId("m-a2"),
      minutes: makeMinutes(4),
    }));
    expect(avgUnresolvedItemsCount()).toBe(3.0);
  });
});

describe("mostActiveProjectId", () => {
  it("最も会議が多いプロジェクトを返す", () => {
    const s = new MeetingStore();
    s.save(makeSession({ id: makeMeetingId("m1"), projectId: "proj-A" }));
    s.save(makeSession({ id: makeMeetingId("m2"), projectId: "proj-A" }));
    s.save(makeSession({ id: makeMeetingId("m3"), projectId: "proj-B" }));
    expect(mostActiveProjectId()).toBe("proj-A");
  });

  it("セッションがなければ null を返す", () => {
    expect(mostActiveProjectId()).toBeNull();
  });
});
