/**
 * 確信度スコアラー
 * ParsedEstimateItem の信頼度を 1〜5 で算出する
 */

import type { ParsedEstimateItem } from "../estimate/nl-estimate-parser";

/** DEFAULT_AREA_SQM: パーサーのデフォルト面積 */
const DEFAULT_AREA_SQM = 10;

/**
 * ParsedEstimateItem の確信度スコアを算出する
 *
 * スコアリングルール:
 *   - 面積明示(畳/㎡/坪) → +2
 *   - 品目コード直接マッチ → +2
 *   - NLキーワード完全マッチ → +1
 *   - 数量がデフォルト値(1) → -1
 *   - 面積がデフォルト(10㎡) → -2
 *   - unmatchedフレーズあり → -1
 *   - 最終 = clamp(1, 5, score)
 *
 * @param item - ParsedEstimateItem
 * @param options - オプション設定
 * @returns 確信度スコア (1〜5)
 */
export function calculateConfidence(
  item: ParsedEstimateItem,
  options: {
    /** 面積が明示的に検出されたか */
    hasExplicitArea?: boolean;
    /** 面積値 (デフォルト判定用) */
    detectedAreaSqm?: number | null;
    /** 未マッチフレーズが存在するか */
    hasUnmatched?: boolean;
  } = {},
): number {
  const { hasExplicitArea = false, detectedAreaSqm = null, hasUnmatched = false } = options;

  let score = 3; // ベーススコア

  // 面積明示 (畳/㎡/坪)
  if (hasExplicitArea) {
    score += 2;
  }

  // 品目コード直接マッチ（quantityBasisが"テキストから抽出"でない場合は積算による確定コード）
  // codeが存在し、自動追加でない品目はコード直接マッチとみなす
  if (item.code && item.matchedKeyword !== "(自動追加)") {
    score += 2;
  }

  // NLキーワード完全マッチ（matchedKeywordが設定されている）
  if (item.matchedKeyword && item.matchedKeyword !== "(自動追加)" && item.matchedKeyword.length > 0) {
    score += 1;
  }

  // 数量がデフォルト値(1) → 信頼度低下
  if (item.quantity === 1 && item.quantityBasis?.includes("デフォルト数量")) {
    score -= 1;
  }

  // 面積がデフォルト(10㎡) → 信頼度低下
  if (!hasExplicitArea && (detectedAreaSqm === null || detectedAreaSqm === DEFAULT_AREA_SQM)) {
    score -= 2;
  }

  // 未マッチフレーズあり → 信頼度低下
  if (hasUnmatched) {
    score -= 1;
  }

  // clamp(1, 5, score)
  return Math.min(5, Math.max(1, score));
}

/**
 * 確信度スコアを★表示に変換
 * @param score - 1〜5のスコア
 * @returns 例: "★★★★☆"
 */
export function scoreToStars(score: number): string {
  const clamped = Math.min(5, Math.max(1, Math.round(score)));
  return "★".repeat(clamped) + "☆".repeat(5 - clamped);
}
