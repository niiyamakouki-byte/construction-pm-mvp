/**
 * Vendor Rating AI — types
 * 協力会社の4軸スコアリング (納期/品質/価格/コミュニケーション)
 */

export enum VendorEventKind {
  DeliveryOnTime = "delivery_on_time",
  DeliveryLate = "delivery_late",
  QualityPass = "quality_pass",
  QualityRework = "quality_rework",
  QuoteCompetitive = "quote_competitive",
  QuoteHigh = "quote_high",
  CommResponsive = "comm_responsive",
  CommSlow = "comm_slow",
}

export type VendorEvent = {
  id: string;
  vendorId: string;
  projectId: string;
  kind: VendorEventKind;
  /** positive/negative weight multiplier — default 1.0 */
  weight: number;
  occurredAt: string; // ISO 8601
  notes?: string;
};

export type VendorScore = {
  vendorId: string;
  deliveryScore: number; // 0-100
  qualityScore: number; // 0-100
  priceScore: number; // 0-100
  commScore: number; // 0-100
  overallScore: number; // 0-100, weighted composite
  eventCount: number;
  lastUpdated: string; // ISO 8601
};

export type VendorRecommendation = {
  vendorId: string;
  vendorName: string;
  overallScore: number;
  rank: number;
  signal: "recommended" | "caution" | "avoid";
  reasons: string[];
};
