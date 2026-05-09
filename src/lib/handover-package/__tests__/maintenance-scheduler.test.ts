/**
 * maintenance-scheduler unit tests.
 */

import { describe, it, expect } from "vitest";
import {
  buildMaintenanceSchedule,
  upcomingMilestones,
  pastMilestones,
  nextMilestone,
  daysUntilMilestone,
  STANDARD_INSPECTION_PRESETS,
} from "../maintenance-scheduler.js";

const COMPLETED_AT = "2025-01-01T00:00:00.000Z";

describe("buildMaintenanceSchedule — standard presets", () => {
  it("全7プリセットで7件のマイルストーンが生成される", () => {
    const schedule = buildMaintenanceSchedule(COMPLETED_AT);
    expect(schedule).toHaveLength(7);
  });

  it("1ヶ月後の点検が 2025-02-01 付近になる", () => {
    const schedule = buildMaintenanceSchedule(COMPLETED_AT);
    const m1 = schedule.find((m) => m.intervalMonths === 1);
    expect(m1).toBeTruthy();
    const date = new Date(m1!.scheduledAt);
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(1); // February
  });

  it("12ヶ月後の点検が 2026-01-01 付近になる", () => {
    const schedule = buildMaintenanceSchedule(COMPLETED_AT);
    const m12 = schedule.find((m) => m.intervalMonths === 12);
    const date = new Date(m12!.scheduledAt);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(0); // January
  });

  it("24ヶ月後の点検が 2027-01-01 付近になる", () => {
    const schedule = buildMaintenanceSchedule(COMPLETED_AT);
    const m24 = schedule.find((m) => m.intervalMonths === 24);
    const date = new Date(m24!.scheduledAt);
    expect(date.getFullYear()).toBe(2027);
    expect(date.getMonth()).toBe(0);
  });

  it("10年後の点検が 2035-01-01 付近になる", () => {
    const schedule = buildMaintenanceSchedule(COMPLETED_AT);
    const m120 = schedule.find((m) => m.intervalMonths === 120);
    const date = new Date(m120!.scheduledAt);
    expect(date.getFullYear()).toBe(2035);
  });

  it("各マイルストーンに descriptionJa が設定されている", () => {
    const schedule = buildMaintenanceSchedule(COMPLETED_AT);
    for (const m of schedule) {
      expect(m.descriptionJa.length).toBeGreaterThan(0);
    }
  });
});

describe("buildMaintenanceSchedule — カスタムプリセット", () => {
  it("カスタムプリセットで指定件数のマイルストーンが生成される", () => {
    const custom = [
      { intervalMonths: 6, descriptionJa: "半年点検" },
      { intervalMonths: 12, descriptionJa: "年次点検" },
    ];
    const schedule = buildMaintenanceSchedule(COMPLETED_AT, custom);
    expect(schedule).toHaveLength(2);
  });

  it("空プリセットで空配列が返る", () => {
    const schedule = buildMaintenanceSchedule(COMPLETED_AT, []);
    expect(schedule).toHaveLength(0);
  });
});

describe("STANDARD_INSPECTION_PRESETS", () => {
  it("7種類のプリセットが定義されている", () => {
    expect(STANDARD_INSPECTION_PRESETS).toHaveLength(7);
  });

  it("intervalMonths 1, 3, 6, 12, 24, 60, 120 が含まれる", () => {
    const intervals = STANDARD_INSPECTION_PRESETS.map((p) => p.intervalMonths);
    expect(intervals).toContain(1);
    expect(intervals).toContain(3);
    expect(intervals).toContain(6);
    expect(intervals).toContain(12);
    expect(intervals).toContain(24);
    expect(intervals).toContain(60);
    expect(intervals).toContain(120);
  });
});

describe("upcomingMilestones", () => {
  it("未来の milestone のみを返す", () => {
    const schedule = buildMaintenanceSchedule("2020-01-01T00:00:00.000Z");
    const asOf = new Date("2025-01-01T00:00:00.000Z");
    const upcoming = upcomingMilestones(schedule, asOf);
    // All milestones from 2020 are in the past by 2025 (max is 10 years = 2030)
    const futureDates = upcoming.filter((m) => new Date(m.scheduledAt) > asOf);
    expect(futureDates).toHaveLength(upcoming.length);
  });

  it("全て過去の schedule は空配列を返す", () => {
    const pastSchedule = [
      { intervalMonths: 1, descriptionJa: "点検", scheduledAt: "2000-01-01T00:00:00.000Z" },
    ];
    const upcoming = upcomingMilestones(pastSchedule);
    expect(upcoming).toHaveLength(0);
  });
});

describe("pastMilestones", () => {
  it("過去の milestone のみを返す", () => {
    const pastSchedule = [
      { intervalMonths: 1, descriptionJa: "点検1", scheduledAt: "2000-01-01T00:00:00.000Z" },
      { intervalMonths: 2, descriptionJa: "点検2", scheduledAt: "2099-01-01T00:00:00.000Z" },
    ];
    const past = pastMilestones(pastSchedule);
    expect(past).toHaveLength(1);
    expect(past[0].scheduledAt).toBe("2000-01-01T00:00:00.000Z");
  });
});

describe("nextMilestone", () => {
  it("次回の点検を返す", () => {
    const schedule = [
      { intervalMonths: 1, descriptionJa: "1ヶ月", scheduledAt: "2030-02-01T00:00:00.000Z" },
      { intervalMonths: 3, descriptionJa: "3ヶ月", scheduledAt: "2030-04-01T00:00:00.000Z" },
    ];
    const asOf = new Date("2030-01-01T00:00:00.000Z");
    const next = nextMilestone(schedule, asOf);
    expect(next?.intervalMonths).toBe(1);
  });

  it("全て過去の場合は null を返す", () => {
    const pastSchedule = [
      { intervalMonths: 1, descriptionJa: "点検", scheduledAt: "2000-01-01T00:00:00.000Z" },
    ];
    expect(nextMilestone(pastSchedule)).toBeNull();
  });

  it("空の schedule は null を返す", () => {
    expect(nextMilestone([])).toBeNull();
  });
});

describe("daysUntilMilestone", () => {
  it("30日後の点検は 30 日を返す", () => {
    const asOf = new Date("2025-01-01T00:00:00.000Z");
    const milestone = {
      intervalMonths: 1,
      descriptionJa: "点検",
      scheduledAt: "2025-01-31T00:00:00.000Z",
    };
    const days = daysUntilMilestone(milestone, asOf);
    expect(days).toBe(30);
  });

  it("過去の点検は負の値を返す", () => {
    const asOf = new Date("2025-02-01T00:00:00.000Z");
    const milestone = {
      intervalMonths: 1,
      descriptionJa: "点検",
      scheduledAt: "2025-01-01T00:00:00.000Z",
    };
    const days = daysUntilMilestone(milestone, asOf);
    expect(days).toBeLessThan(0);
  });
});
