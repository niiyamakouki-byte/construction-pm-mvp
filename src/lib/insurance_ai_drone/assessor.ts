/**
 * 保険AI査定エンジン
 * Sprint 60-C: 工事保険AI査定 + ドローン現場検証
 *
 * 入力: 被害写真URL配列 + 損害種別
 * 出力: 推定損害額(円)、根拠スコア、適用約款条項、免責適用判定
 */

import type { DamageType, InsuranceClause } from "./rules/insurance_clauses.js";
import {
  getClausesForDamageType,
  getPrimaryCoverageRatio,
  getPrimaryDeductibleRate,
} from "./rules/insurance_clauses.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type AssessmentInput = {
  photoUrls: string[];
  damageType: DamageType;
  /** 概算被害面積(m²) — 写真から推定できない場合はオプション */
  estimatedAreaM2?: number;
  /** 構造物の原価(円) — 損害率計算の基準 */
  constructionCostJpy?: number;
};

export type AssessmentResult = {
  /** 推定損害額(円) */
  estimatedDamageJpy: number;
  /** 根拠スコア 0.0〜1.0 (写真枚数・鮮明度・被害範囲の推定信頼度) */
  confidenceScore: number;
  /** 適用約款条項 */
  applicableClauses: InsuranceClause[];
  /** 免責適用判定 */
  deductibleApplied: boolean;
  /** 実補償見込額(円) */
  estimatedPayoutJpy: number;
  /** 査定根拠メモ */
  assessmentNotes: string[];
};

// ── Internal helpers ───────────────────────────────────────────────────────

/** 写真枚数から信頼スコアを計算 */
function confidenceFromPhotoCount(count: number): number {
  if (count === 0) return 0.1;
  if (count === 1) return 0.4;
  if (count <= 3) return 0.6;
  if (count <= 6) return 0.75;
  if (count <= 10) return 0.85;
  return 0.9;
}

/** 損害種別ごとの単価テーブル (円/m²) */
const DAMAGE_UNIT_COST_PER_M2: Record<DamageType, number> = {
  fire: 180_000,
  water: 45_000,
  theft: 80_000,
  earthquake: 150_000,
  third_party: 100_000,
};

/** 損害種別ごとのデフォルト損害率 (構造物コストがある場合) */
const DEFAULT_DAMAGE_RATE: Record<DamageType, number> = {
  fire: 0.6,
  water: 0.15,
  theft: 0.08,
  earthquake: 0.35,
  third_party: 0.2,
};

// ── assessDamage ───────────────────────────────────────────────────────────

/**
 * AI査定メイン関数
 *
 * 実際の実装では写真URLからビジョンAIで被害度を推定するが、
 * 本実装では写真枚数・面積・コストから統計的に推定する。
 */
export function assessDamage(input: AssessmentInput): AssessmentResult {
  const { photoUrls, damageType, estimatedAreaM2, constructionCostJpy } = input;

  const applicableClauses = getClausesForDamageType(damageType);
  const notes: string[] = [];

  // 信頼スコア計算
  let confidence = confidenceFromPhotoCount(photoUrls.length);
  if (estimatedAreaM2 !== undefined) confidence = Math.min(confidence + 0.05, 0.95);
  if (constructionCostJpy !== undefined) confidence = Math.min(confidence + 0.05, 0.95);

  notes.push(`写真${photoUrls.length}枚から信頼度${Math.round(confidence * 100)}%で査定`);

  // 損害額推定
  const estimatedDamageJpy = (() => {
    if (constructionCostJpy !== undefined && constructionCostJpy > 0) {
    // 構造物コストベース
    const damageRate = DEFAULT_DAMAGE_RATE[damageType];
    notes.push(`構造物原価 ¥${constructionCostJpy.toLocaleString()} × 損害率${(damageRate * 100).toFixed(0)}%`);
      return constructionCostJpy * damageRate;
    }
    if (estimatedAreaM2 !== undefined && estimatedAreaM2 > 0) {
    // 面積ベース
    const unitCost = DAMAGE_UNIT_COST_PER_M2[damageType];
    notes.push(`被害面積 ${estimatedAreaM2}m² × 単価 ¥${unitCost.toLocaleString()}/m²`);
      return estimatedAreaM2 * unitCost;
    }
    // 写真のみから最低限推定 (50万円固定ベース × 損害率)
    const baseEstimate = 500_000;
    notes.push(`写真のみ査定: 基準額 ¥${baseEstimate.toLocaleString()} × 損害率 ${(DEFAULT_DAMAGE_RATE[damageType] * 100).toFixed(0)}%`);
    confidence = Math.min(confidence, 0.45);
    return baseEstimate * DEFAULT_DAMAGE_RATE[damageType];
  })();

  // 免責判定
  const deductibleRate = getPrimaryDeductibleRate(damageType);
  const deductibleApplied = deductibleRate > 0;
  if (deductibleApplied) {
    notes.push(
      `免責率 ${(deductibleRate * 100).toFixed(0)}% 適用 (${applicableClauses[0]?.articleNumber ?? ""})`
    );
  }

  // 補償見込額
  const coverageRatio = getPrimaryCoverageRatio(damageType);
  const estimatedPayoutJpy = Math.floor(estimatedDamageJpy * coverageRatio * (1 - deductibleRate));

  notes.push(`補償率 ${(coverageRatio * 100).toFixed(0)}% → 支払見込 ¥${estimatedPayoutJpy.toLocaleString()}`);

  return {
    estimatedDamageJpy: Math.floor(estimatedDamageJpy),
    confidenceScore: Math.round(confidence * 100) / 100,
    applicableClauses,
    deductibleApplied,
    estimatedPayoutJpy,
    assessmentNotes: notes,
  };
}
