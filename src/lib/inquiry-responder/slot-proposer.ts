/**
 * slot-proposer — 営業時間内の打合せ候補日を生成する.
 */

import type { MeetingSlotProposal, ResponderConfig } from "./types.js";
import { DEFAULT_RESPONDER_CONFIG } from "./types.js";

// ── Time range helpers ─────────────────────────────────────────────────────

type TimeRange = "morning" | "afternoon" | "evening";

const TIME_RANGE_LABEL_JA: Record<TimeRange, string> = {
  morning: "午前 (9:00〜12:00)",
  afternoon: "午後 (13:00〜17:00)",
  evening: "夕方 (17:00〜19:00)",
};

/**
 * businessHoursStart/End から使用できる timeRange 一覧を返す。
 */
function availableTimeRanges(config: ResponderConfig): TimeRange[] {
  const ranges: TimeRange[] = [];
  if (config.businessHoursStart <= 9 && config.businessHoursEnd >= 12) {
    ranges.push("morning");
  }
  if (config.businessHoursStart <= 13 && config.businessHoursEnd >= 17) {
    ranges.push("afternoon");
  }
  if (config.businessHoursStart <= 17 && config.businessHoursEnd >= 19) {
    ranges.push("evening");
  }
  if (ranges.length === 0) {
    // フォールバック
    ranges.push("afternoon");
  }
  return ranges;
}

/** ISO 8601 date string (YYYY-MM-DD) を返す */
function toDateIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 曜日を日本語で返す */
function dayOfWeekJa(date: Date): string {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return days[date.getDay()];
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 基準日から leadDays 後以降で proposalCount 件の候補スロットを生成する。
 * 被り回避: (slotDateIso, timeRange) の組み合わせは一意。
 */
export function proposeSlots(
  baseDate: Date = new Date(),
  config: ResponderConfig = DEFAULT_RESPONDER_CONFIG,
): MeetingSlotProposal[] {
  const proposals: MeetingSlotProposal[] = [];
  const usedKeys = new Set<string>();
  const ranges = availableTimeRanges(config);

  const cursor = new Date(baseDate);
  // leadDays 後からスタート
  cursor.setDate(cursor.getDate() + config.leadDays);

  let maxDays = 60; // 無限ループ防止

  while (proposals.length < config.proposalCount && maxDays > 0) {
    const dayOfWeek = cursor.getDay(); // 0=Sun, 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (!isWeekend || config.includeWeekend) {
      const dateIso = toDateIso(cursor);
      const dayJa = dayOfWeekJa(cursor);

      // その日の使用済みtimeRangeを除外して選ぶ
      for (const range of ranges) {
        if (proposals.length >= config.proposalCount) break;
        const key = `${dateIso}:${range}`;
        if (!usedKeys.has(key)) {
          usedKeys.add(key);
          proposals.push({
            slotDateIso: dateIso,
            timeRange: range,
            note_ja: `${dateIso.replace(/-/g, "/")}(${dayJa}) ${TIME_RANGE_LABEL_JA[range]}`,
          });
        }
      }
    }

    cursor.setDate(cursor.getDate() + 1);
    maxDays--;
  }

  return proposals;
}
