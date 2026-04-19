/**
 * SelectionRepository — Phase C
 * async メソッドのみ。VITE_USE_SUPABASE=true のとき Supabase (selection_items テーブル) へ、
 * それ以外はインメモリへルーティングする。
 * options は jsonb でまとめて保存する。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';

export type SelectionCategory =
  | '床材'
  | '壁材'
  | '天井材'
  | '建具'
  | '照明'
  | '衛生器具'
  | 'その他';

export type SelectionStatus = '選定中' | '施主確認待ち' | '承認済' | '変更依頼';

export type SelectionOptionRecord = {
  id: string;
  name: string;
  description: string;
  unitPrice: number;
  imageUrl?: string;
  catalogUrl?: string;
};

export type SelectionItemRecord = {
  id: string;
  projectId: string;
  category: SelectionCategory;
  name: string;
  options: SelectionOptionRecord[];
  selectedOptionId: string | null;
  status: SelectionStatus;
  clientNote: string;
  createdAt: string;
  updatedAt: string;
};

// DB 行。migration 013 の selection_items スキーマに合わせる。
// DB の status は英語 ('pending'|'decided'|'ordered'|'installed') のため、
// マッピングして保存/読み出しする。
type DbStatus = 'pending' | 'decided' | 'ordered' | 'installed';

type SelectionRow = {
  id: string;
  project_id: string;
  organization_id?: string | null;
  category: string;
  item_name: string;
  description?: string | null;
  options: SelectionOptionRecord[] | null;
  selected_option: string | null;
  deadline?: string | null;
  status: DbStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

function statusToDb(s: SelectionStatus): DbStatus {
  switch (s) {
    case '選定中':
      return 'pending';
    case '施主確認待ち':
      return 'decided';
    case '承認済':
      return 'installed';
    case '変更依頼':
      return 'ordered';
  }
}

function statusFromDb(s: DbStatus): SelectionStatus {
  switch (s) {
    case 'pending':
      return '選定中';
    case 'decided':
      return '施主確認待ち';
    case 'installed':
      return '承認済';
    case 'ordered':
      return '変更依頼';
  }
}

function rowToRecord(row: SelectionRow): SelectionItemRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    category: row.category as SelectionCategory,
    name: row.item_name,
    options: Array.isArray(row.options) ? row.options : [],
    selectedOptionId: row.selected_option,
    status: statusFromDb(row.status),
    clientNote: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recordToRow(r: SelectionItemRecord): SelectionRow {
  return {
    id: r.id,
    project_id: r.projectId,
    category: r.category,
    item_name: r.name,
    options: r.options,
    selected_option: r.selectedOptionId,
    status: statusToDb(r.status),
    notes: r.clientNote || null,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

export class SelectionRepository {
  private memory = new Map<string, SelectionItemRecord>();
  private supabase: SupabaseRepository<SelectionRow> | null;

  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    this.supabase = enabled ? new SupabaseRepository<SelectionRow>('selection_items') : null;
  }

  async getAsync(id: string): Promise<SelectionItemRecord | null> {
    if (this.supabase) {
      const row = await this.supabase.getById(id);
      return row ? rowToRecord(row) : null;
    }
    return this.memory.get(id) ?? null;
  }

  async listByProjectAsync(projectId: string): Promise<SelectionItemRecord[]> {
    if (this.supabase) {
      const rows = await this.supabase.getAll();
      return rows.filter((r) => r.project_id === projectId).map(rowToRecord);
    }
    return [...this.memory.values()].filter((s) => s.projectId === projectId);
  }

  async saveAsync(item: SelectionItemRecord): Promise<void> {
    if (this.supabase) {
      const row = recordToRow(item);
      const existing = await this.supabase.getById(item.id);
      if (existing) {
        await this.supabase.update(item.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabase.create({ ...rest, id: item.id } as unknown as Omit<SelectionRow, 'id'>);
      }
      return;
    }
    this.memory.set(item.id, { ...item, options: [...item.options] });
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

  _reset(): void {
    this.memory.clear();
  }
}
