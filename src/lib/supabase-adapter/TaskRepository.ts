/**
 * TaskRepository — Phase C
 * async メソッドのみ（sync メソッド削除済み）。
 * async メソッドは VITE_USE_SUPABASE=true のとき Supabase へ、
 * それ以外はインメモリへルーティングする。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';

export type Task = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  progress: number;
  startDate?: string;
  dueDate?: string;
  contractorId?: string;
  isMilestone: boolean;
  createdAt: string;
  updatedAt: string;
};

type TaskRow = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  status: Task['status'];
  progress: number;
  start_date?: string | null;
  due_date?: string | null;
  assignee_id?: string | null;
  created_at: string;
  updated_at: string;
};

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description ?? '',
    status: row.status,
    progress: row.progress ?? 0,
    startDate: row.start_date ?? undefined,
    dueDate: row.due_date ?? undefined,
    contractorId: row.assignee_id ?? undefined,
    // isMilestone は DB スキーマに存在しないため既定 false
    isMilestone: false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function taskToRow(t: Task): TaskRow {
  return {
    id: t.id,
    project_id: t.projectId,
    name: t.name,
    description: t.description,
    status: t.status,
    progress: t.progress,
    start_date: t.startDate ?? null,
    due_date: t.dueDate ?? null,
    assignee_id: t.contractorId ?? null,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

export class TaskRepository {
  private store = new Map<string, Task>();
  private supabase: SupabaseRepository<TaskRow> | null;

  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    this.supabase = enabled ? new SupabaseRepository<TaskRow>('tasks') : null;
  }

  // ── async メソッド（Phase C: Supabase or InMemory）────────────────────

  async getAsync(id: string): Promise<Task | null> {
    if (this.supabase) {
      const row = await this.supabase.getById(id);
      return row ? rowToTask(row) : null;
    }
    return this.store.get(id) ?? null;
  }

  async listAsync(): Promise<Task[]> {
    if (this.supabase) {
      const rows = await this.supabase.getAll();
      return rows.map(rowToTask);
    }
    return [...this.store.values()];
  }

  async listByProjectAsync(projectId: string): Promise<Task[]> {
    if (this.supabase) {
      // 簡易フィルタ：getAll 後にメモリで絞り込み（行数少 MVP 想定）
      const rows = await this.supabase.getAll();
      return rows.filter((r) => r.project_id === projectId).map(rowToTask);
    }
    return [...this.store.values()].filter((t) => t.projectId === projectId);
  }

  async saveAsync(task: Task): Promise<void> {
    if (this.supabase) {
      const row = taskToRow(task);
      const existing = await this.supabase.getById(task.id);
      if (existing) {
        await this.supabase.update(task.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabase.create({ ...rest, id: task.id } as unknown as Omit<TaskRow, 'id'>);
      }
      return;
    }
    this.store.set(task.id, { ...task });
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
