/**
 * ProjectRepository — Phase B
 * 同期メソッドはインメモリ（既存互換）。
 * async メソッドは VITE_USE_SUPABASE=true のとき Supabase へ、
 * それ以外はインメモリへルーティングする。
 */

import type { StoreProject } from '../store.js';
import { SupabaseRepository } from '../repository/supabase-repository.js';

export type { StoreProject as Project };

// DB 行 (snake_case) ↔ アプリ型 (camelCase) のマッピング
type ProjectRow = {
  id: string;
  name: string;
  description: string;
  status: StoreProject['status'];
  start_date: string;
  end_date?: string | null;
  address?: string | null;
  budget?: number | null;
  include_weekends?: boolean | null;
  created_at: string;
  updated_at: string;
};

function rowToProject(row: ProjectRow): StoreProject {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    address: row.address ?? undefined,
    budget: row.budget ?? undefined,
    includeWeekends: row.include_weekends ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function projectToRow(p: StoreProject): ProjectRow {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    start_date: p.startDate,
    end_date: p.endDate ?? null,
    address: p.address ?? null,
    budget: p.budget ?? null,
    include_weekends: p.includeWeekends,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

function isSupabaseEnabled(): boolean {
  // ブラウザ Vite 環境
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

export class ProjectRepository {
  private store = new Map<string, StoreProject>();
  private supabase: SupabaseRepository<ProjectRow> | null;

  /**
   * @param useSupabase 明示指定がなければ env を見る。テスト用に上書き可。
   */
  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    this.supabase = enabled ? new SupabaseRepository<ProjectRow>('projects') : null;
  }

  // ── 同期メソッド（既存互換 / インメモリのみ）─────────────────────────────

  /** @deprecated Use getAsync instead. Will be removed in Phase C cleanup. */
  get(id: string): StoreProject | null {
    return this.store.get(id) ?? null;
  }

  /** @deprecated Use listAsync instead. Will be removed in Phase C cleanup. */
  list(): StoreProject[] {
    return [...this.store.values()];
  }

  /** @deprecated Use saveAsync instead. Will be removed in Phase C cleanup. */
  save(project: StoreProject): void {
    this.store.set(project.id, { ...project });
  }

  /** @deprecated Use deleteAsync instead. Will be removed in Phase C cleanup. */
  delete(id: string): boolean {
    return this.store.delete(id);
  }

  // ── async メソッド（Phase B: Supabase or InMemory）────────────────────

  async getAsync(id: string): Promise<StoreProject | null> {
    if (this.supabase) {
      const row = await this.supabase.getById(id);
      return row ? rowToProject(row) : null;
    }
    return this.get(id);
  }

  async listAsync(): Promise<StoreProject[]> {
    if (this.supabase) {
      const rows = await this.supabase.getAll();
      return rows.map(rowToProject);
    }
    return this.list();
  }

  async saveAsync(project: StoreProject): Promise<void> {
    if (this.supabase) {
      const row = projectToRow(project);
      const existing = await this.supabase.getById(project.id);
      if (existing) {
        await this.supabase.update(project.id, row);
      } else {
        // SupabaseRepository.create は Omit<T,'id'> を要求するが、
        // projects.id は text PK なのでそのまま insert する
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabase.create({ ...rest, id: project.id } as unknown as Omit<ProjectRow, 'id'>);
      }
      return;
    }
    this.save(project);
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
    return this.delete(id);
  }
}
