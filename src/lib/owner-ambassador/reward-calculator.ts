/**
 * reward-calculator — 紹介報酬の自動算出
 *
 * Sprint 18-C: 施主アンバサダー化
 *
 * - 成約金額 × tier報酬率 で ReferralReward を算出
 * - 上限: ¥500,000/件
 * - 税務処理メモを生成 (20万超は源泉徴収対象)
 */

import type { ReferralReward, AmbassadorTier, RewardKind } from "./types.js";
import { makeReferralRewardId } from "./types.js";
import type { OwnerAmbassadorId, ReferralInquiryId } from "./types.js";
import { getRewardRate } from "./tier-calculator.js";

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_REWARD_JPY = 500_000;
/** 源泉徴収対象のしきい値 (JPY) */
const WITHHOLDING_THRESHOLD_JPY = 200_000;

// ── ID generation ──────────────────────────────────────────────────────────

let _counter = 0;

function generateRewardId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `rr-${ts}-${rand}-${(++_counter).toString(36)}`;
}

// ── Tax note ───────────────────────────────────────────────────────────────

function buildTaxNote(amountJpy: number, tier: AmbassadorTier): string {
  const tierLabel = { bronze: "ブロンズ", silver: "シルバー", gold: "ゴールド", platinum: "プラチナ" }[tier];
  const cappedNote = amountJpy >= MAX_REWARD_JPY ? `（上限 ¥${MAX_REWARD_JPY.toLocaleString("ja-JP")} 適用）` : "";
  if (amountJpy >= WITHHOLDING_THRESHOLD_JPY) {
    return `${tierLabel}ティア紹介報酬${cappedNote}。¥200,000超のため源泉徴収(10.21%)の対象。税理士確認のこと。`;
  }
  return `${tierLabel}ティア紹介報酬${cappedNote}。源泉徴収対象外。`;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 紹介経由成約案件の報酬を算出して ReferralReward を返す。
 */
export function calculateReward(
  ambassadorId: OwnerAmbassadorId,
  inquiryId: ReferralInquiryId,
  contractAmountJpy: number,
  tier: AmbassadorTier,
  kind: RewardKind = "cash",
  now = new Date(),
): ReferralReward {
  const rewardRate = getRewardRate(tier);
  const rawAmount = Math.round(contractAmountJpy * rewardRate);
  const amountJpy = Math.min(rawAmount, MAX_REWARD_JPY);

  return {
    id: makeReferralRewardId(generateRewardId()),
    ambassadorId,
    referralInquiryId: inquiryId,
    kind,
    amountJpy,
    rewardRate,
    taxNoteJa: buildTaxNote(amountJpy, tier),
    calculatedAt: now.toISOString(),
    isPaid: false,
  };
}

/** テスト用カウンターリセット */
export function _resetRewardCounter(): void {
  _counter = 0;
}
