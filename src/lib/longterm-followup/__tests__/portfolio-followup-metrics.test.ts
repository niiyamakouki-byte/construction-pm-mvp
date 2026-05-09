/**
 * portfolio-followup-metrics.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  activeFollowupSchedules,
  upcomingCheckpointsNext30Days,
  urgentRenovationLeadsCount,
  avgDegradationScoreByYear,
} from "../portfolio-followup-metrics.js";
import {
  registerFollowup,
  markDiagnosisSent,
  submitDiagnosisResponse,
  _resetFollowupFacade,
} from "../followup-facade.js";
import { _resetFollowupStore } from "../followup-store.js";
import { _resetCheckpointCounter } from "../checkpoint-scheduler.js";
import { _resetFormCounter } from "../diagnosis-form-builder.js";
import { _resetLeadCounter } from "../renovation-lead-generator.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

const NOW = new Date("2026-05-09T10:00:00.000Z");

beforeEach(() => {
  localStorage.clear();
  _resetFollowupStore();
  _resetFollowupFacade();
  _resetCheckpointCounter();
  _resetFormCounter();
  _resetLeadCounter();
});

describe("activeFollowupSchedules", () => {
  it("スケジュールがない場合は 0", () => {
    expect(activeFollowupSchedules()).toBe(0);
  });

  it("登録後に件数が増える", () => {
    registerFollowup("proj-001", "owner-001", "2025-04-01T00:00:00.000Z", NOW);
    registerFollowup("proj-002", "owner-002", "2025-06-01T00:00:00.000Z", NOW);
    expect(activeFollowupSchedules()).toBe(2);
  });
});

describe("upcomingCheckpointsNext30Days", () => {
  it("スケジュールがない場合は 0", () => {
    expect(upcomingCheckpointsNext30Days(NOW)).toBe(0);
  });

  it("3ヶ月後の点検日までのチェックポイントは範囲外", () => {
    // 引渡日が NOW の場合、3ヶ月 = 90日後なので30日以内には含まれない
    registerFollowup("proj-001", "owner-001", NOW.toISOString(), NOW);
    expect(upcomingCheckpointsNext30Days(NOW)).toBe(0);
  });
});

describe("urgentRenovationLeadsCount", () => {
  it("リードがない場合は 0", () => {
    expect(urgentRenovationLeadsCount()).toBe(0);
  });

  it("urgent リードが追加されると件数が増える", () => {
    const { checkpoints } = registerFollowup("proj-001", "owner-001", "2025-04-01T00:00:00.000Z", NOW);
    const fiveYearCp = checkpoints.find((cp) => cp.kind === "five_year")!;
    const diagResult = markDiagnosisSent(fiveYearCp.id, NOW)!;
    const answers: Record<string, number> = {};
    for (const q of diagResult.form.questions) answers[q.id] = 5; // → urgent
    submitDiagnosisResponse(fiveYearCp.id, answers, NOW);

    expect(urgentRenovationLeadsCount()).toBe(1);
  });
});

describe("avgDegradationScoreByYear", () => {
  it("リードがない場合はすべて 0", () => {
    const scores = avgDegradationScoreByYear();
    expect(scores[1]).toBe(0);
    expect(scores[3]).toBe(0);
    expect(scores[5]).toBe(0);
    expect(scores[10]).toBe(0);
  });

  it("1年点検リードがある場合にスコアが設定される", () => {
    const { checkpoints } = registerFollowup("proj-001", "owner-001", "2025-04-01T00:00:00.000Z", NOW);
    const oneYearCp = checkpoints.find((cp) => cp.kind === "one_year")!;
    const diagResult = markDiagnosisSent(oneYearCp.id, NOW)!;
    const answers: Record<string, number> = {};
    for (const q of diagResult.form.questions) answers[q.id] = 3; // overallScore = 50
    submitDiagnosisResponse(oneYearCp.id, answers, NOW);

    const scores = avgDegradationScoreByYear();
    expect(scores[1]).toBe(50);
  });
});
