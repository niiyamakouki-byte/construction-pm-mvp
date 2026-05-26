/**
 * ambassador-facade — 施主アンバサダーワークフローの公開API
 *
 * Sprint 18-C: 施主アンバサダー化
 */

import type {
  OwnerAmbassador,
  OwnerAmbassadorId,
  ReferralLink,
  ReferralLinkId,
  ReferralInquiry,
  ReferralInquiryId,
  ReferralReward,
  ReferralChannel,
  ReferralStatus,
  RewardKind,
} from "./types.js";
import { makeOwnerAmbassadorId } from "./types.js";
import { ambassadorStore } from "./ambassador-store.js";
import { generateReferralLink } from "./referral-link-generator.js";
import { calculateTier } from "./tier-calculator.js";
import { calculateReward } from "./reward-calculator.js";
import {
  createInquiry,
  transitionStatus,
  applyExpiry,
} from "./inquiry-tracker.js";

// ── In-memory stores for links, inquiries, rewards ─────────────────────────
// These are kept in-memory for simplicity (same pattern as highlight-extractor)

const _links = new Map<ReferralLinkId, ReferralLink>();
const _inquiries = new Map<ReferralInquiryId, ReferralInquiry>();
const _rewards = new Map<string, ReferralReward>();

/** テスト用リセット */
export function _resetFacade(): void {
  _links.clear();
  _inquiries.clear();
  _rewards.clear();
}

// ── ID counter ─────────────────────────────────────────────────────────────

let _ambassadorCounter = 0;

function newAmbassadorId(): OwnerAmbassadorId {
  return makeOwnerAmbassadorId(`amb-${Date.now()}-${++_ambassadorCounter}`);
}

// ── Create ambassador ──────────────────────────────────────────────────────

/**
 * 新しいアンバサダーを作成して保存・返却する。
 */
export function createAmbassador(
  ownerName: string,
  completedProjectId: string,
  now = new Date(),
): OwnerAmbassador {
  const ambassador: OwnerAmbassador = {
    id: newAmbassadorId(),
    ownerName,
    completedProjectId,
    registeredAt: now.toISOString(),
    tier: "bronze",
    referralLinkIds: [],
    contractedReferralCount: 0,
    totalContractedAmountJpy: 0,
    totalRewardAmountJpy: 0,
  };

  ambassadorStore.add(ambassador);
  return ambassador;
}

// ── Issue referral link ────────────────────────────────────────────────────

/**
 * アンバサダーに紹介リンクを発行する。
 */
export function issueReferralLink(
  ambassadorId: OwnerAmbassadorId,
  channel: ReferralChannel,
  expiryDays?: number,
  now = new Date(),
): ReferralLink | null {
  const ambassador = ambassadorStore.get(ambassadorId);
  if (!ambassador) return null;

  const link = generateReferralLink(ambassadorId, channel, expiryDays, now);
  _links.set(link.id, link);

  // Update ambassador's link list
  ambassadorStore.update(ambassadorId, {
    referralLinkIds: [...ambassador.referralLinkIds, link.id],
  });

  return link;
}

// ── Record inquiry ─────────────────────────────────────────────────────────

/**
 * 紹介リンク経由の問合せを記録する。
 */
export function recordReferralInquiry(
  referralLinkId: ReferralLinkId,
  inquirerName: string,
  description: string,
  now = new Date(),
): ReferralInquiry | null {
  const link = _links.get(referralLinkId);
  if (!link) return null;

  const inquiry = createInquiry(referralLinkId, link.ambassadorId, inquirerName, description, now);
  _inquiries.set(inquiry.id, inquiry);
  return inquiry;
}

// ── Update inquiry status ──────────────────────────────────────────────────

/**
 * 問合せのステータスを遷移させる。
 */
export function updateInquiryStatus(
  inquiryId: ReferralInquiryId,
  newStatus: ReferralStatus,
  contractAmountJpy?: number,
  now = new Date(),
): ReferralInquiry | null {
  const inquiry = _inquiries.get(inquiryId);
  if (!inquiry) return null;

  const updated = transitionStatus(inquiry, newStatus, contractAmountJpy, now);
  if (!updated) return null;

  _inquiries.set(inquiryId, updated);
  return updated;
}

// ── Finalize reward ────────────────────────────────────────────────────────

/**
 * 紹介報酬を確定させる。
 * contracted/completed の問合せのみ対象。
 * 報酬算出 → tier更新 → ストア反映 を連鎖する。
 */
export function finalizeReferralReward(
  inquiryId: ReferralInquiryId,
  kind: RewardKind = "cash",
  now = new Date(),
): ReferralReward | null {
  const inquiry = _inquiries.get(inquiryId);
  if (!inquiry) return null;
  if (inquiry.status !== "contracted" && inquiry.status !== "completed") return null;
  if (!inquiry.contractAmountJpy) return null;

  const ambassador = ambassadorStore.get(inquiry.ambassadorId);
  if (!ambassador) return null;

  // 1. Update contracted count and amount
  const newCount = ambassador.contractedReferralCount + 1;
  const newAmount = ambassador.totalContractedAmountJpy + inquiry.contractAmountJpy;

  // 2. Recalculate tier
  const newTier = calculateTier(newCount, newAmount);

  // 3. Calculate reward using new tier
  const reward = calculateReward(
    inquiry.ambassadorId,
    inquiryId,
    inquiry.contractAmountJpy,
    newTier,
    kind,
    now,
  );

  _rewards.set(reward.id, reward);

  // 4. Update ambassador store
  ambassadorStore.update(inquiry.ambassadorId, {
    tier: newTier,
    contractedReferralCount: newCount,
    totalContractedAmountJpy: newAmount,
    totalRewardAmountJpy: ambassador.totalRewardAmountJpy + reward.amountJpy,
  });

  return reward;
}

// ── Query helpers ──────────────────────────────────────────────────────────

/** アンバサダー一覧 */
export function listAmbassadors(limit = 100): OwnerAmbassador[] {
  return ambassadorStore.getAll(limit);
}

/** IDでアンバサダーを取得 */
export function getAmbassador(id: OwnerAmbassadorId): OwnerAmbassador | null {
  return ambassadorStore.get(id);
}

/** アンバサダーの紹介リンク一覧 */
export function getLinksForAmbassador(ambassadorId: OwnerAmbassadorId): ReferralLink[] {
  return Array.from(_links.values()).filter((l) => l.ambassadorId === ambassadorId);
}

/** 全紹介リンク一覧 */
export function listAllLinks(): ReferralLink[] {
  return Array.from(_links.values());
}

/** 全問合せ一覧 (失効チェック適用) */
export function listAllInquiries(now = new Date()): ReferralInquiry[] {
  const result: ReferralInquiry[] = [];
  for (const [id, inquiry] of _inquiries) {
    const checked = applyExpiry(inquiry, now);
    if (checked !== inquiry) {
      _inquiries.set(id, checked);
    }
    result.push(checked);
  }
  return result;
}

/** 全報酬一覧 */
export function listAllRewards(): ReferralReward[] {
  return Array.from(_rewards.values());
}
