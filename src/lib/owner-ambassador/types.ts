/**
 * Owner Ambassador — shared types.
 *
 * Sprint 18-C: 施主アンバサダー化
 * 完工後の施主に紹介報酬+紹介リンク発行+紹介経由問合せの自動報酬計算で OB 顧客から新案件を獲得。
 */

// ── Branded types ──────────────────────────────────────────────────────────

export type OwnerAmbassadorId = string & { readonly __brand: "OwnerAmbassadorId" };
export type ReferralLinkId = string & { readonly __brand: "ReferralLinkId" };
export type ReferralInquiryId = string & { readonly __brand: "ReferralInquiryId" };
export type ReferralRewardId = string & { readonly __brand: "ReferralRewardId" };

export function makeOwnerAmbassadorId(raw: string): OwnerAmbassadorId {
  return raw as OwnerAmbassadorId;
}

export function makeReferralLinkId(raw: string): ReferralLinkId {
  return raw as ReferralLinkId;
}

export function makeReferralInquiryId(raw: string): ReferralInquiryId {
  return raw as ReferralInquiryId;
}

export function makeReferralRewardId(raw: string): ReferralRewardId {
  return raw as ReferralRewardId;
}

// ── Enumerations ───────────────────────────────────────────────────────────

export type AmbassadorTier = "bronze" | "silver" | "gold" | "platinum";

export type ReferralStatus =
  | "pending"
  | "contacted"
  | "quoted"
  | "contracted"
  | "completed"
  | "expired";

export type RewardKind =
  | "cash"
  | "giftcard"
  | "maintenance_credit"
  | "upgrade_credit";

export type ReferralChannel =
  | "line"
  | "email"
  | "sns"
  | "qr_code"
  | "direct_link";

// ── Domain objects ─────────────────────────────────────────────────────────

export type OwnerAmbassador = {
  id: OwnerAmbassadorId;
  ownerName: string;
  /** 完工した案件のプロジェクトID */
  completedProjectId: string;
  /** アンバサダー登録日 */
  registeredAt: string;
  tier: AmbassadorTier;
  /** 紹介リンクID一覧 */
  referralLinkIds: ReferralLinkId[];
  /** 成約した紹介数 */
  contractedReferralCount: number;
  /** 紹介経由の総成約金額 (JPY) */
  totalContractedAmountJpy: number;
  /** 獲得した報酬総額 (JPY) */
  totalRewardAmountJpy: number;
};

export type ReferralLink = {
  id: ReferralLinkId;
  ambassadorId: OwnerAmbassadorId;
  channel: ReferralChannel;
  url: string;
  /** QRコード用テキスト */
  qrText: string;
  createdAt: string;
  /** 期限 ISO 文字列 */
  expiresAt: string;
  /** アクセス数 */
  clickCount: number;
  isActive: boolean;
};

export type ReferralInquiry = {
  id: ReferralInquiryId;
  referralLinkId: ReferralLinkId;
  ambassadorId: OwnerAmbassadorId;
  /** 問合せ者の名前 */
  inquirerName: string;
  /** 問合せ内容 */
  description: string;
  status: ReferralStatus;
  createdAt: string;
  updatedAt: string;
  /** 成約金額 — contracted/completed 時のみ */
  contractAmountJpy?: number;
};

export type ReferralReward = {
  id: ReferralRewardId;
  ambassadorId: OwnerAmbassadorId;
  referralInquiryId: ReferralInquiryId;
  kind: RewardKind;
  /** 報酬金額 (JPY) */
  amountJpy: number;
  /** 適用された報酬率 (小数: 0.01 = 1%) */
  rewardRate: number;
  /** 税務処理メモ */
  taxNoteJa: string;
  calculatedAt: string;
  /** 支払済みかどうか */
  isPaid: boolean;
};

export type AmbassadorTierConfig = {
  tier: AmbassadorTier;
  /** 日本語表示名 */
  labelJa: string;
  /** 紹介成約数による昇格基準 */
  minContractedReferrals: number;
  /** 総成約金額による昇格基準 (JPY) — 0は金額基準なし */
  minTotalAmountJpy: number;
  /** 報酬率 (小数: 0.01 = 1%) */
  rewardRate: number;
};

// ── Tier configurations ────────────────────────────────────────────────────

export const TIER_CONFIGS: Record<AmbassadorTier, AmbassadorTierConfig> = {
  bronze: {
    tier: "bronze",
    labelJa: "ブロンズ",
    minContractedReferrals: 0,
    minTotalAmountJpy: 0,
    rewardRate: 0.01,
  },
  silver: {
    tier: "silver",
    labelJa: "シルバー",
    minContractedReferrals: 1,
    minTotalAmountJpy: 0,
    rewardRate: 0.02,
  },
  gold: {
    tier: "gold",
    labelJa: "ゴールド",
    minContractedReferrals: 3,
    minTotalAmountJpy: 5_000_000,
    rewardRate: 0.03,
  },
  platinum: {
    tier: "platinum",
    labelJa: "プラチナ",
    minContractedReferrals: 5,
    minTotalAmountJpy: 15_000_000,
    rewardRate: 0.05,
  },
};

// ── Label maps ─────────────────────────────────────────────────────────────

export const AMBASSADOR_TIER_LABELS: Record<AmbassadorTier, string> = {
  bronze: "ブロンズ",
  silver: "シルバー",
  gold: "ゴールド",
  platinum: "プラチナ",
};

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  pending: "問合せ中",
  contacted: "連絡済み",
  quoted: "見積済み",
  contracted: "成約",
  completed: "完工",
  expired: "失効",
};

export const REWARD_KIND_LABELS: Record<RewardKind, string> = {
  cash: "現金",
  giftcard: "ギフトカード",
  maintenance_credit: "メンテナンスクレジット",
  upgrade_credit: "アップグレードクレジット",
};

export const REFERRAL_CHANNEL_LABELS: Record<ReferralChannel, string> = {
  line: "LINE",
  email: "メール",
  sns: "SNS",
  qr_code: "QRコード",
  direct_link: "直接リンク",
};
