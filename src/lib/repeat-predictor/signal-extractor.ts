/**
 * signal-extractor — CustomerJobHistory → RepeatSignal
 *
 * Aggregates job history into signals used by the prediction pipeline.
 */

import type { CustomerJobHistory, RepeatSignal } from "./types.js";

/**
 * Extract RepeatSignal from a customer's job history.
 * Reference date defaults to now (used in tests for determinism).
 */
export function extractSignal(
  history: CustomerJobHistory,
  referenceDate: Date = new Date(),
): RepeatSignal {
  const { jobs } = history;

  if (jobs.length === 0) {
    return {
      jobsCount: 0,
      lastJobMonthsAgo: 999,
      avgIntervalMonths: null,
      totalRevenue: 0,
      avgMarginPct: 0,
      lastSatisfactionScore: null,
      complaintCount: 0,
      referralCount: 0,
    };
  }

  // Sort chronologically
  const sorted = [...jobs].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const lastJob = sorted[sorted.length - 1];

  const lastJobDate = new Date(lastJob.completedAt);
  const diffMs = referenceDate.getTime() - lastJobDate.getTime();
  const lastJobMonthsAgo = Math.max(0, diffMs / (1000 * 60 * 60 * 24 * 30.44));

  // Average interval between jobs (months)
  let avgIntervalMonths: number | null = null;
  if (sorted.length >= 2) {
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].completedAt);
      const curr = new Date(sorted[i].completedAt);
      const diffMonths = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      intervals.push(diffMonths);
    }
    avgIntervalMonths = intervals.reduce((sum, v) => sum + v, 0) / intervals.length;
  }

  const totalRevenue = jobs.reduce((sum, j) => sum + j.revenueYen, 0);
  const avgMarginPct = jobs.reduce((sum, j) => sum + j.marginPct, 0) / jobs.length;

  // Latest satisfaction score (from most recent job that has one)
  const withScore = sorted.filter((j) => j.satisfactionScore !== null);
  const lastSatisfactionScore =
    withScore.length > 0
      ? withScore[withScore.length - 1].satisfactionScore
      : null;

  const complaintCount = jobs.filter((j) => j.hasComplaint).length;
  const referralCount = jobs.filter((j) => j.isReferral).length;

  return {
    jobsCount: jobs.length,
    lastJobMonthsAgo,
    avgIntervalMonths,
    totalRevenue,
    avgMarginPct,
    lastSatisfactionScore,
    complaintCount,
    referralCount,
  };
}
