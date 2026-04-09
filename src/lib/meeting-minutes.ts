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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
