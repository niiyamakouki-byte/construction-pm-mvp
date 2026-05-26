/**
 * inquiry-tracker — 紹介問合せの記録・ステータス遷移・失効処理
 *
 * Sprint 18-C: 施主アンバサダー化
 *
 * ステータス遷移:
 *   pending → contacted → quoted → contracted → completed
 *   any → expired (180日無音で自動失効)
 */

import type { ReferralInquiry, ReferralStatus } from "./types.js";
import { makeReferralInquiryId } from "./types.js";
import type { ReferralLinkId, OwnerAmbassadorId } from "./types.js";

// ── Constants ──────────────────────────────────────────────────────────────

const EXPIRY_DAYS = 180;

// ── ID generation ──────────────────────────────────────────────────────────

let _counter = 0;

function generateInquiryId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `ri-${ts}-${rand}-${(++_counter).toString(36)}`;
}

// ── Valid transitions ──────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<ReferralStatus, ReferralStatus[]> = {
  pending: ["contacted", "expired"],
  contacted: ["quoted", "expired"],
  quoted: ["contracted", "expired"],
  contracted: ["completed", "expired"],
  completed: [],
  expired: [],
};

/**
 * 遷移が有効かどうかチェックする。
 */
export function isValidTransition(from: ReferralStatus, to: ReferralStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 新しい紹介問合せを作成する。
 */
export function createInquiry(
  referralLinkId: ReferralLinkId,
  ambassadorId: OwnerAmbassadorId,
  inquirerName: string,
  description: string,
  now = new Date(),
): ReferralInquiry {
  return {
    id: makeReferralInquiryId(generateInquiryId()),
    referralLinkId,
    ambassadorId,
    inquirerName,
    description,
    status: "pending",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/**
 * ステータスを遷移させる。
 * 無効な遷移の場合は null を返す。
 */
export function transitionStatus(
  inquiry: ReferralInquiry,
  newStatus: ReferralStatus,
  contractAmountJpy?: number,
  now = new Date(),
): ReferralInquiry | null {
  if (!isValidTransition(inquiry.status, newStatus)) return null;

  const updated: ReferralInquiry = {
    ...inquiry,
    status: newStatus,
    updatedAt: now.toISOString(),
  };

  if (newStatus === "contracted" || newStatus === "completed") {
    if (contractAmountJpy !== undefined) {
      updated.contractAmountJpy = contractAmountJpy;
    }
  }

  return updated;
}

/**
 * 問合せが失効すべきかどうか確認する (180日無音)。
 */
export function shouldExpire(inquiry: ReferralInquiry, now = new Date()): boolean {
  if (inquiry.status === "completed" || inquiry.status === "expired") return false;
  const updatedAt = new Date(inquiry.updatedAt);
  const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceUpdate >= EXPIRY_DAYS;
}

/**
 * 失効すべき問合せを expired に変更して返す。
 * 失効不要な場合はそのまま返す。
 */
export function applyExpiry(inquiry: ReferralInquiry, now = new Date()): ReferralInquiry {
  if (!shouldExpire(inquiry, now)) return inquiry;
  return { ...inquiry, status: "expired", updatedAt: now.toISOString() };
}

/** テスト用カウンターリセット */
export function _resetInquiryCounter(): void {
  _counter = 0;
}
