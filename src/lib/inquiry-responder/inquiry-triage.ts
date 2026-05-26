/**
 * inquiry-triage — 新規問合せの優先度算出.
 */

import type { InquiryRecord, InquiryPriority, InquiryChannel, WorkScale } from "./types.js";

// ── Priority rules ─────────────────────────────────────────────────────────

/** 「至急/急ぎ」キーワード */
const URGENT_KEYWORDS = ["至急", "急ぎ", "緊急", "すぐ", "今すぐ", "早急", "なるべく早く", "急いで"];

function hasUrgentKeyword(text: string): boolean {
  return URGENT_KEYWORDS.some((kw) => text.includes(kw));
}

const CHANNEL_PRIORITY: Record<InquiryChannel, InquiryPriority> = {
  phone_memo: "high",
  hp_form: "medium",
  line: "medium",
  discord: "medium",
  email: "normal",
};

const SCALE_PRIORITY: Record<WorkScale, InquiryPriority | null> = {
  extra_large: "high",
  large: "medium",
  medium: null,
  small: null,
};

const PRIORITY_ORDER: Record<InquiryPriority, number> = {
  urgent: 3,
  high: 2,
  medium: 1,
  normal: 0,
};

function maxPriority(...priorities: InquiryPriority[]): InquiryPriority {
  return priorities.reduce((a, b) =>
    PRIORITY_ORDER[a] >= PRIORITY_ORDER[b] ? a : b,
  );
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 問合せレコードから優先度を算出する。
 * urgent > high > medium > normal の順。
 */
export function triageInquiry(record: InquiryRecord): InquiryPriority {
  // 至急キーワード → urgent
  if (hasUrgentKeyword(record.rawText)) return "urgent";

  const channelPriority = CHANNEL_PRIORITY[record.channel];
  const scalePriority = SCALE_PRIORITY[record.extractedRequirements.workScale] ?? "normal";

  return maxPriority(channelPriority, scalePriority);
}

/**
 * priorityLabel — 優先度の日本語ラベル
 */
export function priorityLabel(priority: InquiryPriority): string {
  const labels: Record<InquiryPriority, string> = {
    urgent: "至急",
    high: "高",
    medium: "中",
    normal: "通常",
  };
  return labels[priority];
}
