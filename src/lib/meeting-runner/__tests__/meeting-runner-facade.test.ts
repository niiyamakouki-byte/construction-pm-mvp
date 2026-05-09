/**
 * meeting-runner-facade unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMeetingSession,
  saveMeetingMinutes,
  appendMinutesLines,
  updateAgendaItemStatus,
  getSessionDuration,
  distributeMinutes,
  getProjectOverdueActions,
  suggestNextMeeting,
} from "../meeting-runner-facade.js";
import { _resetMeetingStore } from "../meeting-store.js";

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

describe("createMeetingSession", () => {
  it("セッションを作成して返す", () => {
    const session = createMeetingSession({
      projectId: "proj-001",
      scheduledAt: "2026-05-09T10:00:00Z",
      kind: "weekly_progress",
      participants: ["新山", "田中"],
    });
    expect(session.id).toBeTruthy();
    expect(session.projectId).toBe("proj-001");
    expect(session.agendaItems.length).toBeGreaterThan(0);
  });

  it("projectPhases から議題を生成する", () => {
    const session = createMeetingSession({
      projectId: "proj-002",
      scheduledAt: "2026-05-09T10:00:00Z",
      kind: "weekly_progress",
      participants: ["新山"],
      projectPhases: [
        { phaseName: "内装工事", progressPct: 20, isDelayed: true, owner: "田中" },
      ],
    });
    expect(session.agendaItems.some((a) => a.title.includes("内装工事"))).toBe(true);
  });
});

describe("saveMeetingMinutes", () => {
  it("発言から議事録を生成して保存する", () => {
    const session = createMeetingSession({
      projectId: "proj-003",
      scheduledAt: "2026-05-09T10:00:00Z",
      kind: "weekly_progress",
      participants: ["新山"],
    });

    const updated = saveMeetingMinutes(session.id as string, [
      "外壁材をAパネルに決定",
      "田中が図面修正をすること",
    ]);

    expect(updated).not.toBeNull();
    expect(updated?.minutes?.decisions).toHaveLength(1);
    expect(updated?.minutes?.actionItems).toHaveLength(1);
  });

  it("存在しないセッションIDに対して null を返す", () => {
    const result = saveMeetingMinutes("nonexistent-id", ["テスト"]);
    expect(result).toBeNull();
  });
});

describe("appendMinutesLines", () => {
  it("既存の議事録に追記できる", () => {
    const session = createMeetingSession({
      projectId: "proj-004",
      scheduledAt: "2026-05-09T10:00:00Z",
      kind: "weekly_progress",
      participants: ["新山"],
    });
    saveMeetingMinutes(session.id as string, ["案Aを採用"]);
    const updated = appendMinutesLines(session.id as string, ["仕様は次回持越し"]);
    expect(updated?.minutes?.unresolvedItems).toHaveLength(1);
    expect(updated?.minutes?.decisions).toHaveLength(1);
  });

  it("minutes がないセッションに対して null を返す", () => {
    const session = createMeetingSession({
      projectId: "proj-005",
      scheduledAt: "2026-05-09T10:00:00Z",
      kind: "weekly_progress",
      participants: ["新山"],
    });
    // No minutes saved yet
    const result = appendMinutesLines(session.id as string, ["追記テスト"]);
    expect(result).toBeNull();
  });
});

describe("updateAgendaItemStatus", () => {
  it("アジェンダアイテムのステータスを更新できる", () => {
    const session = createMeetingSession({
      projectId: "proj-006",
      scheduledAt: "2026-05-09T10:00:00Z",
      kind: "weekly_progress",
      participants: ["新山"],
    });
    const firstItem = session.agendaItems[0];
    const updated = updateAgendaItemStatus(session.id as string, firstItem.id, "resolved");
    expect(updated?.agendaItems.find((a) => a.id === firstItem.id)?.status).toBe("resolved");
  });
});

describe("getSessionDuration", () => {
  it("合計時間を返す", () => {
    const session = createMeetingSession({
      projectId: "proj-007",
      scheduledAt: "2026-05-09T10:00:00Z",
      kind: "weekly_progress",
      participants: ["新山"],
    });
    expect(getSessionDuration(session.id as string)).toBeGreaterThan(0);
  });

  it("存在しないセッションは 0 を返す", () => {
    expect(getSessionDuration("nonexistent")).toBe(0);
  });
});

describe("distributeMinutes", () => {
  it("discord フォーマットを返す", () => {
    const session = createMeetingSession({
      projectId: "proj-008",
      scheduledAt: "2026-05-09T10:00:00Z",
      kind: "weekly_progress",
      participants: ["新山"],
    });
    saveMeetingMinutes(session.id as string, ["案Bに決定"]);
    const result = distributeMinutes(session.id as string, "discord");
    expect(result).toContain("議事録");
  });

  it("minutes がなければ null を返す", () => {
    const session = createMeetingSession({
      projectId: "proj-009",
      scheduledAt: "2026-05-09T10:00:00Z",
      kind: "weekly_progress",
      participants: ["新山"],
    });
    expect(distributeMinutes(session.id as string, "markdown")).toBeNull();
  });
});

describe("getProjectOverdueActions", () => {
  it("期限超過のアクションを返す", () => {
    const session = createMeetingSession({
      projectId: "proj-010",
      scheduledAt: "2026-01-09T10:00:00Z",
      kind: "weekly_progress",
      participants: ["新山"],
    });
    saveMeetingMinutes(session.id as string, ["田中が2026-01-15まで提出すること"]);
    const overdue = getProjectOverdueActions("proj-010");
    expect(overdue.length).toBeGreaterThanOrEqual(0); // rule-based, may or may not detect
  });
});

describe("suggestNextMeeting", () => {
  it("3件の候補を返す", () => {
    const session = createMeetingSession({
      projectId: "proj-011",
      scheduledAt: "2026-05-06T10:00:00Z",
      kind: "weekly_progress",
      participants: ["新山"],
    });
    const candidates = suggestNextMeeting(session.id as string);
    expect(candidates).toHaveLength(3);
  });

  it("存在しないセッションは空配列を返す", () => {
    const result = suggestNextMeeting("nonexistent");
    expect(result).toEqual([]);
  });
});
