/**
 * LaborRepository — Sprint 61 Phase 2
 *
 * 工数記録 (labor_time_entries) と作業班割当 (crew_assignments) の async repository。
 * VITE_USE_SUPABASE=true のとき Supabase へ、それ以外はインメモリへルーティングする。
 *
 * 1 リポジトリ 2 テーブル方式は CRMRepository (customers/deals) と同じ構成。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';

export type LaborEntryStatus = 'active' | 'completed';

export type LaborTimeEntryRecord = {
  id: string;
  projectId: string;
  workerId: string;
  workerName: string;
  trade: string;
  hourlyRate: number;
  clockInTime: string;
  clockOutTime?: string;
  crewId?: string;
  status: LaborEntryStatus;
};

export type CrewAssignmentRecord = {
  id: string;
  projectId: string;
  crewId: string;
  crewName: string;
  workerId: string;
  workerName: string;
  assignmentDate: string;
  role?: string;
};

// DB 行 (snake_case) ↔ アプリ型 (camelCase) のマッピング
type LaborTimeEntryRow = {
  id: string;
  project_id: string;
  worker_id: string;
  worker_name: string;
  trade: string;
  hourly_rate: number;
  clock_in_time: string;
  clock_out_time: string | null;
  crew_id: string | null;
  status: LaborEntryStatus;
};

type CrewAssignmentRow = {
  id: string;
  project_id: string;
  crew_id: string;
  crew_name: string;
  worker_id: string;
  worker_name: string;
  assignment_date: string;
  role: string | null;
};

function rowToEntry(row: LaborTimeEntryRow): LaborTimeEntryRecord {
  const entry: LaborTimeEntryRecord = {
    id: row.id,
    projectId: row.project_id,
    workerId: row.worker_id,
    workerName: row.worker_name,
    trade: row.trade,
    hourlyRate: Number(row.hourly_rate),
    clockInTime: row.clock_in_time,
    status: row.status,
  };
  if (row.clock_out_time) entry.clockOutTime = row.clock_out_time;
  if (row.crew_id) entry.crewId = row.crew_id;
  return entry;
}

function entryToRow(e: LaborTimeEntryRecord): LaborTimeEntryRow {
  return {
    id: e.id,
    project_id: e.projectId,
    worker_id: e.workerId,
    worker_name: e.workerName,
    trade: e.trade,
    hourly_rate: e.hourlyRate,
    clock_in_time: e.clockInTime,
    clock_out_time: e.clockOutTime ?? null,
    crew_id: e.crewId ?? null,
    status: e.status,
  };
}

function rowToAssignment(row: CrewAssignmentRow): CrewAssignmentRecord {
  const a: CrewAssignmentRecord = {
    id: row.id,
    projectId: row.project_id,
    crewId: row.crew_id,
    crewName: row.crew_name,
    workerId: row.worker_id,
    workerName: row.worker_name,
    assignmentDate: row.assignment_date,
  };
  if (row.role) a.role = row.role;
  return a;
}

function assignmentToRow(a: CrewAssignmentRecord): CrewAssignmentRow {
  return {
    id: a.id,
    project_id: a.projectId,
    crew_id: a.crewId,
    crew_name: a.crewName,
    worker_id: a.workerId,
    worker_name: a.workerName,
    assignment_date: a.assignmentDate,
    role: a.role ?? null,
  };
}

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

export class LaborRepository {
  private entries = new Map<string, LaborTimeEntryRecord>();
  private assignments = new Map<string, CrewAssignmentRecord>();
  private supabaseEntries: SupabaseRepository<LaborTimeEntryRow> | null;
  private supabaseAssignments: SupabaseRepository<CrewAssignmentRow> | null;

  /**
   * @param useSupabase 明示指定がなければ env を見る。テスト用に上書き可。
   */
  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    this.supabaseEntries = enabled
      ? new SupabaseRepository<LaborTimeEntryRow>('labor_time_entries')
      : null;
    this.supabaseAssignments = enabled
      ? new SupabaseRepository<CrewAssignmentRow>('crew_assignments')
      : null;
  }

  // ── labor_time_entries ─────────────────────────────────────────────

  async getEntryAsync(id: string): Promise<LaborTimeEntryRecord | null> {
    if (this.supabaseEntries) {
      const row = await this.supabaseEntries.getById(id);
      return row ? rowToEntry(row) : null;
    }
    return this.entries.get(id) ?? null;
  }

  async listEntriesAsync(): Promise<LaborTimeEntryRecord[]> {
    if (this.supabaseEntries) {
      const rows = await this.supabaseEntries.getAll();
      return rows.map(rowToEntry);
    }
    return [...this.entries.values()];
  }

  async listEntriesByProjectAsync(
    projectId: string,
    date?: string,
  ): Promise<LaborTimeEntryRecord[]> {
    const all = await this.listEntriesAsync();
    return all.filter(
      (e) =>
        e.projectId === projectId &&
        (!date || e.clockInTime.slice(0, 10) === date),
    );
  }

  async saveEntryAsync(entry: LaborTimeEntryRecord): Promise<void> {
    if (this.supabaseEntries) {
      const row = entryToRow(entry);
      const existing = await this.supabaseEntries.getById(entry.id);
      if (existing) {
        await this.supabaseEntries.update(entry.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabaseEntries.create({
          ...rest,
          id: entry.id,
        } as unknown as Omit<LaborTimeEntryRow, 'id'>);
      }
      return;
    }
    this.entries.set(entry.id, { ...entry });
  }

  async deleteEntryAsync(id: string): Promise<boolean> {
    if (this.supabaseEntries) {
      try {
        await this.supabaseEntries.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.entries.delete(id);
  }

  // ── crew_assignments ───────────────────────────────────────────────

  async getAssignmentAsync(id: string): Promise<CrewAssignmentRecord | null> {
    if (this.supabaseAssignments) {
      const row = await this.supabaseAssignments.getById(id);
      return row ? rowToAssignment(row) : null;
    }
    return this.assignments.get(id) ?? null;
  }

  async listAssignmentsAsync(): Promise<CrewAssignmentRecord[]> {
    if (this.supabaseAssignments) {
      const rows = await this.supabaseAssignments.getAll();
      return rows.map(rowToAssignment);
    }
    return [...this.assignments.values()];
  }

  async listAssignmentsByProjectAsync(
    projectId: string,
    date?: string,
  ): Promise<CrewAssignmentRecord[]> {
    const all = await this.listAssignmentsAsync();
    return all.filter(
      (a) =>
        a.projectId === projectId &&
        (!date || a.assignmentDate === date),
    );
  }

  async saveAssignmentAsync(assignment: CrewAssignmentRecord): Promise<void> {
    if (this.supabaseAssignments) {
      const row = assignmentToRow(assignment);
      const existing = await this.supabaseAssignments.getById(assignment.id);
      if (existing) {
        await this.supabaseAssignments.update(assignment.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabaseAssignments.create({
          ...rest,
          id: assignment.id,
        } as unknown as Omit<CrewAssignmentRow, 'id'>);
      }
      return;
    }
    this.assignments.set(assignment.id, { ...assignment });
  }

  async deleteAssignmentAsync(id: string): Promise<boolean> {
    if (this.supabaseAssignments) {
      try {
        await this.supabaseAssignments.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.assignments.delete(id);
  }
}
