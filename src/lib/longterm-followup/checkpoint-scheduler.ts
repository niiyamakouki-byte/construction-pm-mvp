/**
 * checkpoint-scheduler — 引渡日から各 CheckpointKind の予定日を自動計算する。
 *
 * Sprint 19-A: 5年/10年フォローオート
 */

import type { FollowupCheckpoint, FollowupCheckpointId, FollowupScheduleId, CheckpointKind } from "./types.js";
import { makeFollowupCheckpointId } from "./types.js";

// ── 日数定義 ──────────────────────────────────────────────────────────────

const KIND_DAYS: Record<CheckpointKind, number> = {
  three_month: 90,
  one_year: 365,
  three_year: 1095,
  five_year: 1825,
  ten_year: 3650,
};

const REMINDER_DAYS_BEFORE = 14;
const DIAGNOSIS_DAYS_BEFORE = 3;

// ── Counter ────────────────────────────────────────────────────────────────

let _checkpointCounter = 0;

export function _resetCheckpointCounter(): void {
  _checkpointCounter = 0;
}

function newCheckpointId(): FollowupCheckpointId {
  return makeFollowupCheckpointId(`chk-${Date.now()}-${++_checkpointCounter}`);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 引渡日から5種類すべてのチェックポイントを生成して返す。
 */
export function generateCheckpointsForHandover(
  scheduleId: FollowupScheduleId,
  handoverDate: string,
): FollowupCheckpoint[] {
  const base = new Date(handoverDate);
  const kinds: CheckpointKind[] = [
    "three_month",
    "one_year",
    "three_year",
    "five_year",
    "ten_year",
  ];

  return kinds.map((kind) => {
    const days = KIND_DAYS[kind];
    const scheduledDate = addDays(base, days);
    const reminderDate = addDays(scheduledDate, -REMINDER_DAYS_BEFORE);
    const diagnosisDate = addDays(scheduledDate, -DIAGNOSIS_DAYS_BEFORE);

    const checkpoint: FollowupCheckpoint = {
      id: newCheckpointId(),
      scheduleId,
      kind,
      status: "scheduled",
      scheduledDate: scheduledDate.toISOString(),
      reminderDate: reminderDate.toISOString(),
      diagnosisDate: diagnosisDate.toISOString(),
    };

    return checkpoint;
  });
}

/**
 * 指定日数を加算した Date を返す。
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * CheckpointKind に対応する予定オフセット日数を返す。
 */
export function getDaysForKind(kind: CheckpointKind): number {
  return KIND_DAYS[kind];
}

/**
 * リマインダー送信の事前日数。
 */
export const REMINDER_LEAD_DAYS = REMINDER_DAYS_BEFORE;

/**
 * 診断フォーム送信の事前日数。
 */
export const DIAGNOSIS_LEAD_DAYS = DIAGNOSIS_DAYS_BEFORE;
