import { describe, expect, it } from "vitest";
import type { GoogleCalendarEvent } from "./google-calendar.js";
import { detectScheduleConflicts, hasPersonalEventOn } from "./schedule-conflict.js";

function timedEvent(id: string, startIso: string, endIso: string): GoogleCalendarEvent {
  return {
    id,
    summary: `event-${id}`,
    start: new Date(startIso),
    end: new Date(endIso),
    allDay: false,
  };
}

function allDayEvent(id: string, start: string, endExclusive: string): GoogleCalendarEvent {
  return {
    id,
    summary: `event-${id}`,
    start: new Date(`${start}T00:00:00`),
    end: new Date(`${endExclusive}T00:00:00`),
    allDay: true,
  };
}

describe("detectScheduleConflicts", () => {
  it("重なるタスクとイベントを検出する", () => {
    const events = [timedEvent("ev1", "2025-07-10T10:00:00+09:00", "2025-07-10T11:00:00+09:00")];
    const tasks = [
      { id: "task-A", startDate: "2025-07-10", endDate: "2025-07-12" },
      { id: "task-B", startDate: "2025-07-15", endDate: "2025-07-16" },
    ];
    const result = detectScheduleConflicts(events, tasks);

    expect(Object.keys(result.conflictsByTaskId)).toEqual(["task-A"]);
    expect(result.conflictsByTaskId["task-A"][0].id).toBe("ev1");
    expect(result.busyDates.has("2025-07-10")).toBe(true);
  });

  it("重ならないイベントは conflictsByTaskId に出ない", () => {
    const events = [timedEvent("ev1", "2025-07-01T10:00:00+09:00", "2025-07-01T11:00:00+09:00")];
    const tasks = [{ id: "task-A", startDate: "2025-07-10", endDate: "2025-07-12" }];
    const result = detectScheduleConflicts(events, tasks);

    expect(result.conflictsByTaskId).toEqual({});
    expect(result.busyDates.has("2025-07-01")).toBe(true);
  });

  it("境界日（タスク終了日とイベント開始日が同じ）で重なる", () => {
    const events = [timedEvent("ev1", "2025-07-12T09:00:00+09:00", "2025-07-12T10:00:00+09:00")];
    const tasks = [{ id: "task-A", startDate: "2025-07-10", endDate: "2025-07-12" }];
    const result = detectScheduleConflicts(events, tasks);

    expect(result.conflictsByTaskId["task-A"]).toHaveLength(1);
  });

  it("終日イベント(end exclusive)を複数日占有として展開する", () => {
    // 2025-07-20 から 22 の終日 → 20, 21 を占有（22は exclusive）
    const events = [allDayEvent("vac", "2025-07-20", "2025-07-22")];
    const tasks = [
      { id: "task-21", startDate: "2025-07-21", endDate: "2025-07-21" },
      { id: "task-22", startDate: "2025-07-22", endDate: "2025-07-22" },
    ];
    const result = detectScheduleConflicts(events, tasks);

    expect(result.conflictsByTaskId["task-21"]).toBeDefined();
    expect(result.conflictsByTaskId["task-22"]).toBeUndefined();
  });

  it("startDate のみのタスクは1日扱い", () => {
    const events = [timedEvent("ev1", "2025-07-10T10:00:00+09:00", "2025-07-10T11:00:00+09:00")];
    const tasks = [{ id: "single", startDate: "2025-07-10", endDate: null }];
    const result = detectScheduleConflicts(events, tasks);

    expect(result.conflictsByTaskId["single"]).toHaveLength(1);
  });

  it("hasPersonalEventOn でその日に予定があるか分かる", () => {
    const events = [timedEvent("ev1", "2025-07-10T10:00:00+09:00", "2025-07-10T11:00:00+09:00")];
    const result = detectScheduleConflicts(events, []);
    expect(hasPersonalEventOn(result, "2025-07-10")).toBe(true);
    expect(hasPersonalEventOn(result, "2025-07-11")).toBe(false);
  });
});
