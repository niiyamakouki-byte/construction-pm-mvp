/**
 * MeetingRepository — Sprint 61 Phase 2
 *
 * meeting_minutes + meeting_action_items テーブル向け async repository。
 *
 * 議事録の attendees / discussion_points は本テーブルに jsonb / text[] として保存。
 * action_items は外部キー (meeting_id) で別テーブルに正規化。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';

export type MeetingAttendee = {
  name: string;
  company?: string;
  role?: string;
};

export type ActionItemStatus = 'open' | 'in_progress' | 'done';

export type MeetingMinutesRecord = {
  id: string;
  projectId: string;
  meetingDate: string;
  meetingType: string;
  facilitator: string;
  location?: string;
  attendees: MeetingAttendee[];
  discussionPoints: string[];
  createdAt: string;
};

export type MeetingActionItemRecord = {
  id: string;
  meetingId: string;
  description: string;
  owner: string;
  dueDate?: string;
  status: ActionItemStatus;
};

type MinutesRow = {
  id: string;
  project_id: string;
  meeting_date: string;
  meeting_type: string;
  facilitator: string;
  location: string | null;
  attendees: MeetingAttendee[];
  discussion_points: string[];
  created_at: string;
};

type ActionItemRow = {
  id: string;
  meeting_id: string;
  description: string;
  owner: string;
  due_date: string | null;
  status: ActionItemStatus;
};

function rowToMinutes(row: MinutesRow): MeetingMinutesRecord {
  const r: MeetingMinutesRecord = {
    id: row.id,
    projectId: row.project_id,
    meetingDate: row.meeting_date,
    meetingType: row.meeting_type,
    facilitator: row.facilitator,
    attendees: row.attendees,
    discussionPoints: row.discussion_points,
    createdAt: row.created_at,
  };
  if (row.location) r.location = row.location;
  return r;
}

function minutesToRow(r: MeetingMinutesRecord): MinutesRow {
  return {
    id: r.id,
    project_id: r.projectId,
    meeting_date: r.meetingDate,
    meeting_type: r.meetingType,
    facilitator: r.facilitator,
    location: r.location ?? null,
    attendees: r.attendees,
    discussion_points: r.discussionPoints,
    created_at: r.createdAt,
  };
}

function rowToActionItem(row: ActionItemRow): MeetingActionItemRecord {
  const r: MeetingActionItemRecord = {
    id: row.id,
    meetingId: row.meeting_id,
    description: row.description,
    owner: row.owner,
    status: row.status,
  };
  if (row.due_date) r.dueDate = row.due_date;
  return r;
}

function actionItemToRow(r: MeetingActionItemRecord): ActionItemRow {
  return {
    id: r.id,
    meeting_id: r.meetingId,
    description: r.description,
    owner: r.owner,
    due_date: r.dueDate ?? null,
    status: r.status,
  };
}

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

export class MeetingRepository {
  private minutes = new Map<string, MeetingMinutesRecord>();
  private actionItems = new Map<string, MeetingActionItemRecord>();
  private supabaseMinutes: SupabaseRepository<MinutesRow> | null;
  private supabaseActionItems: SupabaseRepository<ActionItemRow> | null;

  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    this.supabaseMinutes = enabled
      ? new SupabaseRepository<MinutesRow>('meeting_minutes')
      : null;
    this.supabaseActionItems = enabled
      ? new SupabaseRepository<ActionItemRow>('meeting_action_items')
      : null;
  }

  // ── meeting minutes ────────────────────────────────────────────────

  async getMeetingAsync(id: string): Promise<MeetingMinutesRecord | null> {
    if (this.supabaseMinutes) {
      const row = await this.supabaseMinutes.getById(id);
      return row ? rowToMinutes(row) : null;
    }
    return this.minutes.get(id) ?? null;
  }

  async listMeetingsAsync(): Promise<MeetingMinutesRecord[]> {
    if (this.supabaseMinutes) {
      const rows = await this.supabaseMinutes.getAll();
      return rows.map(rowToMinutes);
    }
    return [...this.minutes.values()];
  }

  async listMeetingsByProjectAsync(projectId: string): Promise<MeetingMinutesRecord[]> {
    const all = await this.listMeetingsAsync();
    return all.filter((r) => r.projectId === projectId);
  }

  async saveMeetingAsync(record: MeetingMinutesRecord): Promise<void> {
    if (this.supabaseMinutes) {
      const row = minutesToRow(record);
      const existing = await this.supabaseMinutes.getById(record.id);
      if (existing) {
        await this.supabaseMinutes.update(record.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabaseMinutes.create({
          ...rest,
          id: record.id,
        } as unknown as Omit<MinutesRow, 'id'>);
      }
      return;
    }
    this.minutes.set(record.id, { ...record });
  }

  async deleteMeetingAsync(id: string): Promise<boolean> {
    if (this.supabaseMinutes) {
      try {
        await this.supabaseMinutes.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.minutes.delete(id);
  }

  // ── action items ───────────────────────────────────────────────────

  async listActionItemsByMeetingAsync(
    meetingId: string,
  ): Promise<MeetingActionItemRecord[]> {
    if (this.supabaseActionItems) {
      const rows = await this.supabaseActionItems.getAll();
      return rows.filter((r) => r.meeting_id === meetingId).map(rowToActionItem);
    }
    return [...this.actionItems.values()].filter((r) => r.meetingId === meetingId);
  }

  async saveActionItemAsync(record: MeetingActionItemRecord): Promise<void> {
    if (this.supabaseActionItems) {
      const row = actionItemToRow(record);
      const existing = await this.supabaseActionItems.getById(record.id);
      if (existing) {
        await this.supabaseActionItems.update(record.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabaseActionItems.create({
          ...rest,
          id: record.id,
        } as unknown as Omit<ActionItemRow, 'id'>);
      }
      return;
    }
    this.actionItems.set(record.id, { ...record });
  }

  async deleteActionItemAsync(id: string): Promise<boolean> {
    if (this.supabaseActionItems) {
      try {
        await this.supabaseActionItems.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.actionItems.delete(id);
  }
}
