/**
 * Googleカレンダー個人予定 × ガントタスクの「日単位の重なり」を判定する純粋関数。
 *
 * 設計判断:
 * - 工程表は基本「日」が単位なので、終日/時刻イベントを問わず YYYY-MM-DD 集合で比較する
 * - タスクが startDate のみ持つ場合は1日扱い（endDate を startDate と同一視）
 * - Google終日イベントの end.date は exclusive なので、占有日数は (end - start) 日（最低1日）
 */

import type { GoogleCalendarEvent } from "./google-calendar.js";

/** 重なり判定に必要なタスクの最小形状（GanttTask 互換） */
export type ConflictTaskLike = {
  id: string;
  startDate?: string | null;
  endDate?: string | null;
  dueDate?: string | null;
};

export type ScheduleConflictResult = {
  /** タスクIDごとに、重なっているイベント一覧 */
  conflictsByTaskId: Record<string, GoogleCalendarEvent[]>;
  /** 日付（YYYY-MM-DD）ごとに、その日に予定があるイベント一覧（ガント帯表示用） */
  eventsByDate: Record<string, GoogleCalendarEvent[]>;
  /** 個人予定がある日付集合（高速判定用） */
  busyDates: Set<string>;
};

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDayString(yyyyMmDd: string, days: number): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + days);
  return toLocalDateString(dt);
}

/** 終日/時刻イベントを「占有する日付（YYYY-MM-DD）の配列」に正規化する */
function eventOccupiedDates(event: GoogleCalendarEvent): string[] {
  const startStr = toLocalDateString(event.start);
  const endStr = toLocalDateString(event.end);
  const dates: string[] = [];

  if (event.allDay) {
    // 終日イベントの end は exclusive。同日なら1日扱い
    let cursor = startStr;
    if (endStr <= startStr) {
      dates.push(startStr);
      return dates;
    }
    while (cursor < endStr) {
      dates.push(cursor);
      cursor = addDayString(cursor, 1);
    }
    return dates;
  }

  // 時刻イベントの end は inclusive 的に扱う（同日なら1日、跨ぐと両端含む）
  let cursor = startStr;
  while (cursor <= endStr) {
    dates.push(cursor);
    cursor = addDayString(cursor, 1);
  }
  return dates;
}

function taskOccupiedDates(task: ConflictTaskLike): string[] {
  const start = task.startDate;
  if (!start) return [];
  const end = task.endDate ?? task.dueDate ?? start;
  const dates: string[] = [];
  let cursor = start;
  // 不正な順序（end < start）は1日扱い
  if (end < start) return [start];
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDayString(cursor, 1);
  }
  return dates;
}

/**
 * 個人予定とタスクの重なりを日単位で判定する純粋関数。
 */
export function detectScheduleConflicts(
  events: GoogleCalendarEvent[],
  tasks: ConflictTaskLike[],
): ScheduleConflictResult {
  const eventsByDate: Record<string, GoogleCalendarEvent[]> = {};
  const busyDates = new Set<string>();

  for (const event of events) {
    for (const date of eventOccupiedDates(event)) {
      busyDates.add(date);
      (eventsByDate[date] ??= []).push(event);
    }
  }

  const conflictsByTaskId: Record<string, GoogleCalendarEvent[]> = {};
  for (const task of tasks) {
    const taskDates = taskOccupiedDates(task);
    const hit = new Map<string, GoogleCalendarEvent>();
    for (const date of taskDates) {
      const dayEvents = eventsByDate[date];
      if (!dayEvents) continue;
      for (const ev of dayEvents) {
        hit.set(ev.id, ev);
      }
    }
    if (hit.size > 0) {
      conflictsByTaskId[task.id] = Array.from(hit.values());
    }
  }

  return { conflictsByTaskId, eventsByDate, busyDates };
}

/** ある日付に個人予定があるか（ガント帯マーカー判定の薄い糖衣） */
export function hasPersonalEventOn(result: ScheduleConflictResult, dateStr: string): boolean {
  return result.busyDates.has(dateStr);
}
