/**
 * segment-classifier — maps RFM scores + signals to CustomerSegment.
 *
 * Classification priority (highest wins):
 *   at_risk   — complaint count ≥ 2, OR (satisfaction < 3 AND complaintCount ≥ 1)
 *   vip       — monetaryScore ≥ 0.7 AND frequencyScore ≥ 0.7 AND referralScore ≥ 0.4
 *   dormant   — lastJobMonthsAgo ≥ 12
 *   loyal     — frequencyScore ≥ 0.5 AND recencyScore ≥ 0.2
 *   promising — jobsCount ≥ 1
 *   (fallback: promising)
 */

import type { CustomerSegment, RepeatSignal } from "./types.js";

export type RFMScores = {
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  satisfactionScore: number;
  referralScore: number;
};

export function classifySegment(
  signal: RepeatSignal,
  scores: RFMScores,
): CustomerSegment {
  const { recencyScore, frequencyScore, monetaryScore, referralScore } = scores;

  // at_risk: complaints or very low satisfaction
  if (
    signal.complaintCount >= 2 ||
    (signal.lastSatisfactionScore !== null &&
      signal.lastSatisfactionScore < 3 &&
      signal.complaintCount >= 1)
  ) {
    return "at_risk";
  }

  // vip: high value + frequent + referral
  if (
    monetaryScore >= 0.7 &&
    frequencyScore >= 0.7 &&
    referralScore >= 0.4
  ) {
    return "vip";
  }

  // dormant: hasn't ordered in 12+ months
  if (signal.lastJobMonthsAgo >= 12) {
    return "dormant";
  }

  // loyal: regular buyer, still somewhat recent
  if (frequencyScore >= 0.5 && recencyScore >= 0.2) {
    return "loyal";
  }

  // promising: has at least 1 job
  if (signal.jobsCount >= 1) {
    return "promising";
  }

  return "promising";
}
