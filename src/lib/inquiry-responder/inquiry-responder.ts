/**
 * inquiry-responder — ファサード
 *
 * intake(channel, rawText, customerName?, customerContact?) → InquiryRecord
 * extract → range → slots → draft → triage → save
 */

import type {
  InquiryRecord,
  InquiryChannel,
  InquiryStatus,
  MeetingSlotProposal,
  ResponderConfig,
} from "./types.js";
import { DEFAULT_RESPONDER_CONFIG } from "./types.js";
import { inquiryStore } from "./inquiry-store.js";
import { extractRequirements } from "./requirement-extractor.js";
import { estimateRange } from "./range-estimator.js";
import { proposeSlots } from "./slot-proposer.js";
import { draftReply } from "./reply-drafter.js";
import { triageInquiry } from "./inquiry-triage.js";

// ── ID generation ──────────────────────────────────────────────────────────

let _seqCounter = 0;

function generateId(): string {
  _seqCounter++;
  const ts = Date.now().toString(36);
  const seq = String(_seqCounter).padStart(4, "0");
  return `inq-${ts}-${seq}`;
}

/** Reset counter — for testing only */
export function _resetIdCounter(): void {
  _seqCounter = 0;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 新規問合せを受け付けて InquiryRecord を生成・保存して返す。
 */
export function intake(
  channel: InquiryChannel,
  rawText: string,
  customerName?: string | null,
  customerContact?: string | null,
  config: ResponderConfig = DEFAULT_RESPONDER_CONFIG,
  baseDate: Date = new Date(),
): InquiryRecord {
  const id = generateId();
  const now = baseDate.toISOString();

  // 1. 要件抽出
  const extractedRequirements = extractRequirements(rawText, baseDate);

  // 2. 概算見積レンジ算出
  const estimatedRangeJpy = estimateRange(
    extractedRequirements.workCategory,
    extractedRequirements.workScale,
    extractedRequirements.budgetHintJpy,
  );

  // 3. 候補日生成
  const proposedSlots = proposeSlots(baseDate, config);

  // 4. 一次返信ドラフト生成
  const partialRecord = {
    id,
    customerName: customerName ?? null,
    extractedRequirements,
    estimatedRangeJpy,
    proposedSlots,
  };
  const draftReplyJa = draftReply(partialRecord);

  // 5. 優先度算出 (triage)
  const tempRecord: InquiryRecord = {
    id,
    channel,
    receivedAt: now,
    rawText,
    customerName: customerName ?? null,
    customerContact: customerContact ?? null,
    extractedRequirements,
    estimatedRangeJpy,
    proposedSlots,
    draftReplyJa,
    status: "new",
    priority: "normal",
    createdAt: now,
    updatedAt: now,
  };
  const priority = triageInquiry(tempRecord);

  const record: InquiryRecord = {
    ...tempRecord,
    status: "triaged",
    priority,
  };

  // 6. 保存
  inquiryStore.add(record);

  return record;
}

/**
 * ステータスで問合せを絞り込む。
 */
export function listByStatus(status: InquiryStatus): InquiryRecord[] {
  return inquiryStore.byStatus(status);
}

/**
 * 優先度 "urgent" または "high" の問合せ一覧。
 */
export function listUrgent(): InquiryRecord[] {
  return inquiryStore.all().filter(
    (r) => r.priority === "urgent" || r.priority === "high",
  );
}

/**
 * 問合せを「返信済み」に更新する。
 */
export function markReplied(id: string): InquiryRecord | null {
  const record = inquiryStore.byId(id);
  if (!record) return null;
  const updated: InquiryRecord = {
    ...record,
    status: "replied",
    updatedAt: new Date().toISOString(),
  };
  inquiryStore.update(updated);
  return updated;
}

/**
 * 問合せを「打合せ予約済み」に更新する。
 */
export function markScheduled(
  id: string,
  chosenSlot: MeetingSlotProposal,
): InquiryRecord | null {
  const record = inquiryStore.byId(id);
  if (!record) return null;
  const updated: InquiryRecord = {
    ...record,
    status: "scheduled",
    proposedSlots: [chosenSlot, ...record.proposedSlots.filter(
      (s) => s.slotDateIso !== chosenSlot.slotDateIso || s.timeRange !== chosenSlot.timeRange,
    )],
    updatedAt: new Date().toISOString(),
  };
  inquiryStore.update(updated);
  return updated;
}

/**
 * 問合せをクローズする (won / lost)。
 */
export function markClosed(
  id: string,
  won: boolean,
): InquiryRecord | null {
  const record = inquiryStore.byId(id);
  if (!record) return null;
  const updated: InquiryRecord = {
    ...record,
    status: won ? "closed_won" : "closed_lost",
    updatedAt: new Date().toISOString(),
  };
  inquiryStore.update(updated);
  return updated;
}
