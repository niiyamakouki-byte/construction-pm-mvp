/**
 * WarrantyRepository — Sprint 61 Phase 2
 *
 * warranty_items + warranty_claims テーブル向け async repository。
 *
 * NOTE: store の WarrantyItem には claimHistory 配列が含まれるが、
 * DB は別テーブル warranty_claims で管理する。本 Repository はテーブル構造に合わせ、
 * item と claim を独立した record 型として扱う。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';

export type WarrantyClaimStatus =
  | 'submitted'
  | 'approved'
  | 'denied'
  | 'resolved';

export type WarrantyItemRecord = {
  id: string;
  projectId: string;
  assetName: string;
  category: string;
  vendorName: string;
  startDate: string;
  expiryDate: string;
  warrantyTerms?: string;
  serialNumber?: string;
};

export type WarrantyClaimRecord = {
  id: string;
  warrantyItemId: string;
  claimDate: string;
  issue: string;
  status: WarrantyClaimStatus;
  resolutionNotes?: string;
};

type ItemRow = {
  id: string;
  project_id: string;
  asset_name: string;
  category: string;
  vendor_name: string;
  start_date: string;
  expiry_date: string;
  warranty_terms: string | null;
  serial_number: string | null;
};

type ClaimRow = {
  id: string;
  warranty_item_id: string;
  claim_date: string;
  issue: string;
  status: WarrantyClaimStatus;
  resolution_notes: string | null;
};

function rowToItem(row: ItemRow): WarrantyItemRecord {
  const r: WarrantyItemRecord = {
    id: row.id,
    projectId: row.project_id,
    assetName: row.asset_name,
    category: row.category,
    vendorName: row.vendor_name,
    startDate: row.start_date,
    expiryDate: row.expiry_date,
  };
  if (row.warranty_terms) r.warrantyTerms = row.warranty_terms;
  if (row.serial_number) r.serialNumber = row.serial_number;
  return r;
}

function itemToRow(r: WarrantyItemRecord): ItemRow {
  return {
    id: r.id,
    project_id: r.projectId,
    asset_name: r.assetName,
    category: r.category,
    vendor_name: r.vendorName,
    start_date: r.startDate,
    expiry_date: r.expiryDate,
    warranty_terms: r.warrantyTerms ?? null,
    serial_number: r.serialNumber ?? null,
  };
}

function rowToClaim(row: ClaimRow): WarrantyClaimRecord {
  const r: WarrantyClaimRecord = {
    id: row.id,
    warrantyItemId: row.warranty_item_id,
    claimDate: row.claim_date,
    issue: row.issue,
    status: row.status,
  };
  if (row.resolution_notes) r.resolutionNotes = row.resolution_notes;
  return r;
}

function claimToRow(r: WarrantyClaimRecord): ClaimRow {
  return {
    id: r.id,
    warranty_item_id: r.warrantyItemId,
    claim_date: r.claimDate,
    issue: r.issue,
    status: r.status,
    resolution_notes: r.resolutionNotes ?? null,
  };
}

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

export class WarrantyRepository {
  private items = new Map<string, WarrantyItemRecord>();
  private claims = new Map<string, WarrantyClaimRecord>();
  private supabaseItems: SupabaseRepository<ItemRow> | null;
  private supabaseClaims: SupabaseRepository<ClaimRow> | null;

  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    this.supabaseItems = enabled
      ? new SupabaseRepository<ItemRow>('warranty_items')
      : null;
    this.supabaseClaims = enabled
      ? new SupabaseRepository<ClaimRow>('warranty_claims')
      : null;
  }

  // ── warranty items ─────────────────────────────────────────────────

  async getItemAsync(id: string): Promise<WarrantyItemRecord | null> {
    if (this.supabaseItems) {
      const row = await this.supabaseItems.getById(id);
      return row ? rowToItem(row) : null;
    }
    return this.items.get(id) ?? null;
  }

  async listItemsAsync(): Promise<WarrantyItemRecord[]> {
    if (this.supabaseItems) {
      const rows = await this.supabaseItems.getAll();
      return rows.map(rowToItem);
    }
    return [...this.items.values()];
  }

  async listItemsByProjectAsync(projectId: string): Promise<WarrantyItemRecord[]> {
    const all = await this.listItemsAsync();
    return all.filter((r) => r.projectId === projectId);
  }

  async saveItemAsync(record: WarrantyItemRecord): Promise<void> {
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
        } as unknown as Omit<ItemRow, 'id'>);
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

  // ── warranty claims ────────────────────────────────────────────────

  async listClaimsByItemAsync(itemId: string): Promise<WarrantyClaimRecord[]> {
    if (this.supabaseClaims) {
      const rows = await this.supabaseClaims.getAll();
      return rows.filter((r) => r.warranty_item_id === itemId).map(rowToClaim);
    }
    return [...this.claims.values()].filter((r) => r.warrantyItemId === itemId);
  }

  async saveClaimAsync(record: WarrantyClaimRecord): Promise<void> {
    if (this.supabaseClaims) {
      const row = claimToRow(record);
      const existing = await this.supabaseClaims.getById(record.id);
      if (existing) {
        await this.supabaseClaims.update(record.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabaseClaims.create({
          ...rest,
          id: record.id,
        } as unknown as Omit<ClaimRow, 'id'>);
      }
      return;
    }
    this.claims.set(record.id, { ...record });
  }

  async deleteClaimAsync(id: string): Promise<boolean> {
    if (this.supabaseClaims) {
      try {
        await this.supabaseClaims.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.claims.delete(id);
  }
}
