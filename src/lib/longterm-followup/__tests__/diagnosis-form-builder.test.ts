/**
 * diagnosis-form-builder.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  buildFormForCheckpoint,
  getQuestionCountForKind,
  _resetFormCounter,
} from "../diagnosis-form-builder.js";
import {
  makeFollowupScheduleId,
  makeFollowupCheckpointId,
} from "../types.js";
import type { FollowupCheckpoint, CheckpointKind } from "../types.js";

const SCHEDULE_ID = makeFollowupScheduleId("sched-test");
const NOW = new Date("2026-05-09T10:00:00.000Z");

function makeCheckpoint(id: string, kind: CheckpointKind): FollowupCheckpoint {
  return {
    id: makeFollowupCheckpointId(id),
    scheduleId: SCHEDULE_ID,
    kind,
    status: "diagnosis_sent",
    scheduledDate: "2026-07-01T00:00:00.000Z",
    reminderDate: "2026-06-17T00:00:00.000Z",
    diagnosisDate: "2026-06-28T00:00:00.000Z",
  };
}

beforeEach(() => {
  _resetFormCounter();
});

describe("buildFormForCheckpoint", () => {
  it("3ヶ月点検フォームが生成される", () => {
    const cp = makeCheckpoint("chk-1", "three_month");
    const form = buildFormForCheckpoint(cp, NOW);
    expect(form.kind).toBe("three_month");
    expect(form.checkpointId).toBe("chk-1");
    expect(form.questions.length).toBeGreaterThanOrEqual(8);
  });

  it("1年点検フォームが生成される", () => {
    const cp = makeCheckpoint("chk-2", "one_year");
    const form = buildFormForCheckpoint(cp, NOW);
    expect(form.kind).toBe("one_year");
    expect(form.questions.length).toBeGreaterThanOrEqual(8);
  });

  it("3年点検フォームが生成される", () => {
    const cp = makeCheckpoint("chk-3", "three_year");
    const form = buildFormForCheckpoint(cp, NOW);
    expect(form.kind).toBe("three_year");
    expect(form.questions.length).toBeGreaterThanOrEqual(8);
  });

  it("5年点検フォームが生成される", () => {
    const cp = makeCheckpoint("chk-4", "five_year");
    const form = buildFormForCheckpoint(cp, NOW);
    expect(form.kind).toBe("five_year");
    expect(form.questions.length).toBeGreaterThanOrEqual(8);
  });

  it("10年点検フォームが生成される", () => {
    const cp = makeCheckpoint("chk-5", "ten_year");
    const form = buildFormForCheckpoint(cp, NOW);
    expect(form.kind).toBe("ten_year");
    expect(form.questions.length).toBeGreaterThanOrEqual(8);
  });

  it("すべての質問に questionJa と category が設定されている", () => {
    const cp = makeCheckpoint("chk-6", "five_year");
    const form = buildFormForCheckpoint(cp, NOW);
    for (const q of form.questions) {
      expect(q.questionJa).toBeTruthy();
      expect(q.category).toBeTruthy();
      expect(q.scale).toBe(5);
    }
  });

  it("フォームIDがユニーク", () => {
    const cp1 = makeCheckpoint("chk-7", "one_year");
    const cp2 = makeCheckpoint("chk-8", "five_year");
    const form1 = buildFormForCheckpoint(cp1, NOW);
    const form2 = buildFormForCheckpoint(cp2, NOW);
    expect(form1.id).not.toBe(form2.id);
  });

  it("createdAt が設定される", () => {
    const cp = makeCheckpoint("chk-9", "three_month");
    const form = buildFormForCheckpoint(cp, NOW);
    expect(form.createdAt).toBe(NOW.toISOString());
  });
});

describe("getQuestionCountForKind", () => {
  it("3ヶ月: 8問", () => expect(getQuestionCountForKind("three_month")).toBe(8));
  it("1年: 10問", () => expect(getQuestionCountForKind("one_year")).toBe(10));
  it("3年: 11問", () => expect(getQuestionCountForKind("three_year")).toBe(11));
  it("5年: 12問", () => expect(getQuestionCountForKind("five_year")).toBe(12));
  it("10年: 15問", () => expect(getQuestionCountForKind("ten_year")).toBe(15));
});
