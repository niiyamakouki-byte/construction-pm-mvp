/**
 * Sales Pipeline — shared types.
 *
 * Sprint 16-B: 営業パイプライン可視化
 * 問合せ → 初回返信 → 現調 → 提案 → 契約 → 着工 の各ステージを可視化。
 */

// ── Enums ──────────────────────────────────────────────────────────────────

export type DealStage =
  | "inquiry"
  | "first_reply"
  | "site_survey"
  | "proposal"
  | "contract"
  | "kickoff"
  | "won"
  | "lost";

export type LossReason =
  | "price"
  | "schedule"
  | "competitor"
  | "unresponsive"
  | "scope_mismatch"
  | "other";

// ── Domain objects ──────────────────────────────────────────────────────────

export type StageTransition = {
  fromStage: DealStage;
  toStage: DealStage;
  /** ISO 8601 datetime */
  transitionedAt: string;
  daysInPreviousStage: number;
};

export type Deal = {
  id: string;
  inquiryId?: string;
  customerName: string;
  currentStage: DealStage;
  expectedAmountJpy: number;
  probabilityPct: number;
  /** ISO 8601 date string: YYYY-MM-DD */
  expectedCloseDate: string;
  ownerName: string;
  stageHistory: StageTransition[];
  lossReason?: LossReason;
  /** ISO 8601 datetime */
  lostAt?: string;
  /** ISO 8601 datetime */
  wonAt?: string;
  notes?: string;
  /** ISO 8601 datetime */
  createdAt: string;
  /** ISO 8601 datetime */
  updatedAt: string;
};

export type RiskAlert = {
  dealId: string;
  alertType: "stalled" | "near_due_no_action" | "low_probability_high_amount";
  severity: "info" | "warn" | "critical";
  message: string;
};

export type PipelineSnapshot = {
  totalDeals: number;
  weightedPipelineJpy: number;
  stalledDeals: Deal[];
  expectedClosesThisMonth: number;
  riskAlerts: RiskAlert[];
};

export type StageMetrics = {
  stage: DealStage;
  dealCount: number;
  totalAmountJpy: number;
  weightedAmountJpy: number;
  avgDaysInStage: number;
  conversionRateToNext: number;
};
