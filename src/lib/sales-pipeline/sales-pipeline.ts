/**
 * sales-pipeline — ファサード
 *
 * Sprint 16-B: 営業パイプライン可視化
 *
 * intakeFromInquiry(inquiry) → Deal
 * transitionDeal(dealId, toStage)
 * markWon(dealId, contractAmountJpy)
 * markLost(dealId, reason)
 * currentSnapshot()
 * riskAlerts()
 */

import type {
  Deal,
  DealStage,
  LossReason,
  PipelineSnapshot,
  RiskAlert,
} from "./types.js";
import type { InquiryRecord } from "../inquiry-responder/types.js";
import { dealStore } from "./deal-store.js";
import { transition } from "./stage-transition-engine.js";
import { recommendProbability, DEFAULT_STAGE_PROBABILITY } from "./probability-model.js";
import { snapshot } from "./pipeline-snapshotter.js";
import { detectStalls } from "./stall-detector.js";

// ── ID generation ──────────────────────────────────────────────────────────

let _seqCounter = 0;

function generateId(): string {
  _seqCounter++;
  const ts = Date.now().toString(36);
  const seq = String(_seqCounter).padStart(4, "0");
  return `deal-${ts}-${seq}`;
}

/** Reset counter — for testing only */
export function _resetDealIdCounter(): void {
  _seqCounter = 0;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Sprint 16-A の InquiryRecord を Deal に昇格させる。
 */
export function intakeFromInquiry(inquiry: InquiryRecord): Deal {
  const now = new Date().toISOString();
  const id = generateId();

  // 期待クローズ日 = 今日から90日後
  const closeDate = new Date();
  closeDate.setDate(closeDate.getDate() + 90);
  const expectedCloseDate = closeDate.toISOString().split("T")[0];

  // 見積上限を期待金額として使用
  const expectedAmountJpy = inquiry.estimatedRangeJpy.upperJpy;

  const deal: Deal = {
    id,
    inquiryId: inquiry.id,
    customerName: inquiry.customerName ?? "不明",
    currentStage: "inquiry",
    expectedAmountJpy,
    probabilityPct: DEFAULT_STAGE_PROBABILITY.inquiry,
    expectedCloseDate,
    ownerName: "新山光輝",
    stageHistory: [],
    notes: inquiry.rawText,
    createdAt: now,
    updatedAt: now,
  };

  dealStore.save(deal);
  return deal;
}

/**
 * 商談のステージを遷移させる。
 */
export function transitionDeal(
  dealId: string,
  toStage: DealStage,
  transitionedAt: Date = new Date(),
): Deal | null {
  const deal = dealStore.byId(dealId);
  if (!deal) return null;

  const updated = transition(deal, toStage, transitionedAt);
  // 確度を自動更新 (won/lost は固定)
  if (toStage !== "won" && toStage !== "lost") {
    updated.probabilityPct = recommendProbability(updated);
  }
  dealStore.save(updated);
  return updated;
}

/**
 * 商談を受注クローズする。
 */
export function markWon(
  dealId: string,
  contractAmountJpy?: number,
): Deal | null {
  const deal = dealStore.byId(dealId);
  if (!deal) return null;

  const updated = transition(deal, "won");
  if (contractAmountJpy !== undefined) {
    updated.expectedAmountJpy = contractAmountJpy;
  }
  updated.probabilityPct = 100;
  dealStore.save(updated);
  return updated;
}

/**
 * 商談を失注クローズする。
 */
export function markLost(
  dealId: string,
  reason: LossReason,
): Deal | null {
  const deal = dealStore.byId(dealId);
  if (!deal) return null;

  const updated = transition(deal, "lost");
  updated.lossReason = reason;
  updated.probabilityPct = 0;
  dealStore.save(updated);
  return updated;
}

/**
 * 現時点のパイプラインスナップショットを返す。
 */
export function currentSnapshot(): PipelineSnapshot {
  const deals = dealStore.getAll();
  return snapshot(deals);
}

/**
 * リスクアラート一覧を返す (severity 順)。
 */
export function riskAlerts(): RiskAlert[] {
  const deals = dealStore.getAll();
  return detectStalls(deals);
}
