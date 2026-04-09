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
