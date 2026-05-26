/**
 * PermitRepository — Sprint 61 Phase 2
 *
 * permit_applications + permit_inspections テーブル向け async repository。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';

export type PermitStatus =
  | 'applied'
  | 'approved'
  | 'inspection_scheduled'
  | 'expired'
  | 'closed';

export type PermitInspectionStatus =
  | 'scheduled'
  | 'passed'
  | 'failed'
  | 'cancelled';

export type PermitApplicationRecord = {
  id: string;
  projectId: string;
  permitType: string;
  jurisdiction: string;
  applicationDate: string;
  applicantName: string;
  status: PermitStatus;
  approvalDate?: string;
  permitNumber?: string;
  expiryDate?: string;
  notes?: string;
};

export type PermitInspectionRecord = {
  id: string;
  permitId: string;
  projectId: string;
  inspectionType: string;
  scheduledDate: string;
  status: PermitInspectionStatus;
  inspectorName?: string;
  notes?: string;
};

type ApplicationRow = {
  id: string;
  project_id: string;
  permit_type: string;
  jurisdiction: string;
  application_date: string;
  applicant_name: string;
  status: PermitStatus;
  approval_date: string | null;
  permit_number: string | null;
  expiry_date: string | null;
  notes: string | null;
};

type InspectionRow = {
  id: string;
  permit_id: string;
  project_id: string;
  inspection_type: string;
  scheduled_date: string;
  status: PermitInspectionStatus;
  inspector_name: string | null;
  notes: string | null;
};

function rowToApplication(row: ApplicationRow): PermitApplicationRecord {
  const r: PermitApplicationRecord = {
    id: row.id,
    projectId: row.project_id,
    permitType: row.permit_type,
    jurisdiction: row.jurisdiction,
    applicationDate: row.application_date,
    applicantName: row.applicant_name,
    status: row.status,
  };
  if (row.approval_date) r.approvalDate = row.approval_date;
  if (row.permit_number) r.permitNumber = row.permit_number;
  if (row.expiry_date) r.expiryDate = row.expiry_date;
  if (row.notes) r.notes = row.notes;
  return r;
}

function applicationToRow(r: PermitApplicationRecord): ApplicationRow {
  return {
    id: r.id,
    project_id: r.projectId,
    permit_type: r.permitType,
    jurisdiction: r.jurisdiction,
    application_date: r.applicationDate,
    applicant_name: r.applicantName,
    status: r.status,
    approval_date: r.approvalDate ?? null,
    permit_number: r.permitNumber ?? null,
    expiry_date: r.expiryDate ?? null,
    notes: r.notes ?? null,
  };
}

function rowToInspection(row: InspectionRow): PermitInspectionRecord {
  const r: PermitInspectionRecord = {
    id: row.id,
    permitId: row.permit_id,
    projectId: row.project_id,
    inspectionType: row.inspection_type,
    scheduledDate: row.scheduled_date,
    status: row.status,
  };
  if (row.inspector_name) r.inspectorName = row.inspector_name;
  if (row.notes) r.notes = row.notes;
  return r;
}

function inspectionToRow(r: PermitInspectionRecord): InspectionRow {
  return {
    id: r.id,
    permit_id: r.permitId,
    project_id: r.projectId,
    inspection_type: r.inspectionType,
    scheduled_date: r.scheduledDate,
    status: r.status,
    inspector_name: r.inspectorName ?? null,
    notes: r.notes ?? null,
  };
}

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

export class PermitRepository {
  private permits = new Map<string, PermitApplicationRecord>();
  private inspections = new Map<string, PermitInspectionRecord>();
  private supabasePermits: SupabaseRepository<ApplicationRow> | null;
  private supabaseInspections: SupabaseRepository<InspectionRow> | null;

  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    this.supabasePermits = enabled
      ? new SupabaseRepository<ApplicationRow>('permit_applications')
      : null;
    this.supabaseInspections = enabled
      ? new SupabaseRepository<InspectionRow>('permit_inspections')
      : null;
  }

  // ── permit applications ────────────────────────────────────────────

  async getPermitAsync(id: string): Promise<PermitApplicationRecord | null> {
    if (this.supabasePermits) {
      const row = await this.supabasePermits.getById(id);
      return row ? rowToApplication(row) : null;
    }
    return this.permits.get(id) ?? null;
  }

  async listPermitsAsync(): Promise<PermitApplicationRecord[]> {
    if (this.supabasePermits) {
      const rows = await this.supabasePermits.getAll();
      return rows.map(rowToApplication);
    }
    return [...this.permits.values()];
  }

  async listPermitsByProjectAsync(projectId: string): Promise<PermitApplicationRecord[]> {
    const all = await this.listPermitsAsync();
    return all.filter((r) => r.projectId === projectId);
  }

  async savePermitAsync(record: PermitApplicationRecord): Promise<void> {
    if (this.supabasePermits) {
      const row = applicationToRow(record);
      const existing = await this.supabasePermits.getById(record.id);
      if (existing) {
        await this.supabasePermits.update(record.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabasePermits.create({
          ...rest,
          id: record.id,
        } as unknown as Omit<ApplicationRow, 'id'>);
      }
      return;
    }
    this.permits.set(record.id, { ...record });
  }

  async deletePermitAsync(id: string): Promise<boolean> {
    if (this.supabasePermits) {
      try {
        await this.supabasePermits.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.permits.delete(id);
  }

  // ── inspections ────────────────────────────────────────────────────

  async listInspectionsByPermitAsync(
    permitId: string,
  ): Promise<PermitInspectionRecord[]> {
    if (this.supabaseInspections) {
      const rows = await this.supabaseInspections.getAll();
      return rows.filter((r) => r.permit_id === permitId).map(rowToInspection);
    }
    return [...this.inspections.values()].filter((r) => r.permitId === permitId);
  }

  async saveInspectionAsync(record: PermitInspectionRecord): Promise<void> {
    if (this.supabaseInspections) {
      const row = inspectionToRow(record);
      const existing = await this.supabaseInspections.getById(record.id);
      if (existing) {
        await this.supabaseInspections.update(record.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabaseInspections.create({
          ...rest,
          id: record.id,
        } as unknown as Omit<InspectionRow, 'id'>);
      }
      return;
    }
    this.inspections.set(record.id, { ...record });
  }

  async deleteInspectionAsync(id: string): Promise<boolean> {
    if (this.supabaseInspections) {
      try {
        await this.supabaseInspections.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.inspections.delete(id);
  }
}
