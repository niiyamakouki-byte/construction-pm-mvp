/**
 * rfm-scorer — Recency / Frequency / Monetary score normalization.
 *
 * Each scorer returns a value in [0, 1].
 */

import type { RepeatSignal } from "./types.js";

/**
 * Recency score: 0 = very long ago, 1 = recent
 *   0–3 months ago → 1.0
 *   3–6 months ago → 0.8
 *   6–12 months ago → 0.5
 *   12–24 months ago → 0.2
 *   24+ months ago → 0.0
 */
export function recencyScore(signal: RepeatSignal): number {
  const m = signal.lastJobMonthsAgo;
  if (m <= 3) return 1.0;
  if (m <= 6) return 0.8;
  if (m <= 12) return 0.5;
  if (m <= 24) return 0.2;
  return 0.0;
}

/**
 * Frequency score: 0 = one-time, 1 = very frequent
 *   1 job → 0.1
 *   2 jobs → 0.3
 *   3 jobs → 0.5
 *   4 jobs → 0.7
 *   5 jobs → 0.85
 *   6+ jobs → 1.0
 */
export function frequencyScore(signal: RepeatSignal): number {
  const n = signal.jobsCount;
  if (n <= 0) return 0.0;
  if (n === 1) return 0.1;
  if (n === 2) return 0.3;
  if (n === 3) return 0.5;
  if (n === 4) return 0.7;
  if (n === 5) return 0.85;
  return 1.0;
}

/**
 * Monetary score: 0 = low LTV, 1 = high LTV
 *   < 1M JPY → 0.1
 *   1M–5M → 0.3
 *   5M–10M → 0.5
 *   10M–20M → 0.7
 *   20M–30M → 0.9
 *   30M+ → 1.0
 */
export function monetaryScore(signal: RepeatSignal): number {
  const v = signal.totalRevenue;
  if (v < 1_000_000) return 0.1;
  if (v < 5_000_000) return 0.3;
  if (v < 10_000_000) return 0.5;
  if (v < 20_000_000) return 0.7;
  if (v < 30_000_000) return 0.9;
  return 1.0;
}

/**
 * Satisfaction score: 0 = very unhappy, 1 = delighted
 * Null satisfaction → 0.5 (neutral default)
 * Complaints reduce score.
 */
export function satisfactionScore(signal: RepeatSignal): number {
  let base: number;
  if (signal.lastSatisfactionScore === null) {
    base = 0.5;
  } else {
    base = signal.lastSatisfactionScore / 5;
  }
  // Each complaint reduces by 0.1, floor at 0
  const penalty = Math.min(signal.complaintCount * 0.1, base);
  return Math.max(0, base - penalty);
}

/**
 * Referral score: 0 = no referrals, 1 = heavy referrer
 *   0 referrals → 0.0
 *   1 referral → 0.4
 *   2 referrals → 0.7
 *   3+ referrals → 1.0
 */
export function referralScore(signal: RepeatSignal): number {
  const r = signal.referralCount;
  if (r === 0) return 0.0;
  if (r === 1) return 0.4;
  if (r === 2) return 0.7;
  return 1.0;
}

/**
 * Convenience: compute all five scores for a signal.
 */
export function computeAllScores(signal: RepeatSignal): {
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  satisfactionScore: number;
  referralScore: number;
} {
  return {
    recencyScore: recencyScore(signal),
    frequencyScore: frequencyScore(signal),
    monetaryScore: monetaryScore(signal),
    satisfactionScore: satisfactionScore(signal),
    referralScore: referralScore(signal),
  };
}
