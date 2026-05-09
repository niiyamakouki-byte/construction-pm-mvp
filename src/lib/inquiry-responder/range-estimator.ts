/**
 * range-estimator — workCategory × workScale → 標準レンジ (cost-master 想定値)
 */

import type { WorkCategory, WorkScale, EstimatedRange, ConfidenceLevel } from "./types.js";

// ── Standard range table (JPY) ─────────────────────────────────────────────
// workCategory × workScale → [lowerJpy, upperJpy]

type RangeMatrix = Record<WorkCategory, Record<WorkScale, [number, number]>>;

const RANGE_MATRIX: RangeMatrix = {
  kitchen: {
    small:       [500_000,  1_500_000],
    medium:      [1_500_000, 3_000_000],
    large:       [3_000_000, 6_000_000],
    extra_large: [6_000_000, 10_000_000],
  },
  bath: {
    small:       [600_000,  1_500_000],
    medium:      [1_500_000, 3_000_000],
    large:       [3_000_000, 5_000_000],
    extra_large: [5_000_000, 8_000_000],
  },
  store_fit: {
    small:       [500_000,  2_000_000],
    medium:      [2_000_000, 6_000_000],
    large:       [6_000_000, 15_000_000],
    extra_large: [15_000_000, 40_000_000],
  },
  office_fit: {
    small:       [500_000,  2_000_000],
    medium:      [2_000_000, 6_000_000],
    large:       [6_000_000, 15_000_000],
    extra_large: [15_000_000, 30_000_000],
  },
  full_renovation: {
    small:       [2_000_000,  5_000_000],
    medium:      [5_000_000,  10_000_000],
    large:       [8_000_000,  20_000_000],
    extra_large: [20_000_000, 50_000_000],
  },
  partial_renovation: {
    small:       [300_000,  1_500_000],
    medium:      [1_500_000, 4_000_000],
    large:       [4_000_000, 10_000_000],
    extra_large: [10_000_000, 20_000_000],
  },
  exterior: {
    small:       [300_000,  1_500_000],
    medium:      [1_500_000, 4_000_000],
    large:       [4_000_000, 10_000_000],
    extra_large: [10_000_000, 20_000_000],
  },
  repair: {
    small:       [100_000,   500_000],
    medium:      [500_000,  2_000_000],
    large:       [2_000_000, 5_000_000],
    extra_large: [5_000_000, 10_000_000],
  },
  other: {
    small:       [300_000,  1_500_000],
    medium:      [1_500_000, 5_000_000],
    large:       [5_000_000, 15_000_000],
    extra_large: [15_000_000, 30_000_000],
  },
};

// ── Basis notes ────────────────────────────────────────────────────────────

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

// ── Confidence calculation ─────────────────────────────────────────────────

function computeConfidence(
  budgetHint: number | null,
  category: WorkCategory,
): ConfidenceLevel {
  if (category === "other") return "low";
  if (budgetHint !== null) return "high";
  return "medium";
}

// ── Budget hint adjustment ─────────────────────────────────────────────────

/**
 * budgetHint がある場合にレンジを調整する。
 * hint が matrix レンジ内 → そのまま
 * hint がレンジ下限未満 → 下限〜下限×1.5
 * hint がレンジ上限超過 → 上限〜上限×1.5
 */
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
  // hint がレンジ内 → hint を中心に±20%
  const adjustedLower = Math.round(hint * 0.8);
  const adjustedUpper = Math.round(hint * 1.2);
  return [Math.max(adjustedLower, lower), Math.min(adjustedUpper, upper)];
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * workCategory × workScale から概算見積レンジを算出する。
 * budgetHint があれば調整を加える。
 */
export function estimateRange(
  category: WorkCategory,
  scale: WorkScale,
  budgetHintJpy: number | null,
): EstimatedRange {
  const [baseLower, baseUpper] = RANGE_MATRIX[category][scale];

  let lowerJpy = baseLower;
  let upperJpy = baseUpper;

  if (budgetHintJpy !== null && budgetHintJpy > 0) {
    [lowerJpy, upperJpy] = adjustForBudgetHint(baseLower, baseUpper, budgetHintJpy);
  }

  const confidence = computeConfidence(budgetHintJpy, category);

  const categoryLabel = CATEGORY_LABEL_JA[category];
  const scaleLabel = SCALE_LABEL_JA[scale];
  const basisNotes_ja = budgetHintJpy !== null
    ? `${categoryLabel}(${scaleLabel})の標準工事費にご予算ヒント${Math.round(budgetHintJpy / 10_000)}万円を加味して算出。現地調査前の概算です。`
    : `${categoryLabel}(${scaleLabel})の標準工事費から算出。現地調査前の概算です。`;

  return {
    lowerJpy,
    upperJpy,
    confidence,
    basisNotes_ja,
  };
}
