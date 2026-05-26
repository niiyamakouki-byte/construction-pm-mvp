/**
 * Meeting Runner — shared types.
 *
 * Sprint 17-A: 工程会議自動進行AI
 * 週次工程会議の議題抽出+前回議事録からの未解決事項追跡+次回TODO自動配布
 */

// ── Branded types ──────────────────────────────────────────────────────────

export type MeetingId = string & { readonly __brand: "MeetingId" };

export function makeMeetingId(raw: string): MeetingId {
  return raw as MeetingId;
}

// ── Enumerations ───────────────────────────────────────────────────────────

export type MeetingKind =
  | "weekly_progress"
  | "design_review"
  | "subcontractor_briefing"
  | "site_walkthrough";

export type AgendaItemSource =
  | "previous_unresolved"
  | "new_topic"
  | "manual";

export type AgendaItemStatus =
  | "pending"
  | "discussing"
  | "resolved"
  | "deferred";

export type ActionItemStatus =
  | "open"
  | "in_progress"
  | "done"
  | "overdue";

export type MeetingDistributionFormat =
  | "discord"
  | "email_html"
  | "markdown";

// ── Domain objects ─────────────────────────────────────────────────────────

export type AgendaItem = {
  id: string;
  title: string;
  source: AgendaItemSource;
  /** Priority 1 (highest) – 5 (lowest) */
  priority: 1 | 2 | 3 | 4 | 5;
  estimatedMinutes: number;
  owner: string;
  status: AgendaItemStatus;
};

export type ActionItem = {
  id: string;
  description: string;
  assignee: string;
  /** ISO 8601 date string: YYYY-MM-DD */
  dueDate: string;
  status: ActionItemStatus;
};

export type MeetingMinutes = {
  meetingId: MeetingId;
  /** Key decisions made during the meeting */
  decisions: string[];
  actionItems: ActionItem[];
  /** Items carried over (unresolved) to the next meeting */
  unresolvedItems: AgendaItem[];
};

export type MeetingSession = {
  id: MeetingId;
  projectId: string;
  /** ISO 8601 datetime: YYYY-MM-DDTHH:mm:ss */
  scheduledAt: string;
  kind: MeetingKind;
  agendaItems: AgendaItem[];
  minutes?: MeetingMinutes;
  discordChannelId?: string;
  participants: string[];
};

// ── Display / helper types ─────────────────────────────────────────────────

export const MEETING_KIND_LABELS: Record<MeetingKind, string> = {
  weekly_progress: "週次工程会議",
  design_review: "設計レビュー",
  subcontractor_briefing: "協力業者説明会",
  site_walkthrough: "現場巡視",
};

export const AGENDA_STATUS_LABELS: Record<AgendaItemStatus, string> = {
  pending: "未着手",
  discussing: "審議中",
  resolved: "解決",
  deferred: "持越し",
};

export const ACTION_STATUS_LABELS: Record<ActionItemStatus, string> = {
  open: "未着手",
  in_progress: "進行中",
  done: "完了",
  overdue: "期限超過",
};
