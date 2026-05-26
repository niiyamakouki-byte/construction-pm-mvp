/**
 * degradation-analyzer.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  analyzeResponse,
  RENOVATION_THRESHOLD_SCORE,
  URGENT_CATEGORY_THRESHOLD,
} from "../degradation-analyzer.js";
import { buildFormForCheckpoint } from "../diagnosis-form-builder.js";
import {
  makeFollowupScheduleId,
  makeFollowupCheckpointId,
  makeDiagnosisFormId,
} from "../types.js";
import type { FollowupCheckpoint, DiagnosisResponse, DiagnosisForm } from "../types.js";

const SCHEDULE_ID = makeFollowupScheduleId("sched-test");
const NOW = new Date("2026-05-09T10:00:00.000Z");

function makeFiveYearCheckpoint(): FollowupCheckpoint {
  return {
    id: makeFollowupCheckpointId("chk-5yr"),
    scheduleId: SCHEDULE_ID,
    kind: "five_year",
    status: "diagnosis_sent",
    scheduledDate: "2030-04-01T00:00:00.000Z",
    reminderDate: "2030-03-18T00:00:00.000Z",
    diagnosisDate: "2030-03-29T00:00:00.000Z",
  };
}

function makeAllOkAnswers(form: DiagnosisForm): Record<string, number> {
  const answers: Record<string, number> = {};
  for (const q of form.questions) {
    answers[q.id] = 1; // 全て良好
  }
  return answers;
}

function makeAllBadAnswers(form: DiagnosisForm): Record<string, number> {
  const answers: Record<string, number> = {};
  for (const q of form.questions) {
    answers[q.id] = 5; // 全て要対処
  }
  return answers;
}

describe("analyzeResponse — 5年点検", () => {
  it("全問1 (良好) のとき overallScore は 0", () => {
    const cp = makeFiveYearCheckpoint();
    const form = buildFormForCheckpoint(cp, NOW);
    const answers = makeAllOkAnswers(form);
    const response: DiagnosisResponse = {
      formId: form.id,
      checkpointId: cp.id,
      answers,
      submittedAt: NOW.toISOString(),
    };
    const analysis = analyzeResponse(response, form);
    expect(analysis.overallScore).toBe(0);
  });

  it("全問5 (要対処) のとき overallScore は 100", () => {
    const cp = makeFiveYearCheckpoint();
    const form = buildFormForCheckpoint(cp, NOW);
    const answers = makeAllBadAnswers(form);
    const response: DiagnosisResponse = {
      formId: form.id,
      checkpointId: cp.id,
      answers,
      submittedAt: NOW.toISOString(),
    };
    const analysis = analyzeResponse(response, form);
    expect(analysis.overallScore).toBe(100);
  });

  it("全問5のとき urgentCategories に全カテゴリが含まれる", () => {
    const cp = makeFiveYearCheckpoint();
    const form = buildFormForCheckpoint(cp, NOW);
    const answers = makeAllBadAnswers(form);
    const response: DiagnosisResponse = {
      formId: form.id,
      checkpointId: cp.id,
      answers,
      submittedAt: NOW.toISOString(),
    };
    const analysis = analyzeResponse(response, form);
    expect(analysis.urgentCategories.length).toBeGreaterThan(0);
  });

  it("全問1のとき urgentCategories は空", () => {
    const cp = makeFiveYearCheckpoint();
    const form = buildFormForCheckpoint(cp, NOW);
    const answers = makeAllOkAnswers(form);
    const response: DiagnosisResponse = {
      formId: form.id,
      checkpointId: cp.id,
      answers,
      submittedAt: NOW.toISOString(),
    };
    const analysis = analyzeResponse(response, form);
    expect(analysis.urgentCategories).toHaveLength(0);
  });

  it("カテゴリスコアが 0-100 の範囲内", () => {
    const cp = makeFiveYearCheckpoint();
    const form = buildFormForCheckpoint(cp, NOW);
    const answers = makeAllBadAnswers(form);
    const response: DiagnosisResponse = {
      formId: form.id,
      checkpointId: cp.id,
      answers,
      submittedAt: NOW.toISOString(),
    };
    const analysis = analyzeResponse(response, form);
    for (const score of Object.values(analysis.categoryScores)) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it("中間スコア (3) のとき overallScore が 50 前後", () => {
    const cp = makeFiveYearCheckpoint();
    const form = buildFormForCheckpoint(cp, NOW);
    const answers: Record<string, number> = {};
    for (const q of form.questions) {
      answers[q.id] = 3;
    }
    const response: DiagnosisResponse = {
      formId: form.id,
      checkpointId: cp.id,
      answers,
      submittedAt: NOW.toISOString(),
    };
    const analysis = analyzeResponse(response, form);
    expect(analysis.overallScore).toBe(50);
  });

  it("回答のないカテゴリのスコアは 0", () => {
    const cp = makeFiveYearCheckpoint();
    const form = buildFormForCheckpoint(cp, NOW);
    // 回答を空にする
    const response: DiagnosisResponse = {
      formId: form.id,
      checkpointId: cp.id,
      answers: {},
      submittedAt: NOW.toISOString(),
    };
    const analysis = analyzeResponse(response, form);
    expect(analysis.overallScore).toBe(0);
  });
});

describe("定数確認", () => {
  it("RENOVATION_THRESHOLD_SCORE は 60", () => {
    expect(RENOVATION_THRESHOLD_SCORE).toBe(60);
  });

  it("URGENT_CATEGORY_THRESHOLD は 70", () => {
    expect(URGENT_CATEGORY_THRESHOLD).toBe(70);
  });
});

describe("analyzeResponse — 10年点検", () => {
  it("10年点検でも正常に動作する", () => {
    const cp: FollowupCheckpoint = {
      id: makeFollowupCheckpointId("chk-10yr"),
      scheduleId: SCHEDULE_ID,
      kind: "ten_year",
      status: "diagnosis_sent",
      scheduledDate: "2035-04-01T00:00:00.000Z",
      reminderDate: "2035-03-18T00:00:00.000Z",
      diagnosisDate: "2035-03-29T00:00:00.000Z",
    };
    const form = buildFormForCheckpoint(cp, NOW);
    const answers = makeAllBadAnswers(form);
    const response: DiagnosisResponse = {
      formId: form.id,
      checkpointId: cp.id,
      answers,
      submittedAt: NOW.toISOString(),
    };
    const analysis = analyzeResponse(response, form);
    expect(analysis.overallScore).toBe(100);
    expect(analysis.urgentCategories.length).toBeGreaterThan(0);
  });

  it("部分回答でもカテゴリスコアが算出される", () => {
    const cp: FollowupCheckpoint = {
      id: makeFollowupCheckpointId("chk-10yr-2"),
      scheduleId: SCHEDULE_ID,
      kind: "ten_year",
      status: "diagnosis_sent",
      scheduledDate: "2035-04-01T00:00:00.000Z",
      reminderDate: "2035-03-18T00:00:00.000Z",
      diagnosisDate: "2035-03-29T00:00:00.000Z",
    };
    const form = buildFormForCheckpoint(cp, NOW);
    // 最初の3問だけ回答
    const answers: Record<string, number> = {};
    for (const q of form.questions.slice(0, 3)) {
      answers[q.id] = 5;
    }
    const response: DiagnosisResponse = {
      formId: form.id,
      checkpointId: cp.id,
      answers,
      submittedAt: NOW.toISOString(),
    };
    const analysis = analyzeResponse(response, form);
    expect(analysis.overallScore).toBeGreaterThan(0);
  });
});
