/**
 * auto-estimate-pipeline — 問い合わせメッセージから自動見積を生成する
 *
 * 既存 intent-parser / cost-lookup を再利用。DOM / LLM 依存なし。
 */

import { parseIntent } from "../estimate-assistant/intent-parser.js";
import { lookupEstimate } from "../estimate-assistant/cost-lookup.js";
import type { EstimateRange } from "../estimate-assistant/cost-lookup.js";
import type { EstimateIntent } from "../estimate-assistant/intent-parser.js";
import type { CostMaster } from "../estimate-assistant/cost-lookup.js";
import type { ContactSubmission } from "./contact-webhook-receiver.js";
import costMasterData from "../../resources/cost-master.json";

const costMaster = costMasterData as CostMaster;

// ── 型定義 ───────────────────────────────────────────────────────────────────

export type AutoEstimateResult = {
  submission: ContactSubmission;
  intent: EstimateIntent;
  estimate: EstimateRange;
  /** パース精度 (low: 部屋/面積不明, high: 両方あり) */
  confidence: "low" | "medium" | "high";
};

// ── メイン関数 ───────────────────────────────────────────────────────────────

/**
 * 問い合わせの message テキストを intent-parser に投入し、
 * cost-lookup で松竹梅レンジを算出して返す。
 */
export function runAutoEstimate(submission: ContactSubmission): AutoEstimateResult {
  const intent = parseIntent(submission.message);
  const estimate = lookupEstimate(intent, costMaster);

  const confidence = calcConfidence(intent);

  return {
    submission,
    intent,
    estimate,
    confidence,
  };
}

// ── 内部ヘルパー ─────────────────────────────────────────────────────────────

function calcConfidence(intent: EstimateIntent): "low" | "medium" | "high" {
  const hasRoom = intent.roomType !== undefined;
  const hasArea = intent.area !== undefined;
  if (hasRoom && hasArea) return "high";
  if (hasRoom || hasArea || intent.tasks.length > 0) return "medium";
  return "low";
}
