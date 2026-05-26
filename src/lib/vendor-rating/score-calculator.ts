/**
 * Vendor Rating AI — score calculator
 * 4軸別スコア計算: positive/(positive+negative) * 100
 * 直近30日 weight×1.5、365日超 weight×0.3
 * eventCount<3 は信頼度低として overall に ×0.7 ペナルティ
 */

import { VendorEventKind } from "./types.js";
import type { VendorEvent, VendorScore } from "./types.js";

const POSITIVE_KINDS = new Set<VendorEventKind>([
  VendorEventKind.DeliveryOnTime,
  VendorEventKind.QualityPass,
  VendorEventKind.QuoteCompetitive,
  VendorEventKind.CommResponsive,
]);

const NEGATIVE_KINDS = new Set<VendorEventKind>([
  VendorEventKind.DeliveryLate,
  VendorEventKind.QualityRework,
  VendorEventKind.QuoteHigh,
  VendorEventKind.CommSlow,
]);

const AXIS_KINDS: Record<"delivery" | "quality" | "price" | "comm", VendorEventKind[]> = {
  delivery: [VendorEventKind.DeliveryOnTime, VendorEventKind.DeliveryLate],
  quality: [VendorEventKind.QualityPass, VendorEventKind.QualityRework],
  price: [VendorEventKind.QuoteCompetitive, VendorEventKind.QuoteHigh],
  comm: [VendorEventKind.CommResponsive, VendorEventKind.CommSlow],
};

function timeWeight(occurredAt: string, now: Date): number {
  const msPerDay = 86_400_000;
  const ageDays = (now.getTime() - new Date(occurredAt).getTime()) / msPerDay;
  if (ageDays <= 30) return 1.5;
  if (ageDays > 365) return 0.3;
  return 1.0;
}

function axisScore(
  events: VendorEvent[],
  kinds: VendorEventKind[],
  now: Date,
): number {
  const subset = events.filter((e) => kinds.includes(e.kind));
  if (subset.length === 0) return 50; // neutral when no data

  let positiveW = 0;
  let negativeW = 0;
  for (const e of subset) {
    const tw = timeWeight(e.occurredAt, now);
    const ew = e.weight * tw;
    if (POSITIVE_KINDS.has(e.kind)) {
      positiveW += ew;
    } else if (NEGATIVE_KINDS.has(e.kind)) {
      negativeW += ew;
    }
  }

  const total = positiveW + negativeW;
  if (total === 0) return 50;
  return Math.round((positiveW / total) * 100);
}

export function calculateScore(events: VendorEvent[]): VendorScore {
  if (events.length === 0) {
    const now = new Date().toISOString();
    return {
      vendorId: "",
      deliveryScore: 50,
      qualityScore: 50,
      priceScore: 50,
      commScore: 50,
      overallScore: 50,
      eventCount: 0,
      lastUpdated: now,
    };
  }

  const vendorId = events[0].vendorId;
  const now = new Date();

  const deliveryScore = axisScore(events, AXIS_KINDS.delivery, now);
  const qualityScore = axisScore(events, AXIS_KINDS.quality, now);
  const priceScore = axisScore(events, AXIS_KINDS.price, now);
  const commScore = axisScore(events, AXIS_KINDS.comm, now);

  const rawOverall =
    deliveryScore * 0.3 +
    qualityScore * 0.35 +
    priceScore * 0.2 +
    commScore * 0.15;

  const overallScore =
    events.length < 3
      ? Math.round(rawOverall * 0.7)
      : Math.round(rawOverall);

  return {
    vendorId,
    deliveryScore,
    qualityScore,
    priceScore,
    commScore,
    overallScore,
    eventCount: events.length,
    lastUpdated: now.toISOString(),
  };
}
