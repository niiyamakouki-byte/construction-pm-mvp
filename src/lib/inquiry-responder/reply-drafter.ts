/**
 * reply-drafter — 日本語一次返信ドラフトを生成する.
 */

import type {
  InquiryRecord,
  ExtractedRequirements,
  EstimatedRange,
  MeetingSlotProposal,
  WorkCategory,
  WorkScale,
} from "./types.js";

// ── Labels ─────────────────────────────────────────────────────────────────

const CATEGORY_LABEL_JA: Record<WorkCategory, string> = {
  kitchen: "キッチン工事",
  bath: "浴室工事",
  store_fit: "店舗内装工事",
  office_fit: "オフィス内装工事",
  full_renovation: "全面リノベーション",
  partial_renovation: "部分リフォーム",
  exterior: "外装・外壁工事",
  repair: "補修・修繕工事",
  other: "内装工事",
};

const SCALE_LABEL_JA: Record<WorkScale, string> = {
  small: "小規模",
  medium: "中規模",
  large: "大規模",
  extra_large: "超大規模",
};

const TIME_RANGE_LABEL_JA: Record<string, string> = {
  morning: "午前",
  afternoon: "午後",
  evening: "夕方",
};

// ── Formatters ─────────────────────────────────────────────────────────────

function formatJpy(yen: number): string {
  if (yen >= 100_000_000) {
    return `${(yen / 100_000_000).toFixed(1)}億円`;
  }
  if (yen >= 10_000) {
    return `${Math.round(yen / 10_000)}万円`;
  }
  return `${yen.toLocaleString()}円`;
}

function formatSlot(slot: MeetingSlotProposal, index: number): string {
  const label = TIME_RANGE_LABEL_JA[slot.timeRange] ?? slot.timeRange;
  return `  第${index + 1}候補: ${slot.note_ja.replace(/ /g, "")} ${label}`;
}

// ── Flags ──────────────────────────────────────────────────────────────────

/**
 * WorkScale が large 以上かつ confidence が high → 現地調査推奨フラグ
 */
export function shouldRecommendSiteVisit(
  reqs: ExtractedRequirements,
  range: EstimatedRange,
): boolean {
  return (
    (reqs.workScale === "large" || reqs.workScale === "extra_large") &&
    range.confidence === "high"
  );
}

/**
 * WorkCategory が repair かつ WorkScale が small 以下 → 即日対応可能性あり
 */
export function canHandleSameDay(reqs: ExtractedRequirements): boolean {
  return reqs.workCategory === "repair" && reqs.workScale === "small";
}

// ── Draft builder ──────────────────────────────────────────────────────────

/**
 * 受付番号 (4桁ゼロ埋め) を生成する。
 * id から数字を抽出して使用。
 */
function receiptNumber(id: string): string {
  const digits = id.replace(/\D/g, "").slice(-4).padStart(4, "0");
  return digits || "0001";
}

export function draftReply(record: {
  id: string;
  customerName: string | null;
  extractedRequirements: ExtractedRequirements;
  estimatedRangeJpy: EstimatedRange;
  proposedSlots: MeetingSlotProposal[];
}): string {
  const {
    id,
    customerName,
    extractedRequirements: reqs,
    estimatedRangeJpy: range,
    proposedSlots: slots,
  } = record;

  const nameLabel = customerName ? `${customerName} 様` : "お客様";
  const receiptNum = receiptNumber(id);
  const categoryLabel = CATEGORY_LABEL_JA[reqs.workCategory];
  const scaleLabel = SCALE_LABEL_JA[reqs.workScale];
  const lowerStr = formatJpy(range.lowerJpy);
  const upperStr = formatJpy(range.upperJpy);

  const siteVisitNote = shouldRecommendSiteVisit(reqs, range)
    ? "\n【現地調査推奨】規模・金額が大きいため、正確なお見積りには現地調査をお勧めしております。"
    : "";

  const sameDayNote = canHandleSameDay(reqs)
    ? "\n【即日対応】小規模修繕については即日〜数日以内の対応が可能な場合がございます。お急ぎの場合はお電話にてご相談ください。"
    : "";

  const slotsSection =
    slots.length > 0
      ? `\n■ お打合せ候補日時\n${slots.map((s, i) => formatSlot(s, i)).join("\n")}\n\nご都合のよい日時をお知らせいただくか、上記以外のご希望がございましたらお申し付けください。`
      : "";

  const locationNote = reqs.locationCity
    ? `\nご住所エリア: ${reqs.locationCity}`
    : "";

  return `件名: 【ラポルタ】お問い合わせありがとうございます (受付#${receiptNum})

${nameLabel}

この度はラポルタへお問い合わせいただきまして、誠にありがとうございます。
受付番号 #${receiptNum} にてお問い合わせ内容を確認いたしました。

■ お問い合わせ概要
工事種別: ${categoryLabel} (${scaleLabel})${locationNote}

■ 概算お見積りレンジ (現地調査前の参考値)
${lowerStr} 〜 ${upperStr} (税別・現地調査前の概算です)
※ 実際の工事内容・仕様により大きく異なる場合がございます。${siteVisitNote}${sameDayNote}
${slotsSection}

■ 次のステップ
・ご希望の日程をご返信いただくか、
・直接お電話でのご相談も受け付けております。
  TEL: 03-6876-7749 (平日 9:00〜18:00)

どうぞよろしくお願いいたします。

━━━━━━━━━━━━━━━━━━━━━━━━━
株式会社ラポルタ
〒156-0051 東京都世田谷区給田5-12-12
TEL: 03-6876-7749
━━━━━━━━━━━━━━━━━━━━━━━━━`.trim();
}

/**
 * InquiryRecord 全体からドラフトを生成するショートハンド。
 */
export function draftReplyFromRecord(record: InquiryRecord): string {
  return draftReply(record);
}
