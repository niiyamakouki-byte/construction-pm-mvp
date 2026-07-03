import { escapeHtml } from "./utils/escape-html";
export type MeetingAttendee = {
  name: string;
  company?: string;
  role?: string;
};

export type ActionItemStatus = "open" | "in_progress" | "done";

export type MeetingActionItem = {
  id: string;
  description: string;
  owner: string;
  dueDate?: string;
  status: ActionItemStatus;
};

export type MeetingMinutes = {
  id: string;
  projectId: string;
  meetingDate: string;
  meetingType: string;
  facilitator: string;
  location?: string;
  createdAt: string;
  attendees: MeetingAttendee[];
  discussionPoints: string[];
  actionItems: MeetingActionItem[];
};

export type CreateMeetingMinutesInput = Omit<MeetingMinutes, "id" | "createdAt" | "attendees" | "actionItems"> & {
  id?: string;
  createdAt?: string;
  attendees?: MeetingAttendee[];
  actionItems?: MeetingActionItem[];
};

export type CreateActionItemInput = {
  id?: string;
  description: string;
  owner: string;
  dueDate?: string;
  status?: ActionItemStatus;
};

const meetings: MeetingMinutes[] = [];
let meetingCounter = 1;
let actionItemCounter = 1;

function nextMeetingId(): string {
  const id = `meeting-${meetingCounter}`;
  meetingCounter += 1;
  return id;
}

function nextActionItemId(): string {
  const id = `meeting-action-${actionItemCounter}`;
  actionItemCounter += 1;
  return id;
}

function getNow(): string {
  return new Date().toISOString();
}


function cloneMeeting(meeting: MeetingMinutes): MeetingMinutes {
  return {
    ...meeting,
    attendees: meeting.attendees.map((attendee) => ({ ...attendee })),
    discussionPoints: [...meeting.discussionPoints],
    actionItems: meeting.actionItems.map((item) => ({ ...item })),
  };
}

function findMeetingIndex(meetingId: string): number {
  return meetings.findIndex((meeting) => meeting.id === meetingId);
}

export function createMeetingMinutes(input: CreateMeetingMinutesInput): MeetingMinutes {
  const meeting: MeetingMinutes = {
    ...input,
    id: input.id ?? nextMeetingId(),
    createdAt: input.createdAt ?? getNow(),
    attendees: (input.attendees ?? []).map((attendee) => ({ ...attendee })),
    discussionPoints: [...input.discussionPoints],
    actionItems: (input.actionItems ?? []).map((item) => ({
      ...item,
      id: item.id ?? nextActionItemId(),
      status: item.status ?? "open",
    })),
  };

  meetings.push(meeting);
  return cloneMeeting(meeting);
}

export function getMeetingMinutes(projectId?: string): MeetingMinutes[] {
  const items = projectId
    ? meetings.filter((meeting) => meeting.projectId === projectId)
    : meetings;

  return items.map((meeting) => cloneMeeting(meeting));
}

export function addMeetingAttendee(meetingId: string, attendee: MeetingAttendee): MeetingMinutes {
  const meetingIndex = findMeetingIndex(meetingId);
  if (meetingIndex < 0) {
    throw new Error(`Meeting minutes not found: ${meetingId}`);
  }

  const updated: MeetingMinutes = {
    ...meetings[meetingIndex],
    attendees: [...meetings[meetingIndex].attendees, { ...attendee }],
  };

  meetings[meetingIndex] = updated;
  return cloneMeeting(updated);
}

export function addMeetingActionItem(meetingId: string, actionItem: CreateActionItemInput): MeetingMinutes {
  const meetingIndex = findMeetingIndex(meetingId);
  if (meetingIndex < 0) {
    throw new Error(`Meeting minutes not found: ${meetingId}`);
  }

  const updated: MeetingMinutes = {
    ...meetings[meetingIndex],
    actionItems: [
      ...meetings[meetingIndex].actionItems,
      {
        id: actionItem.id ?? nextActionItemId(),
        description: actionItem.description,
        owner: actionItem.owner,
        dueDate: actionItem.dueDate,
        status: actionItem.status ?? "open",
      },
    ],
  };

  meetings[meetingIndex] = updated;
  return cloneMeeting(updated);
}

export function clearMeetingMinutes(): void {
  meetings.length = 0;
  meetingCounter = 1;
  actionItemCounter = 1;
}

export function generateMinutesReport(meetingId: string): string {
  const meeting = meetings.find((entry) => entry.id === meetingId);
  if (!meeting) {
    throw new Error(`Meeting minutes not found: ${meetingId}`);
  }

  const attendeeList = meeting.attendees.length > 0
    ? meeting.attendees
        .map((attendee) => {
          const parts = [
            attendee.name,
            attendee.company ? `(${attendee.company})` : "",
            attendee.role ? `- ${attendee.role}` : "",
          ].filter(Boolean);
          return `<li>${escapeHtml(parts.join(" "))}</li>`;
        })
        .join("")
    : "<li>No attendees recorded.</li>";

  const discussionList = meeting.discussionPoints.length > 0
    ? meeting.discussionPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("")
    : "<li>No discussion points recorded.</li>";

  const actionRows = meeting.actionItems.length > 0
    ? meeting.actionItems
        .map(
          (item) => `<tr>
  <td>${escapeHtml(item.description)}</td>
  <td>${escapeHtml(item.owner)}</td>
  <td>${escapeHtml(item.dueDate ?? "")}</td>
  <td>${escapeHtml(item.status)}</td>
</tr>`,
        )
        .join("")
    : '<tr><td colspan="4">アクション項目はありません。</td></tr>';

  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8" /><title>議事録 - ${escapeHtml(meeting.meetingType)}</title></head><body><h1>議事録</h1><p><strong>案件ID:</strong> ${escapeHtml(meeting.projectId)}</p><p><strong>会議種別:</strong> ${escapeHtml(meeting.meetingType)}</p><p><strong>日付:</strong> ${escapeHtml(meeting.meetingDate)}</p><p><strong>進行者:</strong> ${escapeHtml(meeting.facilitator)}</p><p><strong>場所:</strong> ${escapeHtml(meeting.location ?? "")}</p><h2>参加者</h2><ul>${attendeeList}</ul><h2>議題</h2><ul>${discussionList}</ul><h2>アクション項目</h2><table><thead><tr><th>内容</th><th>担当者</th><th>期限</th><th>ステータス</th></tr></thead><tbody>${actionRows}</tbody></table></body></html>`;
}
