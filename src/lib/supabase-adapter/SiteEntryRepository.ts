/**
 * SiteEntryRepository — Sprint 61 Phase 2
 *
 * site_entry_records テーブル向け async repository。
 * VITE_USE_SUPABASE=true で Supabase、それ以外はインメモリ。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';

export type SiteEntryRecord = {
  id: string;
  projectId: string;
  workerName: string;
  company: string;
  entryTime: string;
  exitTime?: string;
  jobType?: string;
  startPhotoId?: string;
  endPhotoId?: string;
  taskId?: string;
};

type SiteEntryRow = {
  id: string;
  project_id: string;
  worker_name: string;
  company: string;
  entry_time: string;
  exit_time: string | null;
  job_type: string | null;
  start_photo_id: string | null;
  end_photo_id: string | null;
  task_id: string | null;
};

function rowToRecord(row: SiteEntryRow): SiteEntryRecord {
  const r: SiteEntryRecord = {
    id: row.id,
    projectId: row.project_id,
    workerName: row.worker_name,
    company: row.company,
    entryTime: row.entry_time,
  };
  if (row.exit_time) r.exitTime = row.exit_time;
  if (row.job_type) r.jobType = row.job_type;
  if (row.start_photo_id) r.startPhotoId = row.start_photo_id;
  if (row.end_photo_id) r.endPhotoId = row.end_photo_id;
  if (row.task_id) r.taskId = row.task_id;
  return r;
}

function recordToRow(r: SiteEntryRecord): SiteEntryRow {
  return {
    id: r.id,
    project_id: r.projectId,
    worker_name: r.workerName,
    company: r.company,
    entry_time: r.entryTime,
    exit_time: r.exitTime ?? null,
    job_type: r.jobType ?? null,
    start_photo_id: r.startPhotoId ?? null,
    end_photo_id: r.endPhotoId ?? null,
    task_id: r.taskId ?? null,
  };
}

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

export class SiteEntryRepository {
  private store = new Map<string, SiteEntryRecord>();
  private supabase: SupabaseRepository<SiteEntryRow> | null;

  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    this.supabase = enabled
      ? new SupabaseRepository<SiteEntryRow>('site_entry_records')
      : null;
  }

  async getAsync(id: string): Promise<SiteEntryRecord | null> {
    if (this.supabase) {
      const row = await this.supabase.getById(id);
      return row ? rowToRecord(row) : null;
    }
    return this.store.get(id) ?? null;
  }

  async listAsync(): Promise<SiteEntryRecord[]> {
    if (this.supabase) {
      const rows = await this.supabase.getAll();
      return rows.map(rowToRecord);
    }
    return [...this.store.values()];
  }

  async listByProjectAsync(
    projectId: string,
    date?: string,
  ): Promise<SiteEntryRecord[]> {
    const all = await this.listAsync();
    return all.filter(
      (r) =>
        r.projectId === projectId &&
        (!date || r.entryTime.slice(0, 10) === date),
    );
  }

  async saveAsync(record: SiteEntryRecord): Promise<void> {
    if (this.supabase) {
      const row = recordToRow(record);
      const existing = await this.supabase.getById(record.id);
      if (existing) {
        await this.supabase.update(record.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabase.create({
          ...rest,
          id: record.id,
        } as unknown as Omit<SiteEntryRow, 'id'>);
      }
      return;
    }
    this.store.set(record.id, { ...record });
  }

  async deleteAsync(id: string): Promise<boolean> {
    if (this.supabase) {
      try {
        await this.supabase.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.store.delete(id);
  }
}
