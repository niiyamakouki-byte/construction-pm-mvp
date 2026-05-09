/**
 * checkpoint-scheduler.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  generateCheckpointsForHandover,
  getDaysForKind,
  REMINDER_LEAD_DAYS,
  DIAGNOSIS_LEAD_DAYS,
  _resetCheckpointCounter,
} from "../checkpoint-scheduler.js";
import { makeFollowupScheduleId } from "../types.js";

const SCHEDULE_ID = makeFollowupScheduleId("sched-test");
const HANDOVER_DATE = "2025-04-01T00:00:00.000Z";

beforeEach(() => {
  _resetCheckpointCounter();
});

describe("generateCheckpointsForHandover", () => {
  it("5つのチェックポイントが生成される", () => {
    const cps = generateCheckpointsForHandover(SCHEDULE_ID, HANDOVER_DATE);
    expect(cps).toHaveLength(5);
  });

  it("すべてのチェックポイントが scheduleId を持つ", () => {
    const cps = generateCheckpointsForHandover(SCHEDULE_ID, HANDOVER_DATE);
    for (const cp of cps) {
      expect(cp.scheduleId).toBe(SCHEDULE_ID);
    }
  });

  it("すべてのチェックポイントが scheduled ステータスで生成される", () => {
    const cps = generateCheckpointsForHandover(SCHEDULE_ID, HANDOVER_DATE);
    for (const cp of cps) {
      expect(cp.status).toBe("scheduled");
    }
  });

  it("3ヶ月点検は引渡日 + 90日", () => {
    const cps = generateCheckpointsForHandover(SCHEDULE_ID, HANDOVER_DATE);
    const threeMonth = cps.find((cp) => cp.kind === "three_month")!;
    const base = new Date(HANDOVER_DATE);
    const expected = new Date(base);
    expected.setDate(expected.getDate() + 90);
    expect(new Date(threeMonth.scheduledDate).toDateString()).toBe(expected.toDateString());
  });

  it("1年点検は引渡日 + 365日", () => {
    const cps = generateCheckpointsForHandover(SCHEDULE_ID, HANDOVER_DATE);
    const oneYear = cps.find((cp) => cp.kind === "one_year")!;
    const base = new Date(HANDOVER_DATE);
    const expected = new Date(base);
    expected.setDate(expected.getDate() + 365);
    expect(new Date(oneYear.scheduledDate).toDateString()).toBe(expected.toDateString());
  });

  it("3年点検は引渡日 + 1095日", () => {
    const cps = generateCheckpointsForHandover(SCHEDULE_ID, HANDOVER_DATE);
    const threeYear = cps.find((cp) => cp.kind === "three_year")!;
    const base = new Date(HANDOVER_DATE);
    const expected = new Date(base);
    expected.setDate(expected.getDate() + 1095);
    expect(new Date(threeYear.scheduledDate).toDateString()).toBe(expected.toDateString());
  });

  it("5年点検は引渡日 + 1825日", () => {
    const cps = generateCheckpointsForHandover(SCHEDULE_ID, HANDOVER_DATE);
    const fiveYear = cps.find((cp) => cp.kind === "five_year")!;
    const base = new Date(HANDOVER_DATE);
    const expected = new Date(base);
    expected.setDate(expected.getDate() + 1825);
    expect(new Date(fiveYear.scheduledDate).toDateString()).toBe(expected.toDateString());
  });

  it("10年点検は引渡日 + 3650日", () => {
    const cps = generateCheckpointsForHandover(SCHEDULE_ID, HANDOVER_DATE);
    const tenYear = cps.find((cp) => cp.kind === "ten_year")!;
    const base = new Date(HANDOVER_DATE);
    const expected = new Date(base);
    expected.setDate(expected.getDate() + 3650);
    expect(new Date(tenYear.scheduledDate).toDateString()).toBe(expected.toDateString());
  });

  it("リマインダー日は予定日の14日前", () => {
    const cps = generateCheckpointsForHandover(SCHEDULE_ID, HANDOVER_DATE);
    for (const cp of cps) {
      const scheduled = new Date(cp.scheduledDate);
      const reminder = new Date(cp.reminderDate);
      const diffDays = Math.round((scheduled.getTime() - reminder.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(REMINDER_LEAD_DAYS);
    }
  });

  it("診断フォーム送信日は予定日の3日前", () => {
    const cps = generateCheckpointsForHandover(SCHEDULE_ID, HANDOVER_DATE);
    for (const cp of cps) {
      const scheduled = new Date(cp.scheduledDate);
      const diagnosis = new Date(cp.diagnosisDate);
      const diffDays = Math.round((scheduled.getTime() - diagnosis.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(DIAGNOSIS_LEAD_DAYS);
    }
  });

  it("各チェックポイントがユニークなIDを持つ", () => {
    const cps = generateCheckpointsForHandover(SCHEDULE_ID, HANDOVER_DATE);
    const ids = cps.map((cp) => cp.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(5);
  });
});

describe("getDaysForKind", () => {
  it("three_month → 90", () => expect(getDaysForKind("three_month")).toBe(90));
  it("one_year → 365", () => expect(getDaysForKind("one_year")).toBe(365));
  it("three_year → 1095", () => expect(getDaysForKind("three_year")).toBe(1095));
  it("five_year → 1825", () => expect(getDaysForKind("five_year")).toBe(1825));
  it("ten_year → 3650", () => expect(getDaysForKind("ten_year")).toBe(3650));
});

describe("constants", () => {
  it("REMINDER_LEAD_DAYS は 14", () => expect(REMINDER_LEAD_DAYS).toBe(14));
  it("DIAGNOSIS_LEAD_DAYS は 3", () => expect(DIAGNOSIS_LEAD_DAYS).toBe(3));
});
