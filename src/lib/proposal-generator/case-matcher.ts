/**
 * case-matcher — CaseStudy をスコアリングして top3 を返す
 */

import type { CaseStudy, ProposalGenerationInput } from "./types.js";

// ── Score constants ────────────────────────────────────────────────────────

const SCORE_CATEGORY_EXACT = 1.0;
const SCORE_SCALE_MATCH = 0.5;
const SCORE_RECENT_YEARS = 0.3; // 直近3年以内
const SCORE_STYLE_TAG_PER_MATCH = 0.2;

// ── Helpers ────────────────────────────────────────────────────────────────

function completedYearMonthToDate(yearMonth: string): Date {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function isWithinRecentYears(yearMonth: string, years = 3): boolean {
  const completed = completedYearMonthToDate(yearMonth);
  const threshold = new Date();
  threshold.setFullYear(threshold.getFullYear() - years);
  return completed >= threshold;
}

/**
 * Jaccard similarity between two string arrays.
 * Returns 0 if both are empty.
 */
function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  if (union === 0) return 0;
  return intersection / union;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * workCategory 完全一致 +1.0 / scale 一致 +0.5 / styleTags Jaccard / 直近3年 +0.3 でスコアリング。
 * top3 を返す。
 */
export function matchCases(
  input: ProposalGenerationInput,
  allCases: CaseStudy[],
): CaseStudy[] {
  if (allCases.length === 0) return [];

  const inputTags = input.styleTags ?? [];

  type Scored = { caseStudy: CaseStudy; score: number };

  const scored: Scored[] = allCases.map((cs) => {
    let score = 0;

    // Category exact match
    if (cs.workCategory === input.workCategory) {
      score += SCORE_CATEGORY_EXACT;
    }

    // Scale match
    if (cs.workScale === input.workScale) {
      score += SCORE_SCALE_MATCH;
    }

    // Recent 3 years
    if (isWithinRecentYears(cs.completedYearMonth, 3)) {
      score += SCORE_RECENT_YEARS;
    }

    // Style tags (Jaccard)
    if (inputTags.length > 0) {
      const jaccard = jaccardSimilarity(inputTags, []);
      score += jaccard * SCORE_STYLE_TAG_PER_MATCH;
    }

    return { caseStudy: cs, score };
  });

  // Sort descending by score, then by completedYearMonth desc for stable ordering
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.caseStudy.completedYearMonth.localeCompare(a.caseStudy.completedYearMonth);
  });

  return scored.slice(0, 3).map((s) => s.caseStudy);
}
