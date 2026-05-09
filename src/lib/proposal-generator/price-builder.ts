/**
 * price-builder — workCategory × workScale → 価格レンジ
 *
 * Sprint 16-A range-estimator と同じ係数を再利用。
 */

import type { WorkCategory, WorkScale } from "./types.js";

// ── Standard range table (JPY) — range-estimator と同一係数 ───────────────

type RangeMatrix = Record<WorkCategory, Record<WorkScale, [number, number]>>;

export const PRICE_RANGE_MATRIX: RangeMatrix = {
  kitchen: {
    small:       [500_000,    1_500_000],
    medium:      [1_500_000,  3_000_000],
    large:       [3_000_000,  6_000_000],
    extra_large: [6_000_000, 10_000_000],
  },
  bath: {
    small:       [600_000,    1_500_000],
    medium:      [1_500_000,  3_000_000],
    large:       [3_000_000,  5_000_000],
    extra_large: [5_000_000,  8_000_000],
  },
  store_fit: {
    small:       [500_000,    2_000_000],
    medium:      [2_000_000,  6_000_000],
    large:       [6_000_000, 15_000_000],
    extra_large: [15_000_000, 40_000_000],
  },
  office_fit: {
    small:       [500_000,    2_000_000],
    medium:      [2_000_000,  6_000_000],
    large:       [6_000_000, 15_000_000],
    extra_large: [15_000_000, 30_000_000],
  },
  full_renovation: {
    small:       [2_000_000,   5_000_000],
    medium:      [5_000_000,  10_000_000],
    large:       [8_000_000,  20_000_000],
    extra_large: [20_000_000, 50_000_000],
  },
  partial_renovation: {
    small:       [300_000,    1_500_000],
    medium:      [1_500_000,  4_000_000],
    large:       [4_000_000, 10_000_000],
    extra_large: [10_000_000, 20_000_000],
  },
  exterior: {
    small:       [300_000,    1_500_000],
    medium:      [1_500_000,  4_000_000],
    large:       [4_000_000, 10_000_000],
    extra_large: [10_000_000, 20_000_000],
  },
  repair: {
    small:       [100_000,     500_000],
    medium:      [500_000,   2_000_000],
    large:       [2_000_000,  5_000_000],
    extra_large: [5_000_000, 10_000_000],
  },
  other: {
    small:       [300_000,    1_500_000],
    medium:      [1_500_000,  5_000_000],
    large:       [5_000_000, 15_000_000],
    extra_large: [15_000_000, 30_000_000],
  },
};

const CATEGORY_LABEL_JA: Record<WorkCategory, string> = {
  kitchen: "キッチン工事",
  bath: "浴室工事",
  store_fit: "店舗内装工事",
  office_fit: "オフィス内装工事",
  full_renovation: "全面リノベーション",
  partial_renovation: "部分リフォーム",
  exterior: "外装・外壁工事",
  repair: "補修・修繕工事",
  other: "その他内装工事",
};

const SCALE_LABEL_JA: Record<WorkScale, string> = {
  small: "小規模",
  medium: "中規模",
  large: "大規模",
  extra_large: "超大規模",
};

// ── Budget hint adjustment (range-estimator と同一ロジック) ────────────────

function adjustForBudgetHint(
  lower: number,
  upper: number,
  hint: number,
): [number, number] {
  if (hint < lower) {
    return [Math.round(hint * 0.8), lower];
  }
  if (hint > upper) {
    return [upper, Math.round(hint * 1.2)];
  }
  const adjustedLower = Math.round(hint * 0.8);
  const adjustedUpper = Math.round(hint * 1.2);
  return [Math.max(adjustedLower, lower), Math.min(adjustedUpper, upper)];
}

// ── Public API ─────────────────────────────────────────────────────────────

export type PriceRange = {
  lower: number;
  upper: number;
  basisJa: string;
};

/**
 * workCategory × workScale から価格レンジを構築する。
 * budgetHintJpy があれば中心値補正を適用。
 */
export function buildPriceRange(input: {
  workCategory: WorkCategory;
  workScale: WorkScale;
  budgetHintJpy?: number;
}): PriceRange {
  const [baseLower, baseUpper] = PRICE_RANGE_MATRIX[input.workCategory][input.workScale];

  let lower = baseLower;
  let upper = baseUpper;

  if (input.budgetHintJpy !== undefined && input.budgetHintJpy > 0) {
    [lower, upper] = adjustForBudgetHint(baseLower, baseUpper, input.budgetHintJpy);
  }

  const categoryLabel = CATEGORY_LABEL_JA[input.workCategory];
  const scaleLabel = SCALE_LABEL_JA[input.workScale];

  const basisJa =
    input.budgetHintJpy !== undefined && input.budgetHintJpy > 0
      ? `${categoryLabel}(${scaleLabel})の標準工事費にご予算ヒント${Math.round(input.budgetHintJpy / 10_000)}万円を加味して算出。現地調査前の概算です。`
      : `${categoryLabel}(${scaleLabel})の標準工事費から算出。現地調査前の概算です。`;

  return { lower, upper, basisJa };
}

/** 万円単位でフォーマット */
export function formatManYen(jpy: number): string {
  return `${Math.round(jpy / 10_000).toLocaleString("ja-JP")}万円`;
}
