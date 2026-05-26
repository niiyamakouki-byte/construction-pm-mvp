/**
 * Vendor Rating AI — recommendation engine
 * カテゴリ別に業者をスコアリングし推奨順で返す
 * signal: ≥70 recommended / 40-69 caution / <40 avoid
 */

import { VendorEventKind } from "./types.js";
import type { VendorRecommendation, VendorScore } from "./types.js";
import { calculateScore } from "./score-calculator.js";
import { getVendorEventStore } from "./event-store.js";

/** 最小業者型 — 既存の Vendor (vendor-management.ts) か Contractor (domain/types.ts) を流用可 */
export type Vendor = {
  id: string;
  name: string;
  category?: string;
  skills?: string[];
};

function buildReasons(score: VendorScore, vendorId: string): string[] {
  const reasons: string[] = [];
  const store = getVendorEventStore();
  const events = store.eventsByVendor(vendorId);

  if (events.length === 0) {
    reasons.push("履歴データなし — 初回発注");
    return reasons;
  }

  // 直近10件
  const recent10 = [...events]
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 10);

  const onTimeCount = recent10.filter(
    (e) => e.kind === VendorEventKind.DeliveryOnTime,
  ).length;
  const lateCount = recent10.filter(
    (e) => e.kind === VendorEventKind.DeliveryLate,
  ).length;
  if (onTimeCount + lateCount > 0) {
    reasons.push(`直近${recent10.length}件中${onTimeCount}件納期遵守`);
  }

  // 過去6ヶ月の再施工
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const reworkCount = events.filter(
    (e) =>
      e.kind === VendorEventKind.QualityRework &&
      new Date(e.occurredAt) >= sixMonthsAgo,
  ).length;
  if (reworkCount > 0) {
    reasons.push(`過去6ヶ月で再施工${reworkCount}件発生`);
  }

  if (score.deliveryScore >= 80) {
    reasons.push("納期遵守率が高い");
  } else if (score.deliveryScore < 40) {
    reasons.push("納期遅延が多い — 注意");
  }

  if (score.qualityScore >= 80) {
    reasons.push("品質評価が高い");
  } else if (score.qualityScore < 40) {
    reasons.push("品質問題の履歴あり");
  }

  if (score.priceScore >= 80) {
    reasons.push("競争力のある価格設定");
  } else if (score.priceScore < 40) {
    reasons.push("見積が高め");
  }

  if (score.commScore >= 80) {
    reasons.push("レスポンスが良好");
  } else if (score.commScore < 40) {
    reasons.push("連絡が遅い傾向あり");
  }

  if (score.eventCount < 3) {
    reasons.push("データ件数が少ないためスコアは暫定値");
  }

  return reasons;
}

function signalFromScore(score: number): "recommended" | "caution" | "avoid" {
  if (score >= 70) return "recommended";
  if (score >= 40) return "caution";
  return "avoid";
}

export function recommendForCategory(
  _category: string,
  vendors: Vendor[],
): VendorRecommendation[] {
  const store = getVendorEventStore();

  const recommendations: VendorRecommendation[] = vendors.map((vendor) => {
    const events = store.eventsByVendor(vendor.id);
    const score = calculateScore(events);
    const reasons = buildReasons(score, vendor.id);

    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      overallScore: score.overallScore,
      rank: 0, // 後で採番
      signal: signalFromScore(score.overallScore),
      reasons,
    };
  });

  // overallScore 降順ソート
  recommendations.sort((a, b) => b.overallScore - a.overallScore);

  // rank 採番 (1-based)
  recommendations.forEach((r, i) => {
    r.rank = i + 1;
  });

  return recommendations;
}
