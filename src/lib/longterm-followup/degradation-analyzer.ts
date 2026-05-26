/**
 * degradation-analyzer — DiagnosisResponse から劣化スコアを算出する。
 *
 * Sprint 19-A: 5年/10年フォローオート
 */

import type {
  DiagnosisResponse,
  DiagnosisForm,
  DegradationCategory,
} from "./types.js";

// ── 閾値定義 ──────────────────────────────────────────────────────────────

/** 平均スコアがこの値以下の場合リフォーム提案閾値 */
export const RENOVATION_THRESHOLD_SCORE = 60;

/** スコアがこの値以上のカテゴリを緊急とみなす */
export const URGENT_CATEGORY_THRESHOLD = 70;

// ── Score calculation ──────────────────────────────────────────────────────

/**
 * 1-5スコアを0-100に変換する (1=良好=0点, 5=要対処=100点)。
 */
function toPercentScore(rawScore: number): number {
  // clamp to 1-5
  const clamped = Math.max(1, Math.min(5, rawScore));
  return Math.round(((clamped - 1) / 4) * 100);
}

// ── Public API ─────────────────────────────────────────────────────────────

export type DegradationAnalysis = {
  /** カテゴリ別劣化スコア (0-100, 高いほど劣化) */
  categoryScores: Record<DegradationCategory, number>;
  /** 全カテゴリの平均スコア (0-100) */
  overallScore: number;
  /** スコアが URGENT_CATEGORY_THRESHOLD 以上のカテゴリ */
  urgentCategories: DegradationCategory[];
};

/**
 * 診断回答から劣化スコアを算出する。
 *
 * @param response - 施主の回答
 * @param form - 対応する診断フォーム (質問とカテゴリのマッピングに使用)
 */
export function analyzeResponse(
  response: DiagnosisResponse,
  form: DiagnosisForm,
): DegradationAnalysis {
  const ALL_CATEGORIES: DegradationCategory[] = [
    "exterior_wall",
    "roof",
    "waterproofing",
    "piping",
    "hvac",
    "fixtures",
    "interior_finish",
    "structural",
  ];

  // カテゴリ別に回答スコアを集計
  const categorySums: Partial<Record<DegradationCategory, number>> = {};
  const categoryCounts: Partial<Record<DegradationCategory, number>> = {};

  for (const question of form.questions) {
    const rawScore = response.answers[question.id];
    if (rawScore === undefined) continue;

    const pct = toPercentScore(rawScore);
    const cat = question.category;

    categorySums[cat] = (categorySums[cat] ?? 0) + pct;
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
  }

  // カテゴリ別平均スコア
  const categoryScores = {} as Record<DegradationCategory, number>;
  for (const cat of ALL_CATEGORIES) {
    const sum = categorySums[cat] ?? 0;
    const count = categoryCounts[cat] ?? 0;
    categoryScores[cat] = count > 0 ? Math.round(sum / count) : 0;
  }

  // 全体平均スコア
  const scoredCategories = ALL_CATEGORIES.filter((cat) => (categoryCounts[cat] ?? 0) > 0);
  const overallScore =
    scoredCategories.length > 0
      ? Math.round(
          scoredCategories.reduce((sum, cat) => sum + categoryScores[cat], 0) /
            scoredCategories.length,
        )
      : 0;

  // 緊急カテゴリ
  const urgentCategories = ALL_CATEGORIES.filter(
    (cat) => categoryScores[cat] >= URGENT_CATEGORY_THRESHOLD,
  );

  return { categoryScores, overallScore, urgentCategories };
}
