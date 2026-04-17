/**
 * ContractorRepository — Phase C
 * async メソッドのみ（sync メソッド削除済み）。
 * async メソッドは VITE_USE_SUPABASE=true のとき Supabase へ、
 * それ以外はインメモリへルーティングする。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';

export type ContractorRecord = {
  id: string;
  name: string;
  trade: string;
  phone: string;
  email: string;
  contactPerson?: string;
  lineId?: string;
  createdAt: string;
  updatedAt: string;
};

type ContractorRow = {
  id: string;
  name: string;
  // app の "trade" は DB の "specialty" にマップ
  specialty: string | null;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  line_id?: string | null;
  created_at: string;
  updated_at: string;
};

function rowToContractor(row: ContractorRow): ContractorRecord {
  return {
    id: row.id,
    name: row.name,
    trade: row.specialty ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    contactPerson: row.contact_person ?? undefined,
    lineId: row.line_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function contractorToRow(c: ContractorRecord): ContractorRow {
  return {
    id: c.id,
    name: c.name,
    specialty: c.trade,
    contact_person: c.contactPerson ?? null,
    phone: c.phone || null,
    email: c.email || null,
    line_id: c.lineId ?? null,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

export class ContractorRepository {
  private store = new Map<string, ContractorRecord>();
  private supabase: SupabaseRepository<ContractorRow> | null;

  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    this.supabase = enabled ? new SupabaseRepository<ContractorRow>('contractors') : null;
  }

  // ── async メソッド（Phase C: Supabase or InMemory）────────────────────

  async getAsync(id: string): Promise<ContractorRecord | null> {
    if (this.supabase) {
      const row = await this.supabase.getById(id);
      return row ? rowToContractor(row) : null;
    }
    return this.store.get(id) ?? null;
  }

  async listAsync(): Promise<ContractorRecord[]> {
    if (this.supabase) {
      const rows = await this.supabase.getAll();
      return rows.map(rowToContractor);
    }
    return [...this.store.values()];
  }

  async saveAsync(contractor: ContractorRecord): Promise<void> {
    if (this.supabase) {
      const row = contractorToRow(contractor);
      const existing = await this.supabase.getById(contractor.id);
      if (existing) {
        await this.supabase.update(contractor.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabase.create({ ...rest, id: contractor.id } as unknown as Omit<ContractorRow, 'id'>);
      }
      return;
    }
    this.store.set(contractor.id, { ...contractor });
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
