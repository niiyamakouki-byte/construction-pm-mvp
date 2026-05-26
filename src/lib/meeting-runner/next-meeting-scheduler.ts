/**
 * next-meeting-scheduler — 次回会議の日時候補を提案する
 *
 * Sprint 17-A: 工程会議自動進行AI
 * - 週次なら +7 日同曜日
 * - 日本の祝日を回避
 * - 参加者の availability を簡易チェック（busy 日リスト）
 */

import type { MeetingKind, MeetingSession } from "./types.js";

// ── Japanese holidays (fixed-date only, rule-based) ────────────────────────

function isJapaneseHoliday(date: Date): boolean {
  const m = date.getMonth() + 1; // 1-indexed
  const d = date.getDate();
  const dow = date.getDay(); // 0=Sun

  // Fixed-date national holidays
  const fixedHolidays: Array<[number, number]> = [
    [1, 1],   // 元日
    [2, 11],  // 建国記念の日
    [2, 23],  // 天皇誕生日
    [3, 20],  // 春分の日 (approximate)
    [4, 29],  // 昭和の日
    [5, 3],   // 憲法記念日
    [5, 4],   // みどりの日
    [5, 5],   // こどもの日
    [8, 11],  // 山の日
    [9, 23],  // 秋分の日 (approximate)
    [11, 3],  // 文化の日
    [11, 23], // 勤労感謝の日
    [12, 31], // 年末（慣例的に避ける）
  ];

  for (const [hm, hd] of fixedHolidays) {
    if (m === hm && d === hd) return true;
    // 振替休日: holiday on Sunday → next Monday
    if (m === hm && d === hd + 1 && dow === 1) return true;
  }

  // Marine Day (第3月曜日 of July = 0-indexed month 6)
  if (m === 7 && dow === 1) {
    const weekOfMonth = Math.ceil(d / 7);
    if (weekOfMonth === 3) return true;
  }

  // Respect for the Aged Day (第3月曜日 of September)
  if (m === 9 && dow === 1) {
    const weekOfMonth = Math.ceil(d / 7);
    if (weekOfMonth === 3) return true;
  }

  // Sports Day (第2月曜日 of October)
  if (m === 10 && dow === 1) {
    const weekOfMonth = Math.ceil(d / 7);
    if (weekOfMonth === 2) return true;
  }

  return false;
}

function isWeekend(date: Date): boolean {
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

function isUnavailable(date: Date, busyDates: string[]): boolean {
  const ymd = date.toISOString().split("T")[0];
  return busyDates.includes(ymd);
}

// ── Interval by kind ──────────────────────────────────────────────────────

function defaultIntervalDays(kind: MeetingKind): number {
  switch (kind) {
    case "weekly_progress":
      return 7;
    case "design_review":
      return 14;
    case "subcontractor_briefing":
      return 14;
    case "site_walkthrough":
      return 7;
  }
}

// ── Candidate generation ───────────────────────────────────────────────────

export type MeetingCandidate = {
  scheduledAt: string; // ISO 8601
  /** Human-readable label */
  labelJa: string;
  isRecommended: boolean;
};

const DOW_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function formatCandidateLabel(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const dow = DOW_LABELS[date.getDay()];
  const h = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  return `${y}年${m}月${d}日（${dow}）${h}:${min}`;
}

/**
 * 次回会議の候補日時を3件提案する。
 *
 * @param lastSession 直前の MeetingSession
 * @param busyDates 参加者の busy 日 (YYYY-MM-DD)
 * @param count 候補数 (default 3)
 */
export function suggestNextMeetingDates(
  lastSession: MeetingSession,
  busyDates: string[] = [],
  count = 3,
): MeetingCandidate[] {
  const intervalDays = defaultIntervalDays(lastSession.kind);
  const lastDate = new Date(lastSession.scheduledAt);
  const timeH = lastDate.getHours();
  const timeM = lastDate.getMinutes();

  const candidates: MeetingCandidate[] = [];
  let current = new Date(lastDate);

  let attempts = 0;
  while (candidates.length < count && attempts < 60) {
    attempts++;
    current = new Date(current);
    current.setDate(current.getDate() + intervalDays);
    current.setHours(timeH, timeM, 0, 0);

    if (
      isWeekend(current) ||
      isJapaneseHoliday(current) ||
      isUnavailable(current, busyDates)
    ) {
      // Try next day within the same week window
      const shifted = new Date(current);
      let found = false;
      for (let shift = 1; shift <= 3; shift++) {
        shifted.setDate(current.getDate() + shift);
        shifted.setHours(timeH, timeM, 0, 0);
        if (
          !isWeekend(shifted) &&
          !isJapaneseHoliday(shifted) &&
          !isUnavailable(shifted, busyDates)
        ) {
          current = new Date(shifted);
          found = true;
          break;
        }
      }
      if (!found) continue;
    }

    candidates.push({
      scheduledAt: current.toISOString(),
      labelJa: formatCandidateLabel(current),
      isRecommended: candidates.length === 0, // First = recommended
    });
  }

  return candidates;
}

/**
 * 次回会議のISO日時文字列を1件返す (最推薦候補)。
 */
export function suggestNextMeeting(
  lastSession: MeetingSession,
  busyDates: string[] = [],
): string | null {
  const candidates = suggestNextMeetingDates(lastSession, busyDates, 1);
  return candidates[0]?.scheduledAt ?? null;
}
