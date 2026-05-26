/**
 * PhaseRepository — Phase 1
 * 工程データ (phases テーブル) の CRUD 永続化。
 * VITE_USE_SUPABASE=true のとき Supabase へ、それ以外はインメモリへルーティング。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';
import { supabase } from '../repository/supabase-client.js';

export type PhaseStatus = 'planned' | 'in_progress' | 'blocked' | 'done' | 'canceled';

/** 3階層工程エントリ。level: 1=大項目, 2=中項目, 3=小項目 */
export type PhaseRecord = {
  id: string;
  projectId: string;
  organizationId?: string | null;
  parentId?: string | null;
  level: 1 | 2 | 3;
  name: string;
  orderIndex: number;
  startDate?: string | null;
  endDate?: string | null;
  status: PhaseStatus;
  createdAt: string;
  updatedAt: string;
};

/** phase_status_history テーブルの1行 */
export type PhaseStatusHistoryRecord = {
  id: string;
  phaseId: string;
  oldStatus: PhaseStatus | null;
  newStatus: PhaseStatus;
  changedAt: string;
  changedBy: string | null;
};

type PhaseStatusHistoryRow = {
  id: string;
  phase_id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  changed_by: string | null;
};

function rowToHistory(row: PhaseStatusHistoryRow): PhaseStatusHistoryRecord {
  return {
    id: row.id,
    phaseId: row.phase_id,
    oldStatus: (row.old_status as PhaseStatus) ?? null,
    newStatus: row.new_status as PhaseStatus,
    changedAt: row.changed_at,
    changedBy: row.changed_by ?? null,
  };
}

// DB 行 (snake_case) ↔ アプリ型 (camelCase) のマッピング
type PhaseRow = {
  id: string;
  project_id: string;
  organization_id?: string | null;
  parent_id?: string | null;
  level: number;
  name: string;
  order_index: number;
  start_date?: string | null;
  end_date?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

function rowToPhase(row: PhaseRow): PhaseRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    organizationId: row.organization_id ?? null,
    parentId: row.parent_id ?? null,
    level: row.level as 1 | 2 | 3,
    name: row.name,
    orderIndex: row.order_index,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    status: (row.status as PhaseStatus) ?? 'planned',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function phaseToRow(p: PhaseRecord): PhaseRow {
  return {
    id: p.id,
    project_id: p.projectId,
    organization_id: p.organizationId ?? null,
    parent_id: p.parentId ?? null,
    level: p.level,
    name: p.name,
    order_index: p.orderIndex,
    start_date: p.startDate ?? null,
    end_date: p.endDate ?? null,
    status: p.status,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

export class PhaseRepository {
  private store = new Map<string, PhaseRecord>();
  private historyStore: PhaseStatusHistoryRecord[] = [];
  private supabase: SupabaseRepository<PhaseRow> | null;

  /**
   * @param useSupabase 明示指定がなければ env を見る。テスト用に上書き可。
   */
  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    this.supabase = enabled ? new SupabaseRepository<PhaseRow>('phases') : null;
  }

  async getAsync(id: string): Promise<PhaseRecord | null> {
    if (this.supabase) {
      const row = await this.supabase.getById(id);
      return row ? rowToPhase(row) : null;
    }
    return this.store.get(id) ?? null;
  }

  async listAsync(): Promise<PhaseRecord[]> {
    if (this.supabase) {
      const rows = await this.supabase.getAll();
      return rows.map(rowToPhase);
    }
    return [...this.store.values()];
  }

  async listByProjectAsync(projectId: string): Promise<PhaseRecord[]> {
    const all = await this.listAsync();
    return all
      .filter((p) => p.projectId === projectId)
      .sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt));
  }

  async saveAsync(phase: PhaseRecord): Promise<void> {
    if (this.supabase) {
      const row = phaseToRow(phase);
      const existing = await this.supabase.getById(phase.id);
      if (existing) {
        await this.supabase.update(phase.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabase.create({ ...rest, id: phase.id } as unknown as Omit<PhaseRow, 'id'>);
      }
      return;
    }
    this.store.set(phase.id, { ...phase });
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

  /**
   * ステータスを更新する。Supabase モードではトリガーが履歴を自動挿入する。
   * InMemory モードでは historyStore に手動記録する。
   */
  async updateStatus(
    phaseId: string,
    newStatus: PhaseStatus,
    changedBy?: string,
  ): Promise<void> {
    if (this.supabase) {
      const { error } = await supabase
        .from('phases')
        .update({ status: newStatus })
        .eq('id', phaseId);
      if (error) throw new Error(error.message);
      return;
    }
    const phase = this.store.get(phaseId);
    if (!phase) throw new Error(`Phase "${phaseId}" not found`);
    const oldStatus = phase.status;
    this.store.set(phaseId, { ...phase, status: newStatus });
    this.historyStore.push({
      id: crypto.randomUUID(),
      phaseId,
      oldStatus,
      newStatus,
      changedAt: new Date().toISOString(),
      changedBy: changedBy ?? null,
    });
  }

  /**
   * ステータス変更履歴を返す (changed_at 昇順)。
   */
  async getStatusHistory(phaseId: string): Promise<PhaseStatusHistoryRecord[]> {
    if (this.supabase) {
      const { data, error } = await supabase
        .from('phase_status_history')
        .select('*')
        .eq('phase_id', phaseId)
        .order('changed_at', { ascending: true });
      if (error) throw new Error(error.message);
      return ((data ?? []) as PhaseStatusHistoryRow[]).map(rowToHistory);
    }
    return this.historyStore
      .filter((h) => h.phaseId === phaseId)
      .sort((a, b) => a.changedAt.localeCompare(b.changedAt));
  }

  /**
   * プロジェクト内のフェーズをステータスでフィルタして返す。
   */
  async listByStatus(projectId: string, status: PhaseStatus): Promise<PhaseRecord[]> {
    if (this.supabase) {
      const { data, error } = await supabase
        .from('phases')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', status)
        .order('order_index', { ascending: true });
      if (error) throw new Error(error.message);
      return ((data ?? []) as PhaseRow[]).map(rowToPhase);
    }
    const all = await this.listByProjectAsync(projectId);
    return all.filter((p) => p.status === status);
  }
}
