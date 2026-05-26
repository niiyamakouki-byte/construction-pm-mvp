/**
 * Owner Suggestion — shared types.
 *
 * Sprint 18-A: 施主提案AI
 * 施主の希望(予算/家族構成/趣味/ライフスタイル)から、最適な内装プラン3案を
 * AIが自動生成し、見積根拠+施工事例リンク+メンテ計画まで一括提示する。
 */

// ── Branded types ──────────────────────────────────────────────────────────

export type OwnerSuggestionId = string & { readonly __brand: "OwnerSuggestionId" };

export function makeOwnerSuggestionId(raw: string): OwnerSuggestionId {
  return raw as OwnerSuggestionId;
}

// ── Enumerations ───────────────────────────────────────────────────────────

export type LifestyleTag =
  | "cooking"
  | "work_from_home"
  | "entertain_guests"
  | "pet_owner"
  | "elderly_care";

export type PriorityRanking =
  | "priceFirst"
  | "qualityFirst"
  | "designFirst"
  | "durabilityFirst";

export type SuggestionPlanKind =
  | "budget_focused"
  | "balanced"
  | "premium"
  | "design_focused"
  | "family_friendly";

export type SuggestionPlanStatus =
  | "draft"
  | "presented"
  | "in_review"
  | "accepted"
  | "rejected";

// ── Domain objects ─────────────────────────────────────────────────────────

export type OwnerProfile = {
  /** 施主名 */
  ownerName: string;
  /** 予算 (円) */
  budget: number;
  /** 家族人数 */
  familySize: number;
  /** 年齢帯 (例: "30s", "40s", "60s+") */
  ageRange: string;
  /** ライフスタイルタグ (最大5つ) */
  lifestyle: LifestyleTag[];
  /** 優先ランキング */
  priorityRanking: PriorityRanking;
};

export type MaterialHighlight = {
  /** 箇所 (例: "LDK壁紙", "床材") */
  location: string;
  /** 材料名 */
  materialName: string;
  /** 特徴説明 */
  featureJa: string;
};

export type MaintenanceForecast = {
  /** 引渡し後の点検間隔 (月) */
  intervalMonths: number;
  /** 点検内容 */
  descriptionJa: string;
};

export type SuggestionPlan = {
  id: string;
  kind: SuggestionPlanKind;
  status: SuggestionPlanStatus;
  /** プランタイトル */
  titleJa: string;
  /** コンセプト説明 */
  conceptJa: string;
  /** 概算費用 (円) */
  estimatedCost: number;
  /** 概算工期 (日) */
  estimatedDays: number;
  /** 選定根拠 */
  rationaleJa: string;
  /** 材料ハイライト */
  materialHighlights: MaterialHighlight[];
  /** メンテ予測 */
  maintenanceForecast: MaintenanceForecast[];
  /** リスク注記 */
  riskNotes: string[];
};

export type OwnerSuggestion = {
  id: OwnerSuggestionId;
  projectId: string;
  ownerProfile: OwnerProfile;
  /** 3案固定 */
  plans: [SuggestionPlan, SuggestionPlan, SuggestionPlan];
  /** 生成日時 ISO 8601 */
  generatedAt: string;
  /** 施主提示日時 ISO 8601 (任意) */
  presentedAt?: string;
  /** 施主が決定したプランID (任意) */
  decidedPlanId?: string;
};

// ── Label maps ─────────────────────────────────────────────────────────────

export const LIFESTYLE_TAG_LABELS: Record<LifestyleTag, string> = {
  cooking: "料理好き",
  work_from_home: "在宅ワーク",
  entertain_guests: "来客多い",
  pet_owner: "ペット飼育",
  elderly_care: "介護対応",
};

export const PRIORITY_RANKING_LABELS: Record<PriorityRanking, string> = {
  priceFirst: "コスト優先",
  qualityFirst: "品質優先",
  designFirst: "デザイン優先",
  durabilityFirst: "耐久性優先",
};

export const PLAN_KIND_LABELS: Record<SuggestionPlanKind, string> = {
  budget_focused: "コストプラン",
  balanced: "バランスプラン",
  premium: "プレミアムプラン",
  design_focused: "デザインプラン",
  family_friendly: "ファミリープラン",
};

export const PLAN_STATUS_LABELS: Record<SuggestionPlanStatus, string> = {
  draft: "下書き",
  presented: "提示済み",
  in_review: "検討中",
  accepted: "採用決定",
  rejected: "見送り",
};
