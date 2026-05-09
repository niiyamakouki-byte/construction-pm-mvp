/**
 * followup-facade.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  registerFollowup,
  markReminderSent,
  markDiagnosisSent,
  submitDiagnosisResponse,
  listSchedules,
  getSchedule,
  listCheckpoints,
  getCheckpoint,
  getDiagnosisForm,
  getActiveLeadsByPotential,
  listAllLeads,
  getUpcomingCheckpoints,
  _resetFollowupFacade,
} from "../followup-facade.js";
import { _resetFollowupStore } from "../followup-store.js";
import { _resetCheckpointCounter } from "../checkpoint-scheduler.js";
import { _resetFormCounter } from "../diagnosis-form-builder.js";
import { _resetLeadCounter } from "../renovation-lead-generator.js";
import { makeFollowupCheckpointId } from "../types.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

// KDX南青山施主シナリオ: 引渡2025-04-01
const KDX_HANDOVER = "2025-04-01T00:00:00.000Z";
const KDX_PROJECT = "kdx-minami-aoyama";
const KDX_OWNER = "suzuki-owner";
const NOW = new Date("2026-05-09T10:00:00.000Z");

// 5年後: 2030-03-31
const NOW_5YR = new Date("2030-04-10T10:00:00.000Z");

beforeEach(() => {
  localStorage.clear();
  _resetFollowupStore();
  _resetFollowupFacade();
  _resetCheckpointCounter();
  _resetFormCounter();
  _resetLeadCounter();
});

describe("registerFollowup", () => {
  it("スケジュールとチェックポイントが生成される", () => {
    const { schedule, checkpoints } = registerFollowup(KDX_PROJECT, KDX_OWNER, KDX_HANDOVER, NOW);
    expect(schedule.projectId).toBe(KDX_PROJECT);
    expect(schedule.ownerId).toBe(KDX_OWNER);
    expect(checkpoints).toHaveLength(5);
  });

  it("スケジュールがストアに保存される", () => {
    const { schedule } = registerFollowup(KDX_PROJECT, KDX_OWNER, KDX_HANDOVER, NOW);
    expect(getSchedule(schedule.id)).not.toBeNull();
  });

  it("listSchedules に含まれる", () => {
    registerFollowup(KDX_PROJECT, KDX_OWNER, KDX_HANDOVER, NOW);
    expect(listSchedules()).toHaveLength(1);
  });

  it("5つの CheckpointKind がすべて生成される", () => {
    const { checkpoints } = registerFollowup(KDX_PROJECT, KDX_OWNER, KDX_HANDOVER, NOW);
    const kinds = checkpoints.map((cp) => cp.kind);
    expect(kinds).toContain("three_month");
    expect(kinds).toContain("one_year");
    expect(kinds).toContain("three_year");
    expect(kinds).toContain("five_year");
    expect(kinds).toContain("ten_year");
  });
});

describe("markReminderSent", () => {
  it("ステータスが reminder_sent に変わる", () => {
    const { checkpoints } = registerFollowup(KDX_PROJECT, KDX_OWNER, KDX_HANDOVER, NOW);
    const cp = checkpoints[0];
    const updated = markReminderSent(cp.id, NOW);
    expect(updated?.status).toBe("reminder_sent");
  });

  it("存在しないIDは null", () => {
    expect(markReminderSent(makeFollowupCheckpointId("nonexistent"))).toBeNull();
  });
});

describe("markDiagnosisSent", () => {
  it("ステータスが diagnosis_sent になりフォームが生成される", () => {
    const { checkpoints } = registerFollowup(KDX_PROJECT, KDX_OWNER, KDX_HANDOVER, NOW);
    const cp = checkpoints[0];
    const result = markDiagnosisSent(cp.id, NOW);
    expect(result).not.toBeNull();
    expect(result!.checkpoint.status).toBe("diagnosis_sent");
    expect(result!.form).not.toBeNull();
    expect(result!.form.questions.length).toBeGreaterThan(0);
  });

  it("診断フォームIDがチェックポイントに設定される", () => {
    const { checkpoints } = registerFollowup(KDX_PROJECT, KDX_OWNER, KDX_HANDOVER, NOW);
    const cp = checkpoints[0];
    const result = markDiagnosisSent(cp.id, NOW)!;
    expect(result.checkpoint.diagnosisFormId).toBe(result.form.id);
  });

  it("getDiagnosisForm で取得できる", () => {
    const { checkpoints } = registerFollowup(KDX_PROJECT, KDX_OWNER, KDX_HANDOVER, NOW);
    const result = markDiagnosisSent(checkpoints[0].id, NOW)!;
    const form = getDiagnosisForm(result.form.id);
    expect(form).not.toBeNull();
  });
});

describe("submitDiagnosisResponse", () => {
  it("完了後にリードが生成される", () => {
    const { checkpoints } = registerFollowup(KDX_PROJECT, KDX_OWNER, KDX_HANDOVER, NOW);
    const cp = checkpoints.find((c) => c.kind === "five_year")!;
    const sentResult = markDiagnosisSent(cp.id, NOW)!;

    // 全問4 (劣化スコア高め)
    const answers: Record<string, number> = {};
    for (const q of sentResult.form.questions) {
      answers[q.id] = 4;
    }
    const result = submitDiagnosisResponse(cp.id, answers, NOW);
    expect(result).not.toBeNull();
    expect(result!.lead).not.toBeNull();
    expect(result!.checkpoint.status).toBe("completed");
  });

  it("存在しないチェックポイントは null", () => {
    expect(submitDiagnosisResponse(makeFollowupCheckpointId("nonexistent"), {})).toBeNull();
  });

  it("diagnosisFormId が未設定のチェックポイントは null", () => {
    const { checkpoints } = registerFollowup(KDX_PROJECT, KDX_OWNER, KDX_HANDOVER, NOW);
    // markDiagnosisSent を呼ばずに submitDiagnosisResponse
    const result = submitDiagnosisResponse(checkpoints[0].id, {});
    expect(result).toBeNull();
  });
});

describe("KDX南青山施主シナリオ — 5年後診断→urgent lead生成", () => {
  it("引渡2025-04-01の施主が5年後に劣化診断→urgentリード生成", () => {
    // 1. フォローアップ登録
    const { checkpoints } = registerFollowup(KDX_PROJECT, KDX_OWNER, KDX_HANDOVER, NOW);
    const fiveYearCp = checkpoints.find((cp) => cp.kind === "five_year")!;

    // 2. リマインダー送信
    markReminderSent(fiveYearCp.id, NOW_5YR);

    // 3. 診断フォーム送信
    const diagResult = markDiagnosisSent(fiveYearCp.id, NOW_5YR)!;

    // 4. 施主が劣化を多数報告 (全問5 = 最悪)
    const answers: Record<string, number> = {};
    for (const q of diagResult.form.questions) {
      answers[q.id] = 5;
    }
    const result = submitDiagnosisResponse(fiveYearCp.id, answers, NOW_5YR)!;

    // 5. 検証
    expect(result.lead.potential).toBe("urgent");
    expect(result.lead.overallScore).toBe(100);
    expect(result.lead.urgentCategories.length).toBeGreaterThan(0);
    expect(result.lead.recommendedWorkTypes.length).toBeGreaterThan(0);
    expect(result.lead.estimatedMinJpy).toBeGreaterThan(0);
    expect(result.lead.proposalTimingJa).toContain("早急");
  });

  it("全問1 (良好) なら low リードが生成される", () => {
    const { checkpoints } = registerFollowup(KDX_PROJECT, KDX_OWNER, KDX_HANDOVER, NOW);
    const oneYearCp = checkpoints.find((cp) => cp.kind === "one_year")!;
    const diagResult = markDiagnosisSent(oneYearCp.id, NOW)!;
    const answers: Record<string, number> = {};
    for (const q of diagResult.form.questions) {
      answers[q.id] = 1;
    }
    const result = submitDiagnosisResponse(oneYearCp.id, answers, NOW)!;
    expect(result.lead.potential).toBe("low");
    expect(result.lead.overallScore).toBe(0);
  });
});

describe("getActiveLeadsByPotential", () => {
  it("potential でフィルタできる", () => {
    const { checkpoints } = registerFollowup(KDX_PROJECT, KDX_OWNER, KDX_HANDOVER, NOW);
    const cp = checkpoints.find((c) => c.kind === "five_year")!;
    const diagResult = markDiagnosisSent(cp.id, NOW)!;
    const answers: Record<string, number> = {};
    for (const q of diagResult.form.questions) {
      answers[q.id] = 5; // → urgent
    }
    submitDiagnosisResponse(cp.id, answers, NOW);

    const urgentLeads = getActiveLeadsByPotential("urgent");
    expect(urgentLeads).toHaveLength(1);
    const lowLeads = getActiveLeadsByPotential("low");
    expect(lowLeads).toHaveLength(0);
  });
});

describe("getUpcomingCheckpoints", () => {
  it("30日以内の scheduled チェックポイントが返る", () => {
    // 引渡日を25日前に設定して3ヶ月点検が65日後になるようにする
    const handover = new Date(NOW.getTime() - 25 * 24 * 60 * 60 * 1000).toISOString();
    registerFollowup("proj-test", "owner-test", handover, NOW);

    // 30日以内に to-come するチェックポイントはないはず (3ヶ月=65日後)
    const upcoming = getUpcomingCheckpoints(30, NOW);
    // 検証: scheduled ステータスのみが含まれる
    for (const cp of upcoming) {
      expect(cp.status).not.toBe("completed");
      expect(cp.status).not.toBe("skipped");
    }
  });

  it("完了済みチェックポイントは含まれない", () => {
    const { checkpoints } = registerFollowup(KDX_PROJECT, KDX_OWNER, KDX_HANDOVER, NOW);
    const cp = checkpoints[0];
    markDiagnosisSent(cp.id, NOW);
    const diagResult = markDiagnosisSent(cp.id, NOW)!;
    const answers: Record<string, number> = {};
    for (const q of diagResult.form.questions) answers[q.id] = 1;
    submitDiagnosisResponse(cp.id, answers, NOW);

    const upcoming = getUpcomingCheckpoints(36500, NOW);
    const ids = upcoming.map((c) => c.id);
    expect(ids).not.toContain(cp.id);
  });
});

describe("listAllLeads", () => {
  it("複数リードを一覧取得できる", () => {
    const { checkpoints } = registerFollowup(KDX_PROJECT, KDX_OWNER, KDX_HANDOVER, NOW);
    for (const cp of checkpoints.slice(0, 2)) {
      const diagResult = markDiagnosisSent(cp.id, NOW)!;
      const answers: Record<string, number> = {};
      for (const q of diagResult.form.questions) answers[q.id] = 3;
      submitDiagnosisResponse(cp.id, answers, NOW);
    }
    expect(listAllLeads()).toHaveLength(2);
  });
});
