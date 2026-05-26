/**
 * tier-calculator — アンバサダーtier自動判定
 *
 * Sprint 18-C: 施主アンバサダー化
 *
 * Tier昇格基準:
 *   bronze:   デフォルト
 *   silver:   紹介成約1件以上
 *   gold:     紹介成約3件以上 OR 総成約金額 ¥500万以上
 *   platinum: 紹介成約5件以上 OR 総成約金額 ¥1,500万以上
 */

import type { AmbassadorTier } from "./types.js";
import { TIER_CONFIGS } from "./types.js";

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 成約数・総金額からtierを算出する。
 * 高いtierから順に条件チェックするため、常に最高tierを返す。
 */
export function calculateTier(
  contractedReferralCount: number,
  totalContractedAmountJpy: number,
): AmbassadorTier {
  // platinum check
  const platinum = TIER_CONFIGS.platinum;
  if (
    contractedReferralCount >= platinum.minContractedReferrals ||
    (platinum.minTotalAmountJpy > 0 && totalContractedAmountJpy >= platinum.minTotalAmountJpy)
  ) {
    return "platinum";
  }

  // gold check
  const gold = TIER_CONFIGS.gold;
  if (
    contractedReferralCount >= gold.minContractedReferrals ||
    (gold.minTotalAmountJpy > 0 && totalContractedAmountJpy >= gold.minTotalAmountJpy)
  ) {
    return "gold";
  }

  // silver check
  const silver = TIER_CONFIGS.silver;
  if (contractedReferralCount >= silver.minContractedReferrals) {
    return "silver";
  }

  return "bronze";
}

/**
 * tierに対応する報酬率を返す (小数: 0.01 = 1%)。
 */
export function getRewardRate(tier: AmbassadorTier): number {
  return TIER_CONFIGS[tier].rewardRate;
}
