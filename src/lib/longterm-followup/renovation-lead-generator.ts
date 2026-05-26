/**
 * renovation-lead-generator — 劣化スコアと CheckpointKind から RenovationLead を生成する。
 *
 * Sprint 19-A: 5年/10年フォローオート
 */

import type {
  FollowupScheduleId,
  FollowupCheckpointId,
  RenovationLead,
  RenovationLeadId,
  LeadPotential,
  DegradationCategory,
  CheckpointKind,
} from "./types.js";
import type { DegradationAnalysis } from "./degradation-analyzer.js";
import { makeRenovationLeadId } from "./types.js";

// ── Counter ────────────────────────────────────────────────────────────────

let _leadCounter = 0;

export function _resetLeadCounter(): void {
  _leadCounter = 0;
}

function newLeadId(): RenovationLeadId {
  return makeRenovationLeadId(`lead-${Date.now()}-${++_leadCounter}`);
}

// ── LeadPotential 判定 ─────────────────────────────────────────────────────

/**
 * overallScore から LeadPotential を判定する。
 * スコアは劣化度合い (0=良好, 100=要対処) を表す。
 * - >= 60 → urgent  (劣化が著しい)
 * - 40-59 → high
 * - 20-39 → medium
 * - < 20  → low
 */
export function determinePotential(overallScore: number): LeadPotential {
  if (overallScore >= 60) return "urgent";
  if (overallScore >= 40) return "high";
  if (overallScore >= 20) return "medium";
  return "low";
}

// ── 推奨工種 + 概算金額 ───────────────────────────────────────────────────

type WorkRecommendation = {
  workTypes: string[];
  minJpy: number;
  maxJpy: number;
  timingJa: string;
};

function buildRecommendation(
  kind: CheckpointKind,
  urgentCategories: DegradationCategory[],
  potential: LeadPotential,
): WorkRecommendation {
  const urgent = new Set(urgentCategories);

  const workTypes: string[] = [];
  let minJpy = 0;
  let maxJpy = 0;

  // カテゴリ別工種追加
  if (urgent.has("exterior_wall") || kind === "five_year" || kind === "ten_year") {
    workTypes.push("外壁塗装・補修");
    minJpy += 800_000;
    maxJpy += 2_000_000;
  }
  if (urgent.has("roof") || kind === "ten_year") {
    workTypes.push("屋根修繕・葺き替え");
    minJpy += 500_000;
    maxJpy += 3_000_000;
  }
  if (urgent.has("waterproofing") || kind === "five_year" || kind === "ten_year") {
    workTypes.push("防水工事");
    minJpy += 300_000;
    maxJpy += 1_500_000;
  }
  if (urgent.has("piping") || kind === "ten_year") {
    workTypes.push("給排水管更新");
    minJpy += 500_000;
    maxJpy += 2_000_000;
  }
  if (urgent.has("hvac")) {
    workTypes.push("空調・換気設備交換");
    minJpy += 300_000;
    maxJpy += 1_000_000;
  }
  if (urgent.has("fixtures")) {
    workTypes.push("建具・設備交換");
    minJpy += 200_000;
    maxJpy += 1_500_000;
  }
  if (urgent.has("interior_finish") || kind === "ten_year") {
    workTypes.push("内装リフォーム");
    minJpy += 500_000;
    maxJpy += 3_000_000;
  }
  if (urgent.has("structural") || kind === "ten_year") {
    workTypes.push("構造補強・耐震改修");
    minJpy += 1_000_000;
    maxJpy += 5_000_000;
  }

  // 初期不具合のみの場合
  if (workTypes.length === 0) {
    workTypes.push("定期メンテナンス点検");
    minJpy = 50_000;
    maxJpy = 150_000;
  }

  // 提案タイミング
  const timingMap: Record<LeadPotential, string> = {
    urgent: "早急に提案 (1ヶ月以内)",
    high: "今月中に提案",
    medium: "3ヶ月以内に提案",
    low: "次回点検時に提案",
  };

  return {
    workTypes,
    minJpy,
    maxJpy,
    timingJa: timingMap[potential],
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 劣化スコア + CheckpointKind から RenovationLead を生成する。
 */
export function generateLead(
  scheduleId: FollowupScheduleId,
  checkpointId: FollowupCheckpointId,
  projectId: string,
  ownerId: string,
  kind: CheckpointKind,
  analysis: DegradationAnalysis,
  now = new Date(),
): RenovationLead {
  const potential = determinePotential(analysis.overallScore);
  const rec = buildRecommendation(kind, analysis.urgentCategories, potential);

  return {
    id: newLeadId(),
    scheduleId,
    checkpointId,
    projectId,
    ownerId,
    potential,
    overallScore: analysis.overallScore,
    categoryScores: analysis.categoryScores,
    urgentCategories: analysis.urgentCategories,
    recommendedWorkTypes: rec.workTypes,
    estimatedMinJpy: rec.minJpy,
    estimatedMaxJpy: rec.maxJpy,
    proposalTimingJa: rec.timingJa,
    createdAt: now.toISOString(),
  };
}
