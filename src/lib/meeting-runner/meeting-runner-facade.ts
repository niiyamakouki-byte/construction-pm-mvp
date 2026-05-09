/**
 * meeting-runner-facade — Meeting Runner の公開API
 *
 * Sprint 17-A: 工程会議自動進行AI
 */

import type {
  MeetingSession,
  MeetingMinutes,
  MeetingKind,
  MeetingDistributionFormat,
  AgendaItem,
  ActionItem,
} from "./types.js";
import { makeMeetingId } from "./types.js";
import { meetingStore } from "./meeting-store.js";
import { buildAgenda, totalEstimatedMinutes } from "./agenda-builder.js";
import type { ProjectPhaseInfo } from "./agenda-builder.js";
import { recordMinutes, appendToMinutes } from "./minutes-recorder.js";
import { refreshActionStatuses, getOverdueItems, getUpcomingDueItems } from "./action-tracker.js";
import { buildDistribution } from "./distribution-builder.js";
import { suggestNextMeetingDates } from "./next-meeting-scheduler.js";
import type { MeetingCandidate } from "./next-meeting-scheduler.js";

// ── Session creation ───────────────────────────────────────────────────────

let _sessionCounter = 0;

function newSessionId(): string {
  return `meeting-${Date.now()}-${++_sessionCounter}`;
}

/**
 * 新しい会議セッションを作成・保存して返す。
 */
export function createMeetingSession(params: {
  projectId: string;
  scheduledAt: string;
  kind: MeetingKind;
  participants: string[];
  discordChannelId?: string;
  projectPhases?: ProjectPhaseInfo[];
  manualAgendaItems?: AgendaItem[];
}): MeetingSession {
  const { projectId, scheduledAt, kind, participants, discordChannelId, projectPhases, manualAgendaItems } = params;

  // Find previous session for this project
  const prevSession = meetingStore.latestForProject(projectId);
  const previousMinutes = prevSession?.minutes;

  const agendaItems = buildAgenda({
    kind,
    defaultOwner: participants[0] ?? "未定",
    previousMinutes,
    projectPhases,
    manualItems: manualAgendaItems,
  });

  const session: MeetingSession = {
    id: makeMeetingId(newSessionId()),
    projectId,
    scheduledAt,
    kind,
    agendaItems,
    participants,
    discordChannelId,
  };

  meetingStore.save(session);
  return session;
}

// ── Minutes recording ──────────────────────────────────────────────────────

/**
 * 会議の発言テキストから議事録を生成して、セッションに保存する。
 */
export function saveMeetingMinutes(
  sessionId: string,
  lines: string[],
): MeetingSession | null {
  const session = meetingStore.get(makeMeetingId(sessionId));
  if (!session) return null;

  const minutes = recordMinutes({
    meetingId: session.id,
    lines,
    meetingDate: new Date(session.scheduledAt),
    agendaItems: session.agendaItems,
  });

  const updated: MeetingSession = { ...session, minutes };
  meetingStore.save(updated);
  return updated;
}

/**
 * 既存の議事録に行を追記する。
 */
export function appendMinutesLines(
  sessionId: string,
  newLines: string[],
): MeetingSession | null {
  const session = meetingStore.get(makeMeetingId(sessionId));
  if (!session || !session.minutes) return null;

  const updated: MeetingMinutes = appendToMinutes(
    session.minutes,
    newLines,
    new Date(session.scheduledAt),
    session.agendaItems,
  );

  const updatedSession: MeetingSession = { ...session, minutes: updated };
  meetingStore.save(updatedSession);
  return updatedSession;
}

// ── Agenda management ──────────────────────────────────────────────────────

/**
 * アジェンダアイテムのステータスを更新する。
 */
export function updateAgendaItemStatus(
  sessionId: string,
  agendaItemId: string,
  status: AgendaItem["status"],
): MeetingSession | null {
  const session = meetingStore.get(makeMeetingId(sessionId));
  if (!session) return null;

  const agendaItems = session.agendaItems.map((item) =>
    item.id === agendaItemId ? { ...item, status } : item,
  );

  const updated: MeetingSession = { ...session, agendaItems };
  meetingStore.save(updated);
  return updated;
}

/**
 * セッションの合計予定時間 (分) を返す。
 */
export function getSessionDuration(sessionId: string): number {
  const session = meetingStore.get(makeMeetingId(sessionId));
  if (!session) return 0;
  return totalEstimatedMinutes(session.agendaItems);
}

// ── Distribution ───────────────────────────────────────────────────────────

/**
 * 議事録を指定フォーマットに変換して返す。
 */
export function distributeMinutes(
  sessionId: string,
  format: MeetingDistributionFormat,
): string | null {
  const session = meetingStore.get(makeMeetingId(sessionId));
  if (!session || !session.minutes) return null;

  return buildDistribution(session, session.minutes, format);
}

// ── Action tracking ────────────────────────────────────────────────────────

/**
 * プロジェクトの全セッションから overdue アクションを収集する。
 */
export function getProjectOverdueActions(
  projectId: string,
  now = new Date(),
): ActionItem[] {
  const sessions = meetingStore.listByProject(projectId);
  const all: ActionItem[] = [];
  for (const s of sessions) {
    if (s.minutes) all.push(...s.minutes.actionItems);
  }
  return getOverdueItems(refreshActionStatuses(all, now), now);
}

/**
 * プロジェクトの期日が近いアクションを収集する。
 */
export function getProjectUpcomingActions(
  projectId: string,
  withinDays = 3,
  now = new Date(),
): ActionItem[] {
  const sessions = meetingStore.listByProject(projectId);
  const all: ActionItem[] = [];
  for (const s of sessions) {
    if (s.minutes) all.push(...s.minutes.actionItems);
  }
  return getUpcomingDueItems(refreshActionStatuses(all, now), withinDays, now);
}

// ── Next meeting scheduling ────────────────────────────────────────────────

/**
 * 次回会議の候補日時を3件提案する。
 */
export function suggestNextMeeting(
  sessionId: string,
  busyDates: string[] = [],
): MeetingCandidate[] {
  const session = meetingStore.get(makeMeetingId(sessionId));
  if (!session) return [];
  return suggestNextMeetingDates(session, busyDates, 3);
}
