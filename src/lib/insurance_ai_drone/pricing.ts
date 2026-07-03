/**
 * ターゲットセグメント別料金プラン
 * Sprint 60-C: 工事保険AI査定 + ドローン現場検証
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type TargetSegment =
  | "general_contractor" // 元請
  | "insurance_agent" // 代理店
  | "loss_adjuster" // 損害調査
  | "risk_manager"; // リスクマネジメント

export type PlanTier = "starter" | "professional" | "enterprise";

export type PlanFeature = {
  label: string;
  included: boolean;
};

export type InsurancePlan = {
  tier: PlanTier;
  name: string;
  monthlyPriceJpy: number;
  annualPriceJpy: number;
  targetSegments: TargetSegment[];
  features: PlanFeature[];
  maxProjectsPerMonth: number;
  droneAssessmentsPerMonth: number;
  aiAssessmentsPerMonth: number;
  supportLevel: "email" | "chat" | "dedicated";
};

export type PlanRecommendation = {
  plan: InsurancePlan;
  reason: string;
  alternativePlan?: InsurancePlan;
};

// ── Plan definitions ───────────────────────────────────────────────────────

export const INSURANCE_PLANS: InsurancePlan[] = [
  {
    tier: "starter",
    name: "スターター",
    monthlyPriceJpy: 22_000,
    annualPriceJpy: 22_000 * 12 * 0.9, // 10%年払い割引
    targetSegments: ["general_contractor"],
    features: [
      { label: "保険AI査定 (月20件まで)", included: true },
      { label: "ドローン写真解析 (月5件まで)", included: true },
      { label: "PML計算", included: true },
      { label: "PDF査定レポート", included: true },
      { label: "freee連携", included: false },
      { label: "API連携", included: false },
      { label: "カスタム約款設定", included: false },
      { label: "専任サポート", included: false },
    ],
    maxProjectsPerMonth: 20,
    droneAssessmentsPerMonth: 5,
    aiAssessmentsPerMonth: 20,
    supportLevel: "email",
  },
  {
    tier: "professional",
    name: "プロフェッショナル",
    monthlyPriceJpy: 48_000,
    annualPriceJpy: 48_000 * 12 * 0.9,
    targetSegments: ["insurance_agent", "loss_adjuster"],
    features: [
      { label: "保険AI査定 (月100件まで)", included: true },
      { label: "ドローン写真解析 (月30件まで)", included: true },
      { label: "PML計算", included: true },
      { label: "PDF査定レポート", included: true },
      { label: "freee連携", included: true },
      { label: "API連携 (基本)", included: true },
      { label: "カスタム約款設定", included: false },
      { label: "専任サポート", included: false },
    ],
    maxProjectsPerMonth: 100,
    droneAssessmentsPerMonth: 30,
    aiAssessmentsPerMonth: 100,
    supportLevel: "chat",
  },
  {
    tier: "enterprise",
    name: "エンタープライズ",
    monthlyPriceJpy: 130_000,
    annualPriceJpy: 130_000 * 12 * 0.85, // 15%年払い割引
    targetSegments: ["risk_manager", "insurance_agent", "loss_adjuster"],
    features: [
      { label: "保険AI査定 (無制限)", included: true },
      { label: "ドローン写真解析 (無制限)", included: true },
      { label: "PML計算", included: true },
      { label: "PDF査定レポート", included: true },
      { label: "freee連携", included: true },
      { label: "API連携 (フル)", included: true },
      { label: "カスタム約款設定", included: true },
      { label: "専任サポート", included: true },
    ],
    maxProjectsPerMonth: Infinity,
    droneAssessmentsPerMonth: Infinity,
    aiAssessmentsPerMonth: Infinity,
    supportLevel: "dedicated",
  },
];

const SEGMENT_LABELS: Record<TargetSegment, string> = {
  general_contractor: "元請",
  insurance_agent: "代理店",
  loss_adjuster: "損害調査",
  risk_manager: "リスクマネジメント",
};

// ── getRecommendedPlan ─────────────────────────────────────────────────────

/**
 * セグメントと月間案件数からプランを推奨
 *
 * @param segment ターゲットセグメント
 * @param projectVolume 月間案件件数
 * @returns 推奨プランと代替プラン
 */
export function getRecommendedPlan(
  segment: TargetSegment,
  projectVolume: number,
): PlanRecommendation {
  const segmentLabel = SEGMENT_LABELS[segment];

  // 大規模: エンタープライズ
  if (
    projectVolume > 50 ||
    segment === "risk_manager" ||
    (segment === "loss_adjuster" && projectVolume > 20)
  ) {
    return {
      plan: INSURANCE_PLANS[2], // enterprise
      reason: `${segmentLabel}セグメントで月${projectVolume}件の案件規模にはエンタープライズプランが最適です`,
      alternativePlan: INSURANCE_PLANS[1],
    };
  }

  // 中規模: プロフェッショナル
  if (
    projectVolume > 10 ||
    segment === "insurance_agent" ||
    segment === "loss_adjuster"
  ) {
    return {
      plan: INSURANCE_PLANS[1], // professional
      reason: `${segmentLabel}セグメントで月${projectVolume}件の規模にはプロフェッショナルプランが最適です`,
      alternativePlan: projectVolume > 30 ? INSURANCE_PLANS[2] : INSURANCE_PLANS[0],
    };
  }

  // 小規模: スターター
  return {
    plan: INSURANCE_PLANS[0], // starter
    reason: `${segmentLabel}セグメントで月${projectVolume}件規模ならスタータープランでご利用開始いただけます`,
    alternativePlan: INSURANCE_PLANS[1],
  };
}

/** プランのラベル表示用ヘルパー */
export function formatPlanPrice(plan: InsurancePlan): string {
  return `¥${plan.monthlyPriceJpy.toLocaleString("ja-JP")}/月`;
}

/** 全プラン一覧を月額昇順で返す */
export function getAllPlans(): InsurancePlan[] {
  return [...INSURANCE_PLANS].sort((a, b) => a.monthlyPriceJpy - b.monthlyPriceJpy);
}
