/**
 * action-tracker — ActionItem の期日・ステータスを管理する
 *
 * Sprint 17-A: 工程会議自動進行AI
 * - 期日超過のアクションを "overdue" に昇格
 * - 期日 3 日前のアクションを warning リストとして返す
 */

import type { ActionItem, ActionItemStatus, MeetingSession } from "./types.js";

// ── Status update ──────────────────────────────────────────────────────────

/**
 * 期日を基準にステータスを再計算する (rule-based)。
 * dueDate < today かつ status !== "done" → "overdue"
 */
export function recalcStatus(item: ActionItem, now = new Date()): ActionItemStatus {
  if (item.status === "done") return "done";
  const due = new Date(item.dueDate);
  // Compare date-only
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dueDay < todayDay) return "overdue";
  return item.status;
}

/**
 * すべての ActionItem のステータスを再計算して返す。
 */
export function refreshActionStatuses(items: ActionItem[], now = new Date()): ActionItem[] {
  return items.map((item) => ({ ...item, status: recalcStatus(item, now) }));
}

// ── Warning detection ──────────────────────────────────────────────────────

/**
 * 期日まで N 日以内の未完了 ActionItem を返す (警告候補)。
 * デフォルト 3 日。
 */
export function getUpcomingDueItems(
  items: ActionItem[],
  withinDays = 3,
  now = new Date(),
): ActionItem[] {
  const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const limitDay = new Date(todayDay);
  limitDay.setDate(limitDay.getDate() + withinDays);

  return items.filter((item) => {
    if (item.status === "done") return false;
    const due = new Date(item.dueDate);
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    return dueDay >= todayDay && dueDay <= limitDay;
  });
}

/**
 * 期日超過の未完了 ActionItem を返す。
 */
export function getOverdueItems(items: ActionItem[], now = new Date()): ActionItem[] {
  return items.filter((item) => recalcStatus(item, now) === "overdue");
}

// ── Session-level helpers ──────────────────────────────────────────────────

/**
 * セッション配列から全 ActionItem を収集し、ステータスを最新化して返す。
 */
export function collectAllActionItems(
  sessions: MeetingSession[],
  now = new Date(),
): ActionItem[] {
  const all: ActionItem[] = [];
  for (const session of sessions) {
    if (session.minutes) {
      all.push(...session.minutes.actionItems);
    }
  }
  return refreshActionStatuses(all, now);
}

/**
 * 担当者でフィルタリングした ActionItem を返す。
 */
export function getItemsByAssignee(
  items: ActionItem[],
  assignee: string,
): ActionItem[] {
  return items.filter((item) => item.assignee === assignee);
}

/**
 * assignee 別の完了率 (0.0 – 1.0) を返す。
 */
export function completionRateByAssignee(
  items: ActionItem[],
): Record<string, number> {
  const byAssignee: Record<string, ActionItem[]> = {};
  for (const item of items) {
    if (!byAssignee[item.assignee]) byAssignee[item.assignee] = [];
    byAssignee[item.assignee].push(item);
  }

  const result: Record<string, number> = {};
  for (const [assignee, assigneeItems] of Object.entries(byAssignee)) {
    const done = assigneeItems.filter((i) => i.status === "done").length;
    result[assignee] = assigneeItems.length > 0 ? done / assigneeItems.length : 0;
  }
  return result;
}
