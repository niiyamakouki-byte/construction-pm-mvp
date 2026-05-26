/**
 * repeat-predictor — combines RFM scores into repeatProbability and next order forecast.
 */

import type { RepeatSignal, RepeatPrediction, PredictionConfig, ConfidenceLevel, CustomerSegment } from "./types.js";
import { DEFAULT_PREDICTION_CONFIG } from "./types.js";
import { computeAllScores } from "./rfm-scorer.js";
import { classifySegment } from "./segment-classifier.js";
import { recommendAction_ja } from "./action-recommender.js";

/**
 * Build reasoning text in Japanese.
 */
function buildReasoning(
  signal: RepeatSignal,
  segment: CustomerSegment,
  probability: number,
): string {
  const parts: string[] = [];

  if (signal.jobsCount === 0) {
    return "案件履歴なし。予測精度が低い状態です。";
  }

  parts.push(`発注${signal.jobsCount}回`);

  if (signal.lastJobMonthsAgo < 3) {
    parts.push("直近3ヶ月以内に発注あり");
  } else if (signal.lastJobMonthsAgo < 6) {
    parts.push("最終発注から3〜6ヶ月");
  } else if (signal.lastJobMonthsAgo < 12) {
    parts.push("最終発注から6〜12ヶ月");
  } else {
    parts.push(`最終発注から${Math.round(signal.lastJobMonthsAgo)}ヶ月経過`);
  }

  if (signal.referralCount > 0) {
    parts.push(`紹介${signal.referralCount}件あり`);
  }
  if (signal.complaintCount > 0) {
    parts.push(`クレーム${signal.complaintCount}件`);
  }
  if (signal.lastSatisfactionScore !== null) {
    parts.push(`満足度${signal.lastSatisfactionScore}/5`);
  }

  const pctLabel = Math.round(probability * 100);
  return `${parts.join("、")}。セグメント: ${segment}。リピート確率: ${pctLabel}%。`;
}

/**
 * Determine confidence level based on data richness.
 */
function computeConfidence(signal: RepeatSignal): ConfidenceLevel {
  if (signal.jobsCount >= 3 && signal.lastSatisfactionScore !== null) return "high";
  if (signal.jobsCount >= 2) return "med";
  return "low";
}

/**
 * Predict next order timing (months from now).
 * Based on avgInterval minus time already elapsed since last order.
 * Floors at 1 month, defaults to 12 if no interval data.
 */
function predictNextOrderMonths(signal: RepeatSignal): number {
  if (signal.avgIntervalMonths === null) {
    // Only one job — default 12 months
    return Math.max(1, 12 - signal.lastJobMonthsAgo);
  }
  const remaining = signal.avgIntervalMonths - signal.lastJobMonthsAgo;
  return Math.max(1, Math.round(remaining));
}

/**
 * Compute repeat probability from weighted RFM scores.
 * Result clamped to [0, 1].
 */
export function predictRepeat(
  customerId: string,
  signal: RepeatSignal,
  config: PredictionConfig = DEFAULT_PREDICTION_CONFIG,
): RepeatPrediction {
  const scores = computeAllScores(signal);
  const { weights } = config;

  // Weighted sum
  const rawScore =
    scores.recencyScore * weights.recency +
    scores.frequencyScore * weights.frequency +
    scores.monetaryScore * weights.monetary +
    scores.satisfactionScore * weights.satisfaction +
    scores.referralScore * weights.referral;

  // Clamp to [0, 1]
  const repeatProbability = Math.min(1, Math.max(0, rawScore));

  const segment = classifySegment(signal, scores);
  const confidenceLevel = computeConfidence(signal);
  const predictedNextOrderMonths = predictNextOrderMonths(signal);
  const reasoning_ja = buildReasoning(signal, segment, repeatProbability);
  const recommendedAction_ja = recommendAction_ja(segment, signal);

  return {
    customerId,
    segment,
    repeatProbability,
    predictedNextOrderMonths,
    confidenceLevel,
    reasoning_ja,
    recommendedAction_ja,
    scoreBreakdown: {
      recencyScore: scores.recencyScore,
      frequencyScore: scores.frequencyScore,
      monetaryScore: scores.monetaryScore,
      satisfactionScore: scores.satisfactionScore,
      referralScore: scores.referralScore,
    },
  };
}
