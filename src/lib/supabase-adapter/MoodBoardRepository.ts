/**
 * MoodBoardRepository — Phase C
 * async メソッドのみ。VITE_USE_SUPABASE=true のとき Supabase (mood_boards テーブル) へ、
 * それ以外はインメモリへルーティングする。
 * items は jsonb でまとめて保存する。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';

export type MoodBoardCategory =
  | '床'
  | '壁'
  | '天井'
  | '家具'
  | '照明'
  | 'カーテン'
  | 'その他';

export type MoodBoardItemRecord = {
  id: string;
  imageUrl: string;
  title: string;
  description: string;
  category: MoodBoardCategory;
  supplier?: string;
  price?: number;
  position: { x: number; y: number };
  size: { w: number; h: number };
};

export type MoodBoardRecord = {
  id: string;
  projectId: string;
  title: string;
  items: MoodBoardItemRecord[];
  createdAt: string;
  updatedAt: string;
};

type MoodBoardRow = {
  id: string;
  project_id: string;
  title: string;
  items: MoodBoardItemRecord[] | null;
  description?: string | null;
  organization_id?: string | null;
  created_at: string;
  updated_at: string;
};

function rowToRecord(row: MoodBoardRow): MoodBoardRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    items: Array.isArray(row.items) ? row.items : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recordToRow(b: MoodBoardRecord): MoodBoardRow {
  return {
    id: b.id,
    project_id: b.projectId,
    title: b.title,
    items: b.items,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
  };
}

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

export class MoodBoardRepository {
  private memory = new Map<string, MoodBoardRecord>();
  private supabase: SupabaseRepository<MoodBoardRow> | null;

  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    this.supabase = enabled ? new SupabaseRepository<MoodBoardRow>('mood_boards') : null;
  }

  async getAsync(id: string): Promise<MoodBoardRecord | null> {
    if (this.supabase) {
      const row = await this.supabase.getById(id);
      return row ? rowToRecord(row) : null;
    }
    return this.memory.get(id) ?? null;
  }

  async listByProjectAsync(projectId: string): Promise<MoodBoardRecord[]> {
    if (this.supabase) {
      const rows = await this.supabase.getAll();
      return rows.filter((r) => r.project_id === projectId).map(rowToRecord);
    }
    return [...this.memory.values()].filter((b) => b.projectId === projectId);
  }

  async saveAsync(board: MoodBoardRecord): Promise<void> {
    if (this.supabase) {
      const row = recordToRow(board);
      const existing = await this.supabase.getById(board.id);
      if (existing) {
        await this.supabase.update(board.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabase.create({ ...rest, id: board.id } as unknown as Omit<MoodBoardRow, 'id'>);
      }
      return;
    }
    this.memory.set(board.id, { ...board, items: [...board.items] });
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
