/**
 * Repeat Predictor — shared types.
 *
 * Sprint 14-C: 顧客リピート率予測
 * 過去案件履歴から顧客のリピート確率と次回発注時期を予測。
 */

// ── Enums ──────────────────────────────────────────────────────────────────

export type CustomerSegment = "vip" | "loyal" | "promising" | "dormant" | "at_risk";

export type ConfidenceLevel = "low" | "med" | "high";

// ── Domain objects ─────────────────────────────────────────────────────────

/**
 * Signals extracted from a customer's job history for prediction.
 */
export type RepeatSignal = {
  /** 発注回数 */
  jobsCount: number;
  /** 最終発注からの経過月数 */
  lastJobMonthsAgo: number;
  /** 平均発注間隔 (月) — 1件のみの場合は null */
  avgIntervalMonths: number | null;
  /** 累計受注額 (JPY) */
  totalRevenue: number;
  /** 平均粗利率 (%) */
  avgMarginPct: number;
  /** 最終満足度スコア (0–5) — null = 未記録 */
  lastSatisfactionScore: number | null;
  /** クレーム件数 */
  complaintCount: number;
  /** 紹介実績件数 */
  referralCount: number;
};

/**
 * Prediction result for a single customer.
 */
export type RepeatPrediction = {
  customerId: string;
  segment: CustomerSegment;
  /** リピート確率 (0–1) */
  repeatProbability: number;
  /** 次回発注予測月数 (今から何ヶ月後) */
  predictedNextOrderMonths: number;
  confidenceLevel: ConfidenceLevel;
  /** 根拠説明 (日本語) */
  reasoning_ja: string;
  /** 推奨アクション (日本語) */
  recommendedAction_ja: string;
  scoreBreakdown: {
    recencyScore: number;
    frequencyScore: number;
    monetaryScore: number;
    satisfactionScore: number;
    referralScore: number;
  };
};

/**
 * A single job record in customer history.
 */
export type CustomerJob = {
  jobId: string;
  /** ISO 8601 date string */
  completedAt: string;
  /** 受注額 (JPY) */
  revenueYen: number;
  /** 粗利率 (%) */
  marginPct: number;
  /** 満足度 (0–5) — null = 未記録 */
  satisfactionScore: number | null;
  /** クレームあり */
  hasComplaint: boolean;
  /** 紹介案件か */
  isReferral: boolean;
};

/**
 * Complete job history for a single customer.
 */
export type CustomerJobHistory = {
  customerId: string;
  customerName: string;
  jobs: CustomerJob[];
  /** 累計生涯価値 (JPY) */
  totalLifetimeValue: number;
};

// ── Config ─────────────────────────────────────────────────────────────────

export type PredictionConfig = {
  weights: {
    recency: number;
    frequency: number;
    monetary: number;
    satisfaction: number;
    referral: number;
  };
};

export const DEFAULT_PREDICTION_CONFIG: PredictionConfig = {
  weights: {
    recency: 0.30,
    frequency: 0.25,
    monetary: 0.20,
    satisfaction: 0.15,
    referral: 0.10,
  },
};
