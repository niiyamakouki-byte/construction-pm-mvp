/**
 * maintenance-scheduler — 引渡し日からの経過月で点検タイミングを自動算出する。
 *
 * Sprint 17-C: 引渡しパッケージ自動生成
 */

import type { MaintenanceMilestone } from "./types.js";

// ── Standard inspection intervals ─────────────────────────────────────────

export type InspectionPreset = {
  intervalMonths: number;
  descriptionJa: string;
};

export const STANDARD_INSPECTION_PRESETS: InspectionPreset[] = [
  { intervalMonths: 1,   descriptionJa: "1ヶ月点検 — 施工後初回確認・不具合チェック" },
  { intervalMonths: 3,   descriptionJa: "3ヶ月点検 — 建具・設備の動作確認" },
  { intervalMonths: 6,   descriptionJa: "6ヶ月点検 — 内装仕上げ・設備の動作確認" },
  { intervalMonths: 12,  descriptionJa: "1年点検 — 総合点検・保証期限確認" },
  { intervalMonths: 24,  descriptionJa: "2年点検 — 防水・設備の状態確認" },
  { intervalMonths: 60,  descriptionJa: "5年点検 — 外装・設備の劣化確認" },
  { intervalMonths: 120, descriptionJa: "10年点検 — 大規模修繕の検討" },
];

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 引渡し日から全 milestone の scheduledAt を Date 計算で生成する。
 * completedAt: 工事完成日 ISO 8601
 * presets: 使用するプリセット (省略時は STANDARD_INSPECTION_PRESETS 全件)
 */
export function buildMaintenanceSchedule(
  completedAt: string,
  presets: InspectionPreset[] = STANDARD_INSPECTION_PRESETS,
): MaintenanceMilestone[] {
  const base = new Date(completedAt);

  return presets.map((preset) => {
    const scheduled = new Date(base);
    scheduled.setMonth(scheduled.getMonth() + preset.intervalMonths);

    return {
      intervalMonths: preset.intervalMonths,
      descriptionJa: preset.descriptionJa,
      scheduledAt: scheduled.toISOString(),
    };
  });
}

/**
 * 指定日時点で未来の milestone のみを返す。
 */
export function upcomingMilestones(
  schedule: MaintenanceMilestone[],
  asOf: Date = new Date(),
): MaintenanceMilestone[] {
  return schedule.filter((m) => new Date(m.scheduledAt) > asOf);
}

/**
 * 指定日時点で既に過ぎた milestone のみを返す。
 */
export function pastMilestones(
  schedule: MaintenanceMilestone[],
  asOf: Date = new Date(),
): MaintenanceMilestone[] {
  return schedule.filter((m) => new Date(m.scheduledAt) <= asOf);
}

/**
 * 次回の点検 milestone を返す。なければ null。
 */
export function nextMilestone(
  schedule: MaintenanceMilestone[],
  asOf: Date = new Date(),
): MaintenanceMilestone | null {
  const upcoming = upcomingMilestones(schedule, asOf);
  if (upcoming.length === 0) return null;
  return upcoming.reduce((a, b) =>
    new Date(a.scheduledAt) < new Date(b.scheduledAt) ? a : b,
  );
}

/**
 * 点検日まで残り日数を計算する (小数切り捨て)。
 */
export function daysUntilMilestone(milestone: MaintenanceMilestone, asOf: Date = new Date()): number {
  const diff = new Date(milestone.scheduledAt).getTime() - asOf.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
