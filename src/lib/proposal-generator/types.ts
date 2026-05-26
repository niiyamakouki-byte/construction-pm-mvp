/**
 * Proposal Generator — shared types.
 *
 * Sprint 16-C: 競合提案書自動生成
 * 問合せ要件 + 商談情報から、ラポルタの強み・類似施工事例・価格・工期・差別化ポイントを含む
 * 提案書ドキュメントを自動生成する。
 */

// ── WorkCategory / WorkScale (inquiry-responder と同型) ────────────────────

export type WorkCategory =
  | "full_renovation"
  | "partial_renovation"
  | "kitchen"
  | "bath"
  | "store_fit"
  | "office_fit"
  | "exterior"
  | "repair"
  | "other";

export type WorkScale =
  | "small"
  | "medium"
  | "large"
  | "extra_large";

// ── Section kinds ──────────────────────────────────────────────────────────

export type ProposalSectionKind =
  | "cover"
  | "executive_summary"
  | "customer_situation"
  | "our_strengths"
  | "case_studies"
  | "price_range"
  | "schedule"
  | "differentiation"
  | "next_step"
  | "appendix";

// ── Domain objects ─────────────────────────────────────────────────────────

export type ProposalSection = {
  kind: ProposalSectionKind;
  titleJa: string;
  bodyJa: string;
  callouts?: string[];
  orderIndex: number;
};

export type ProposalDocument = {
  id: string;
  dealId?: string;
  inquiryId?: string;
  customerName: string;
  generatedAt: string;
  sections: ProposalSection[];
  coverImage?: string;
  totalPriceJpyLower: number;
  totalPriceJpyUpper: number;
  durationDays: number;
  /** ISO 8601 date string: YYYY-MM-DD */
  validUntil: string;
};

export type LaportaStrength = {
  id: string;
  titleJa: string;
  bodyJa: string;
  evidence?: string;
  /** 0.0 〜 1.0 — category 別重み付けに使う */
  weight: number;
};

export type CaseStudy = {
  id: string;
  projectName: string;
  workCategory: WorkCategory;
  /** "小規模" / "中規模" / "大規模" など */
  scaleJa: string;
  workScale: WorkScale;
  /** YYYY-MM */
  completedYearMonth: string;
  anonymizedClient: string;
  photoUrl?: string;
  summaryJa: string;
  achievementJa: string;
  customerVoiceJa?: string;
};

export type DifferentiationPoint = {
  id: string;
  axisJa: string;
  laportaPositionJa: string;
  competitorPositionJa: string;
  advantageJa: string;
};

export type ProposalGenerationInput = {
  inquiryId?: string;
  dealId?: string;
  workCategory: WorkCategory;
  workScale: WorkScale;
  locationCity: string;
  budgetHintJpy?: number;
  styleTags?: string[];
  desiredStartMonth?: number;
  customerName: string;
};

export type ProposalGenerationOptions = {
  includeCases: boolean;
  includeDifferentiation: boolean;
  language: "ja";
};

export type ProposalRenderTarget = "markdown" | "html" | "pdf_data";

// ── Default options ────────────────────────────────────────────────────────

export const DEFAULT_GENERATION_OPTIONS: ProposalGenerationOptions = {
  includeCases: true,
  includeDifferentiation: true,
  language: "ja",
};
