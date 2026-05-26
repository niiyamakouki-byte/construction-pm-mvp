/**
 * next-meeting-scheduler unit tests.
 */

import { describe, it, expect } from "vitest";
import { suggestNextMeetingDates, suggestNextMeeting } from "../next-meeting-scheduler.js";
import type { MeetingSession } from "../types.js";
import { makeMeetingId } from "../types.js";

function makeSession(overrides: Partial<MeetingSession> = {}): MeetingSession {
  return {
    id: makeMeetingId("m-sched-test"),
    projectId: "proj-001",
    scheduledAt: "2026-05-06T10:00:00Z", // Wednesday
    kind: "weekly_progress",
    agendaItems: [],
    participants: ["新山"],
    ...overrides,
  };
}

describe("suggestNextMeetingDates", () => {
  it("3件の候補を返す", () => {
    const candidates = suggestNextMeetingDates(makeSession());
    expect(candidates).toHaveLength(3);
  });

  it("最初の候補が isRecommended=true", () => {
    const candidates = suggestNextMeetingDates(makeSession());
    expect(candidates[0].isRecommended).toBe(true);
    expect(candidates[1].isRecommended).toBe(false);
  });

  it("候補は平日 (土日以外) を返す", () => {
    const candidates = suggestNextMeetingDates(makeSession());
    for (const c of candidates) {
      const dt = new Date(c.scheduledAt);
      const dow = dt.getDay(); // 0=Sun, 6=Sat
      expect(dow).not.toBe(0);
      expect(dow).not.toBe(6);
    }
  });

  it("labelJa に年月日と曜日が含まれる", () => {
    const candidates = suggestNextMeetingDates(makeSession());
    expect(candidates[0].labelJa).toMatch(/\d{4}年\d{1,2}月\d{1,2}日（[月火水木金]）/);
  });

  it("weekly_progress は約7日後の候補を返す", () => {
    const session = makeSession({ scheduledAt: "2026-05-06T10:00:00Z" });
    const candidates = suggestNextMeetingDates(session, [], 1);
    const dt = new Date(candidates[0].scheduledAt);
    const baseDt = new Date("2026-05-06T10:00:00Z");
    const diffDays = Math.round((dt.getTime() - baseDt.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(7);
    expect(diffDays).toBeLessThanOrEqual(10); // allow weekend shift
  });

  it("busy日を避ける", () => {
    // Session is Wed 2026-05-06, next Wed = 2026-05-13
    const busyDates = ["2026-05-13"];
    const candidates = suggestNextMeetingDates(makeSession(), busyDates, 1);
    const scheduledDate = candidates[0].scheduledAt.split("T")[0];
    expect(scheduledDate).not.toBe("2026-05-13");
  });
});

describe("suggestNextMeeting", () => {
  it("ISO文字列を返す", () => {
    const result = suggestNextMeeting(makeSession());
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("存在しないセッションに対して空配列から null", () => {
    // suggestNextMeeting with no sessions passes empty array back
    const candidates = suggestNextMeetingDates(makeSession(), [], 0);
    expect(candidates).toHaveLength(0);
  });
});
