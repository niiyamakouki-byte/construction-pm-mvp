/**
 * referral-link-generator — 紹介リンクの生成・管理
 *
 * Sprint 18-C: 施主アンバサダー化
 */

import type { ReferralLink, ReferralChannel } from "./types.js";
import { makeReferralLinkId } from "./types.js";
import type { OwnerAmbassadorId } from "./types.js";

// ── Constants ──────────────────────────────────────────────────────────────

const BASE_URL = "https://genbahub.app/referral";
const DEFAULT_EXPIRY_DAYS = 90;

// ── ID generation ──────────────────────────────────────────────────────────

let _counter = 0;

function generateLinkId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const seq = (++_counter).toString(36).padStart(3, "0");
  return `rl-${ts}-${rand}-${seq}`;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 紹介リンクを生成する。
 * @param ambassadorId アンバサダーID
 * @param channel 配布チャネル
 * @param expiryDays 有効期限(日数)。省略時は90日
 * @param now 現在時刻 (テスト用オーバーライド)
 */
export function generateReferralLink(
  ambassadorId: OwnerAmbassadorId,
  channel: ReferralChannel,
  expiryDays = DEFAULT_EXPIRY_DAYS,
  now = new Date(),
): ReferralLink {
  const id = makeReferralLinkId(generateLinkId());
  const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

  const url = `${BASE_URL}/${id}?a=${ambassadorId}&ch=${channel}`;
  const qrText = url;

  return {
    id,
    ambassadorId,
    channel,
    url,
    qrText,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    clickCount: 0,
    isActive: true,
  };
}

/**
 * リンクが有効期限内かどうか確認する。
 */
export function isLinkActive(link: ReferralLink, now = new Date()): boolean {
  if (!link.isActive) return false;
  return new Date(link.expiresAt) > now;
}

/**
 * リンクのクリック数をインクリメントして返す。
 */
export function incrementClickCount(link: ReferralLink): ReferralLink {
  return { ...link, clickCount: link.clickCount + 1 };
}

/** テスト用カウンターリセット */
export function _resetLinkCounter(): void {
  _counter = 0;
}
