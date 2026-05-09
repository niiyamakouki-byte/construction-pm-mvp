/**
 * Inquiry Responder — shared types.
 *
 * Sprint 16-A: 問合せ→初回返信AI
 * HP/LINE/Discord/メール経由の施主問合せから要件抽出・概算見積・候補日・一次返信ドラフトを生成。
 */

// ── Enums ──────────────────────────────────────────────────────────────────

export type InquiryChannel =
  | "hp_form"
  | "line"
  | "discord"
  | "email"
  | "phone_memo";

export type InquiryStatus =
  | "new"
  | "triaged"
  | "replied"
  | "scheduled"
  | "closed_won"
  | "closed_lost";

export type WorkScale =
  | "small"      // 〜100万
  | "medium"     // 100万-500万
  | "large"      // 500万-2000万
  | "extra_large"; // 2000万〜

export type WorkCategory =
  | "full_renovation"
  | "partial_renovation"
  | "kitchen"
  | "bath"
  | "store_fit"
  | "office_fit"
  | "exterior"
  | "repair"
  | "other";

export type ConfidenceLevel = "low" | "medium" | "high";

export type InquiryPriority = "normal" | "medium" | "high" | "urgent";

// ── Domain objects ──────────────────────────────────────────────────────────

export type ExtractedRequirements = {
  workCategory: WorkCategory;
  workScale: WorkScale;
  /** 例: "世田谷区", "渋谷区" */
  locationCity: string | null;
  /** 予算ヒント (JPY) — 未記載時は null */
  budgetHintJpy: number | null;
  /** 希望着工月 (1-12) — 未記載時は null */
  desiredStartMonth: number | null;
  /** "email" | "phone" | "line" | "discord" | null */
  contactPreference: "email" | "phone" | "line" | "discord" | null;
};

export type EstimatedRange = {
  lowerJpy: number;
  upperJpy: number;
  confidence: ConfidenceLevel;
  /** 算出根拠 (日本語) */
  basisNotes_ja: string;
};

export type MeetingSlotProposal = {
  /** ISO 8601 date string: YYYY-MM-DD */
  slotDateIso: string;
  timeRange: "morning" | "afternoon" | "evening";
  note_ja: string;
};

export type InquiryRecord = {
  id: string;
  channel: InquiryChannel;
  /** ISO 8601 datetime */
  receivedAt: string;
  rawText: string;
  customerName: string | null;
  customerContact: string | null;
  extractedRequirements: ExtractedRequirements;
  estimatedRangeJpy: EstimatedRange;
  proposedSlots: MeetingSlotProposal[];
  draftReplyJa: string;
  status: InquiryStatus;
  priority: InquiryPriority;
  createdAt: string;
  updatedAt: string;
};

// ── Config ──────────────────────────────────────────────────────────────────

export type ResponderConfig = {
  /** 営業開始時 (hour, 24h) */
  businessHoursStart: number;
  /** 営業終了時 (hour, 24h) */
  businessHoursEnd: number;
  /** 提案開始日 = 今日 + leadDays */
  leadDays: number;
  /** 候補日数 */
  proposalCount: number;
  /** 土日を含めるか */
  includeWeekend: boolean;
};

export const DEFAULT_RESPONDER_CONFIG: ResponderConfig = {
  businessHoursStart: 9,
  businessHoursEnd: 18,
  leadDays: 3,
  proposalCount: 3,
  includeWeekend: true,
};
