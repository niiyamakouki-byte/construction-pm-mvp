/**
 * PunchListRepository — Sprint 61 Phase 2
 *
 * punch_list_items + punch_list_history テーブル向け async repository。
 * VITE_USE_SUPABASE=true で Supabase、それ以外はインメモリ。
 *
 * 履歴は item に埋め込まず、別レコード型 (PunchListHistoryRecord) として扱う。
 * アプリ側で listHistoryByItemAsync(itemId) で都度取得する想定。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';

export type PunchListPriority = 'low' | 'medium' | 'high' | 'critical';

export type PunchListStatus =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'verified';

export type PunchListHistoryAction =
  | 'created'
  | 'assigned'
  | 'status_updated'
  | 'resolved'
  | 'verified';

export type PunchListItemRecord = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  location: string;
  trade: string;
  priority: PunchListPriority;
  status: PunchListStatus;
  createdBy: string;
  createdAt: string;
  dueDate?: string;
  assignedContractorId?: string;
  assignedContractorName?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  verifiedAt?: string;
  verifiedBy?: string;
};

export type PunchListHistoryRecord = {
  id: string;
  itemId: string;
  action: PunchListHistoryAction;
  status: PunchListStatus;
  actor: string;
  timestamp: string;
  notes?: string;
};

type PunchListItemRow = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  location: string;
  trade: string;
  priority: PunchListPriority;
  status: PunchListStatus;
  created_by: string;
  due_date: string | null;
  assigned_contractor_id: string | null;
  assigned_contractor_name: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
};

type PunchListHistoryRow = {
  id: string;
  item_id: string;
  action: PunchListHistoryAction;
  status: PunchListStatus;
  actor: string;
  notes: string | null;
  created_at: string;
};

function rowToItem(row: PunchListItemRow): PunchListItemRecord {
  const r: PunchListItemRecord = {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    location: row.location,
    trade: row.trade,
    priority: row.priority,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
  if (row.due_date) r.dueDate = row.due_date;
  if (row.assigned_contractor_id) r.assignedContractorId = row.assigned_contractor_id;
  if (row.assigned_contractor_name) r.assignedContractorName = row.assigned_contractor_name;
  if (row.resolved_at) r.resolvedAt = row.resolved_at;
  if (row.resolved_by) r.resolvedBy = row.resolved_by;
  if (row.resolution_notes) r.resolutionNotes = row.resolution_notes;
  if (row.verified_at) r.verifiedAt = row.verified_at;
  if (row.verified_by) r.verifiedBy = row.verified_by;
  return r;
}

function itemToRow(r: PunchListItemRecord): PunchListItemRow {
  return {
    id: r.id,
    project_id: r.projectId,
    title: r.title,
    description: r.description,
    location: r.location,
    trade: r.trade,
    priority: r.priority,
    status: r.status,
    created_by: r.createdBy,
    due_date: r.dueDate ?? null,
    assigned_contractor_id: r.assignedContractorId ?? null,
    assigned_contractor_name: r.assignedContractorName ?? null,
    resolved_at: r.resolvedAt ?? null,
    resolved_by: r.resolvedBy ?? null,
    resolution_notes: r.resolutionNotes ?? null,
    verified_at: r.verifiedAt ?? null,
    verified_by: r.verifiedBy ?? null,
    created_at: r.createdAt,
  };
}

function rowToHistory(row: PunchListHistoryRow): PunchListHistoryRecord {
  const r: PunchListHistoryRecord = {
    id: row.id,
    itemId: row.item_id,
    action: row.action,
    status: row.status,
    actor: row.actor,
    timestamp: row.created_at,
  };
  if (row.notes) r.notes = row.notes;
  return r;
}

function historyToRow(r: PunchListHistoryRecord): PunchListHistoryRow {
  return {
    id: r.id,
    item_id: r.itemId,
    action: r.action,
    status: r.status,
    actor: r.actor,
    notes: r.notes ?? null,
    created_at: r.timestamp,
  };
}

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

export class PunchListRepository {
  private items = new Map<string, PunchListItemRecord>();
  private history = new Map<string, PunchListHistoryRecord>();
  private supabaseItems: SupabaseRepository<PunchListItemRow> | null;
  private supabaseHistory: SupabaseRepository<PunchListHistoryRow> | null;

  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    this.supabaseItems = enabled
      ? new SupabaseRepository<PunchListItemRow>('punch_list_items')
      : null;
    this.supabaseHistory = enabled
      ? new SupabaseRepository<PunchListHistoryRow>('punch_list_history')
      : null;
  }

  // ── items ───────────────────────────────────────────────────────────

  async getItemAsync(id: string): Promise<PunchListItemRecord | null> {
    if (this.supabaseItems) {
      const row = await this.supabaseItems.getById(id);
      return row ? rowToItem(row) : null;
    }
    return this.items.get(id) ?? null;
  }

  async listItemsAsync(): Promise<PunchListItemRecord[]> {
    if (this.supabaseItems) {
      const rows = await this.supabaseItems.getAll();
      return rows.map(rowToItem);
    }
    return [...this.items.values()];
  }

  async listItemsByProjectAsync(projectId: string): Promise<PunchListItemRecord[]> {
    const all = await this.listItemsAsync();
    return all.filter((r) => r.projectId === projectId);
  }

  async saveItemAsync(record: PunchListItemRecord): Promise<void> {
    if (this.supabaseItems) {
      const row = itemToRow(record);
      const existing = await this.supabaseItems.getById(record.id);
      if (existing) {
        await this.supabaseItems.update(record.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabaseItems.create({
          ...rest,
          id: record.id,
        } as unknown as Omit<PunchListItemRow, 'id'>);
      }
      return;
    }
    this.items.set(record.id, { ...record });
  }

  async deleteItemAsync(id: string): Promise<boolean> {
    if (this.supabaseItems) {
      try {
        await this.supabaseItems.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.items.delete(id);
  }

  // ── history ─────────────────────────────────────────────────────────

  async listHistoryByItemAsync(itemId: string): Promise<PunchListHistoryRecord[]> {
    if (this.supabaseHistory) {
      const rows = await this.supabaseHistory.getAll();
      return rows.filter((r) => r.item_id === itemId).map(rowToHistory);
    }
    return [...this.history.values()].filter((r) => r.itemId === itemId);
  }

  async appendHistoryAsync(record: PunchListHistoryRecord): Promise<void> {
    if (this.supabaseHistory) {
      const row = historyToRow(record);
      const { id: _id, ...rest } = row;
      void _id;
      await this.supabaseHistory.create({
        ...rest,
        id: record.id,
      } as unknown as Omit<PunchListHistoryRow, 'id'>);
      return;
    }
    this.history.set(record.id, { ...record });
  }

  async deleteHistoryAsync(id: string): Promise<boolean> {
    if (this.supabaseHistory) {
      try {
        await this.supabaseHistory.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.history.delete(id);
  }
}
