/**
 * schedule-builder — workCategory × workScale → durationDays + phasesJa
 */

import type { WorkCategory, WorkScale } from "./types.js";

// ── Base duration table (days) ─────────────────────────────────────────────
// Base: small=14d / medium=30d / large=60d / extra_large=120d

const BASE_DAYS: Record<WorkScale, number> = {
  small: 14,
  medium: 30,
  large: 60,
  extra_large: 120,
};

// ── Category multipliers ───────────────────────────────────────────────────

const CATEGORY_MULTIPLIER: Record<WorkCategory, number> = {
  repair:             0.6,
  kitchen:            0.8,
  bath:               0.8,
  exterior:           0.9,
  partial_renovation: 1.0,
  office_fit:         1.0,
  store_fit:          1.1,
  full_renovation:    1.3,
  other:              1.0,
};

// ── Phase definitions ──────────────────────────────────────────────────────

type PhaseKey =
  | "preparation"
  | "demolition"
  | "structure"
  | "base_interior"
  | "finishing"
  | "cleaning_delivery";

function buildPhases(
  category: WorkCategory,
  durationDays: number,
): string[] {
  const phases: string[] = [];

  // 着工準備 (always)
  const prepDays = Math.max(3, Math.round(durationDays * 0.1));
  phases.push(`着工準備 (${prepDays}日間) — 資材発注・職人手配・近隣挨拶・養生設置`);

  // 解体 (renovation / store_fit / full)
  if (
    category === "full_renovation" ||
    category === "partial_renovation" ||
    category === "store_fit" ||
    category === "office_fit" ||
    category === "kitchen" ||
    category === "bath"
  ) {
    const demolDays = Math.max(2, Math.round(durationDays * 0.12));
    phases.push(`解体工事 (${demolDays}日間) — 既存内装撤去・廃材処理`);
  }

  // 構造・設備 (large renovation / store)
  if (
    category === "full_renovation" ||
    (category === "store_fit" && durationDays >= 30) ||
    (category === "office_fit" && durationDays >= 30)
  ) {
    const structDays = Math.max(3, Math.round(durationDays * 0.15));
    phases.push(`構造・設備工事 (${structDays}日間) — 配管・配線・耐震補強`);
  }

  // 内装下地
  const baseDays = Math.max(3, Math.round(durationDays * 0.25));
  phases.push(`内装下地工事 (${baseDays}日間) — ボード貼り・パテ処理・下地調整`);

  // 仕上げ
  const finishDays = Math.max(3, Math.round(durationDays * 0.35));
  phases.push(`仕上げ工事 (${finishDays}日間) — クロス・床材・塗装・建具・設備設置`);

  // クリーニング+引渡
  const cleanDays = Math.max(1, Math.round(durationDays * 0.05));
  phases.push(`クリーニング・引渡 (${cleanDays}日間) — 最終検査・清掃・施主立会・鍵お渡し`);

  return phases;
}

// ── Public API ─────────────────────────────────────────────────────────────

export type ScheduleResult = {
  durationDays: number;
  phasesJa: string[];
};

/**
 * workCategory × workScale から工期日数とフェーズ一覧を構築する。
 */
export function buildSchedule(input: {
  workCategory: WorkCategory;
  workScale: WorkScale;
}): ScheduleResult {
  const baseDays = BASE_DAYS[input.workScale];
  const multiplier = CATEGORY_MULTIPLIER[input.workCategory];
  const durationDays = Math.round(baseDays * multiplier);

  const phasesJa = buildPhases(input.workCategory, durationDays);

  return { durationDays, phasesJa };
}
