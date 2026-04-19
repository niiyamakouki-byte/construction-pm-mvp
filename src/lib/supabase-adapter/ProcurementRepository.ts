/**
 * ProcurementRepository — Phase C
 * async メソッドのみ。VITE_USE_SUPABASE=true のとき Supabase
 * (procurement_materials テーブル) へ、それ以外はインメモリへルーティングする。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';

export type ProcurementMaterialStatus =
  | 'unordered'
  | 'ordered'
  | 'delivered'
  | 'accepted';

export type ProcurementMaterialRecord = {
  id: string;
  projectId: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  status: ProcurementMaterialStatus;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
};

type ProcurementMaterialRow = {
  id: string;
  project_id: string;
  organization_id?: string | null;
  name: string;
  category: string | null;
  quantity: number | string | null;
  unit: string | null;
  status: ProcurementMaterialStatus;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

function rowToRecord(row: ProcurementMaterialRow): ProcurementMaterialRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    category: row.category ?? '',
    quantity: Number(row.quantity ?? 0),
    unit: row.unit ?? '',
    status: row.status,
    dueDate: row.due_date ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recordToRow(m: ProcurementMaterialRecord): ProcurementMaterialRow {
  return {
    id: m.id,
    project_id: m.projectId,
    name: m.name,
    category: m.category,
    quantity: m.quantity,
    unit: m.unit,
    status: m.status,
    due_date: m.dueDate || null,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
  };
}

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

export class ProcurementRepository {
  private memory = new Map<string, ProcurementMaterialRecord>();
  private supabase: SupabaseRepository<ProcurementMaterialRow> | null;

  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    this.supabase = enabled
      ? new SupabaseRepository<ProcurementMaterialRow>('procurement_materials')
      : null;
  }

  async getAsync(id: string): Promise<ProcurementMaterialRecord | null> {
    if (this.supabase) {
      const row = await this.supabase.getById(id);
      return row ? rowToRecord(row) : null;
    }
    return this.memory.get(id) ?? null;
  }

  async listByProjectAsync(projectId: string): Promise<ProcurementMaterialRecord[]> {
    if (this.supabase) {
      const rows = await this.supabase.getAll();
      return rows.filter((r) => r.project_id === projectId).map(rowToRecord);
    }
    return [...this.memory.values()].filter((m) => m.projectId === projectId);
  }

  async saveAsync(material: ProcurementMaterialRecord): Promise<void> {
    if (this.supabase) {
      const row = recordToRow(material);
      const existing = await this.supabase.getById(material.id);
      if (existing) {
        await this.supabase.update(material.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabase.create({
          ...rest,
          id: material.id,
        } as unknown as Omit<ProcurementMaterialRow, 'id'>);
      }
      return;
    }
    this.memory.set(material.id, { ...material });
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
    return this.memory.delete(id);
  }

  /** Test helper — clears in-memory state only. */
  _reset(): void {
    this.memory.clear();
  }
}
