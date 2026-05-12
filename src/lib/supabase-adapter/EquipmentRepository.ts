/**
 * EquipmentRepository — Sprint 61 Phase 2
 *
 * equipment_rentals + equipment_usage_logs テーブル向け async repository。
 * VITE_USE_SUPABASE=true で Supabase、それ以外はインメモリ。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';

export type EquipmentRentalStatus = 'active' | 'returned' | 'overdue';

export type EquipmentRentalRecord = {
  id: string;
  projectId: string;
  itemName: string;
  quantity: number;
  dailyRate: number;
  rentalStartDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  vendor?: string;
  status: EquipmentRentalStatus;
};

export type EquipmentUsageLogRecord = {
  id: string;
  rentalId: string;
  projectId: string;
  usageDate: string;
  hoursUsed: number;
  availableHours: number;
};

type RentalRow = {
  id: string;
  project_id: string;
  item_name: string;
  quantity: number;
  daily_rate: number;
  rental_start_date: string;
  expected_return_date: string;
  actual_return_date: string | null;
  vendor: string | null;
  status: EquipmentRentalStatus;
};

type UsageRow = {
  id: string;
  rental_id: string;
  project_id: string;
  usage_date: string;
  hours_used: number;
  available_hours: number;
};

function rowToRental(row: RentalRow): EquipmentRentalRecord {
  const r: EquipmentRentalRecord = {
    id: row.id,
    projectId: row.project_id,
    itemName: row.item_name,
    quantity: row.quantity,
    dailyRate: Number(row.daily_rate),
    rentalStartDate: row.rental_start_date,
    expectedReturnDate: row.expected_return_date,
    status: row.status,
  };
  if (row.actual_return_date) r.actualReturnDate = row.actual_return_date;
  if (row.vendor) r.vendor = row.vendor;
  return r;
}

function rentalToRow(r: EquipmentRentalRecord): RentalRow {
  return {
    id: r.id,
    project_id: r.projectId,
    item_name: r.itemName,
    quantity: r.quantity,
    daily_rate: r.dailyRate,
    rental_start_date: r.rentalStartDate,
    expected_return_date: r.expectedReturnDate,
    actual_return_date: r.actualReturnDate ?? null,
    vendor: r.vendor ?? null,
    status: r.status,
  };
}

function rowToUsage(row: UsageRow): EquipmentUsageLogRecord {
  return {
    id: row.id,
    rentalId: row.rental_id,
    projectId: row.project_id,
    usageDate: row.usage_date,
    hoursUsed: Number(row.hours_used),
    availableHours: Number(row.available_hours),
  };
}

function usageToRow(r: EquipmentUsageLogRecord): UsageRow {
  return {
    id: r.id,
    rental_id: r.rentalId,
    project_id: r.projectId,
    usage_date: r.usageDate,
    hours_used: r.hoursUsed,
    available_hours: r.availableHours,
  };
}

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

export class EquipmentRepository {
  private rentals = new Map<string, EquipmentRentalRecord>();
  private usage = new Map<string, EquipmentUsageLogRecord>();
  private supabaseRentals: SupabaseRepository<RentalRow> | null;
  private supabaseUsage: SupabaseRepository<UsageRow> | null;

  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    this.supabaseRentals = enabled
      ? new SupabaseRepository<RentalRow>('equipment_rentals')
      : null;
    this.supabaseUsage = enabled
      ? new SupabaseRepository<UsageRow>('equipment_usage_logs')
      : null;
  }

  // ── rentals ─────────────────────────────────────────────────────────

  async getRentalAsync(id: string): Promise<EquipmentRentalRecord | null> {
    if (this.supabaseRentals) {
      const row = await this.supabaseRentals.getById(id);
      return row ? rowToRental(row) : null;
    }
    return this.rentals.get(id) ?? null;
  }

  async listRentalsAsync(): Promise<EquipmentRentalRecord[]> {
    if (this.supabaseRentals) {
      const rows = await this.supabaseRentals.getAll();
      return rows.map(rowToRental);
    }
    return [...this.rentals.values()];
  }

  async listRentalsByProjectAsync(projectId: string): Promise<EquipmentRentalRecord[]> {
    const all = await this.listRentalsAsync();
    return all.filter((r) => r.projectId === projectId);
  }

  async saveRentalAsync(record: EquipmentRentalRecord): Promise<void> {
    if (this.supabaseRentals) {
      const row = rentalToRow(record);
      const existing = await this.supabaseRentals.getById(record.id);
      if (existing) {
        await this.supabaseRentals.update(record.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabaseRentals.create({
          ...rest,
          id: record.id,
        } as unknown as Omit<RentalRow, 'id'>);
      }
      return;
    }
    this.rentals.set(record.id, { ...record });
  }

  async deleteRentalAsync(id: string): Promise<boolean> {
    if (this.supabaseRentals) {
      try {
        await this.supabaseRentals.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.rentals.delete(id);
  }

  // ── usage logs ──────────────────────────────────────────────────────

  async listUsageByRentalAsync(rentalId: string): Promise<EquipmentUsageLogRecord[]> {
    if (this.supabaseUsage) {
      const rows = await this.supabaseUsage.getAll();
      return rows.filter((r) => r.rental_id === rentalId).map(rowToUsage);
    }
    return [...this.usage.values()].filter((r) => r.rentalId === rentalId);
  }

  async saveUsageAsync(record: EquipmentUsageLogRecord): Promise<void> {
    if (this.supabaseUsage) {
      const row = usageToRow(record);
      const existing = await this.supabaseUsage.getById(record.id);
      if (existing) {
        await this.supabaseUsage.update(record.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabaseUsage.create({
          ...rest,
          id: record.id,
        } as unknown as Omit<UsageRow, 'id'>);
      }
      return;
    }
    this.usage.set(record.id, { ...record });
  }

  async deleteUsageAsync(id: string): Promise<boolean> {
    if (this.supabaseUsage) {
      try {
        await this.supabaseUsage.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.usage.delete(id);
  }
}
