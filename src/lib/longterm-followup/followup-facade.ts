/**
 * followup-facade — 長期フォローアップワークフローの公開API
 *
 * Sprint 19-A: 5年/10年フォローオート
 */

import type {
  FollowupSchedule,
  FollowupScheduleId,
  FollowupCheckpoint,
  FollowupCheckpointId,
  DiagnosisForm,
  DiagnosisFormId,
  DiagnosisResponse,
  RenovationLead,
  LeadPotential,
} from "./types.js";
import { makeFollowupScheduleId } from "./types.js";
import { followupStore } from "./followup-store.js";
import { generateCheckpointsForHandover } from "./checkpoint-scheduler.js";
import { buildFormForCheckpoint } from "./diagnosis-form-builder.js";
import { analyzeResponse } from "./degradation-analyzer.js";
import { generateLead } from "./renovation-lead-generator.js";

// ── In-memory stores for checkpoints, forms, leads ────────────────────────

const _checkpoints = new Map<FollowupCheckpointId, FollowupCheckpoint>();
const _forms = new Map<DiagnosisFormId, DiagnosisForm>();
const _leads = new Map<string, RenovationLead>();

/** テスト用リセット */
export function _resetFollowupFacade(): void {
  _checkpoints.clear();
  _forms.clear();
  _leads.clear();
}

// ── ID counter ─────────────────────────────────────────────────────────────

let _scheduleCounter = 0;

function newScheduleId(): FollowupScheduleId {
  return makeFollowupScheduleId(`sched-${Date.now()}-${++_scheduleCounter}`);
}

// ── Register followup ──────────────────────────────────────────────────────

/**
 * 引渡し後フォローアップスケジュールを登録し、5つのチェックポイントを生成する。
 */
export function registerFollowup(
  projectId: string,
  ownerId: string,
  handoverDate: string,
  now = new Date(),
): { schedule: FollowupSchedule; checkpoints: FollowupCheckpoint[] } {
  const scheduleId = newScheduleId();

  const checkpoints = generateCheckpointsForHandover(scheduleId, handoverDate);

  for (const cp of checkpoints) {
    _checkpoints.set(cp.id, cp);
  }

  const schedule: FollowupSchedule = {
    id: scheduleId,
    projectId,
    ownerId,
    handoverDate,
    registeredAt: now.toISOString(),
    checkpointIds: checkpoints.map((cp) => cp.id),
    isActive: true,
  };

  followupStore.add(schedule);

  return { schedule, checkpoints };
}

// ── Status updates ─────────────────────────────────────────────────────────

/**
 * リマインダー送信済みとしてマークする。
 */
export function markReminderSent(
  checkpointId: FollowupCheckpointId,
  now = new Date(),
): FollowupCheckpoint | null {
  const cp = _checkpoints.get(checkpointId);
  if (!cp) return null;

  const updated: FollowupCheckpoint = { ...cp, status: "reminder_sent" };
  _checkpoints.set(checkpointId, updated);
  return updated;
}

/**
 * 診断フォーム送信済みとしてマークし、フォームを生成して保存する。
 */
export function markDiagnosisSent(
  checkpointId: FollowupCheckpointId,
  now = new Date(),
): { checkpoint: FollowupCheckpoint; form: DiagnosisForm } | null {
  const cp = _checkpoints.get(checkpointId);
  if (!cp) return null;

  const form = buildFormForCheckpoint(cp, now);
  _forms.set(form.id, form);

  const updated: FollowupCheckpoint = {
    ...cp,
    status: "diagnosis_sent",
    diagnosisFormId: form.id,
  };
  _checkpoints.set(checkpointId, updated);

  return { checkpoint: updated, form };
}

/**
 * 診断回答を受け付け、劣化スコア算出 + リフォームリード生成を自動実行する。
 */
export function submitDiagnosisResponse(
  checkpointId: FollowupCheckpointId,
  answers: Record<string, number>,
  now = new Date(),
): { checkpoint: FollowupCheckpoint; lead: RenovationLead } | null {
  const cp = _checkpoints.get(checkpointId);
  if (!cp || !cp.diagnosisFormId) return null;

  const form = _forms.get(cp.diagnosisFormId);
  if (!form) return null;

  const schedule = followupStore.get(cp.scheduleId);
  if (!schedule) return null;

  const response: DiagnosisResponse = {
    formId: cp.diagnosisFormId,
    checkpointId,
    answers,
    submittedAt: now.toISOString(),
  };

  const analysis = analyzeResponse(response, form);
  const lead = generateLead(
    cp.scheduleId,
    checkpointId,
    schedule.projectId,
    schedule.ownerId,
    cp.kind,
    analysis,
    now,
  );

  _leads.set(lead.id, lead);

  const updated: FollowupCheckpoint = {
    ...cp,
    status: "completed",
    renovationLeadId: lead.id,
    completedAt: now.toISOString(),
  };
  _checkpoints.set(checkpointId, updated);

  return { checkpoint: updated, lead };
}

// ── Query helpers ──────────────────────────────────────────────────────────

/** スケジュール一覧 */
export function listSchedules(limit = 100): FollowupSchedule[] {
  return followupStore.getAll(limit);
}

/** IDでスケジュールを取得 */
export function getSchedule(id: FollowupScheduleId): FollowupSchedule | null {
  return followupStore.get(id);
}

/** チェックポイント一覧 (スケジュールIDで絞り込み可能) */
export function listCheckpoints(scheduleId?: FollowupScheduleId): FollowupCheckpoint[] {
  const all = Array.from(_checkpoints.values());
  if (!scheduleId) return all;
  return all.filter((cp) => cp.scheduleId === scheduleId);
}

/** IDでチェックポイントを取得 */
export function getCheckpoint(id: FollowupCheckpointId): FollowupCheckpoint | null {
  return _checkpoints.get(id) ?? null;
}

/** IDで診断フォームを取得 */
export function getDiagnosisForm(id: DiagnosisFormId): DiagnosisForm | null {
  return _forms.get(id) ?? null;
}

/**
 * LeadPotential でフィルタしたリフォームリード一覧。
 */
export function getActiveLeadsByPotential(potential: LeadPotential): RenovationLead[] {
  return Array.from(_leads.values()).filter((l) => l.potential === potential);
}

/** 全リードを返す */
export function listAllLeads(): RenovationLead[] {
  return Array.from(_leads.values());
}

/**
 * 指定日数以内にチェックポイント予定日が到来するチェックポイント一覧。
 */
export function getUpcomingCheckpoints(
  daysAhead: number,
  now = new Date(),
): FollowupCheckpoint[] {
  const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return Array.from(_checkpoints.values()).filter((cp) => {
    if (cp.status === "completed" || cp.status === "skipped") return false;
    const scheduled = new Date(cp.scheduledDate);
    return scheduled >= now && scheduled <= cutoff;
  });
}
