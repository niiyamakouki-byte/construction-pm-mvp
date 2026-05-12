/**
 * ComplianceRepository — Sprint 61 Phase 2
 *
 * compliance_requirements + compliance_audit_log テーブル向け async repository。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';

export type ComplianceStatus =
  | 'compliant'
  | 'warning'
  | 'overdue'
  | 'not_applicable';

export type ComplianceRequirementRecord = {
  id: string;
  projectId: string;
  name: string;
  category: string;
  description: string;
  dueDate: string;
  status: ComplianceStatus;
  completedDate?: string;
  responsiblePerson?: string;
  documentUrl?: string;
  notes?: string;
};

export type ComplianceAuditEntryRecord = {
  id: string;
  requirementId: string;
  action: string;
  performedBy: string;
  timestamp: string;
  details: string;
};

type RequirementRow = {
  id: string;
  project_id: string;
  name: string;
  category: string;
  description: string;
  due_date: string;
  status: ComplianceStatus;
  completed_date: string | null;
  responsible_person: string | null;
  document_url: string | null;
  notes: string | null;
};

type AuditRow = {
  id: string;
  requirement_id: string;
  action: string;
  performed_by: string;
  timestamp: string;
  details: string;
};

function rowToRequirement(row: RequirementRow): ComplianceRequirementRecord {
  const r: ComplianceRequirementRecord = {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    category: row.category,
    description: row.description,
    dueDate: row.due_date,
    status: row.status,
  };
  if (row.completed_date) r.completedDate = row.completed_date;
  if (row.responsible_person) r.responsiblePerson = row.responsible_person;
  if (row.document_url) r.documentUrl = row.document_url;
  if (row.notes) r.notes = row.notes;
  return r;
}

function requirementToRow(r: ComplianceRequirementRecord): RequirementRow {
  return {
    id: r.id,
    project_id: r.projectId,
    name: r.name,
    category: r.category,
    description: r.description,
    due_date: r.dueDate,
    status: r.status,
    completed_date: r.completedDate ?? null,
    responsible_person: r.responsiblePerson ?? null,
    document_url: r.documentUrl ?? null,
    notes: r.notes ?? null,
  };
}

function rowToAudit(row: AuditRow): ComplianceAuditEntryRecord {
  return {
    id: row.id,
    requirementId: row.requirement_id,
    action: row.action,
    performedBy: row.performed_by,
    timestamp: row.timestamp,
    details: row.details,
  };
}

function auditToRow(r: ComplianceAuditEntryRecord): AuditRow {
  return {
    id: r.id,
    requirement_id: r.requirementId,
    action: r.action,
    performed_by: r.performedBy,
    timestamp: r.timestamp,
    details: r.details,
  };
}

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

export class ComplianceRepository {
  private requirements = new Map<string, ComplianceRequirementRecord>();
  private audit = new Map<string, ComplianceAuditEntryRecord>();
  private supabaseReqs: SupabaseRepository<RequirementRow> | null;
  private supabaseAudit: SupabaseRepository<AuditRow> | null;

  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    this.supabaseReqs = enabled
      ? new SupabaseRepository<RequirementRow>('compliance_requirements')
      : null;
    this.supabaseAudit = enabled
      ? new SupabaseRepository<AuditRow>('compliance_audit_log')
      : null;
  }

  // ── requirements ───────────────────────────────────────────────────

  async getRequirementAsync(
    id: string,
  ): Promise<ComplianceRequirementRecord | null> {
    if (this.supabaseReqs) {
      const row = await this.supabaseReqs.getById(id);
      return row ? rowToRequirement(row) : null;
    }
    return this.requirements.get(id) ?? null;
  }

  async listRequirementsAsync(): Promise<ComplianceRequirementRecord[]> {
    if (this.supabaseReqs) {
      const rows = await this.supabaseReqs.getAll();
      return rows.map(rowToRequirement);
    }
    return [...this.requirements.values()];
  }

  async listRequirementsByProjectAsync(
    projectId: string,
  ): Promise<ComplianceRequirementRecord[]> {
    const all = await this.listRequirementsAsync();
    return all.filter((r) => r.projectId === projectId);
  }

  async saveRequirementAsync(
    record: ComplianceRequirementRecord,
  ): Promise<void> {
    if (this.supabaseReqs) {
      const row = requirementToRow(record);
      const existing = await this.supabaseReqs.getById(record.id);
      if (existing) {
        await this.supabaseReqs.update(record.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabaseReqs.create({
          ...rest,
          id: record.id,
        } as unknown as Omit<RequirementRow, 'id'>);
      }
      return;
    }
    this.requirements.set(record.id, { ...record });
  }

  async deleteRequirementAsync(id: string): Promise<boolean> {
    if (this.supabaseReqs) {
      try {
        await this.supabaseReqs.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.requirements.delete(id);
  }

  // ── audit log ──────────────────────────────────────────────────────

  async listAuditByRequirementAsync(
    requirementId: string,
  ): Promise<ComplianceAuditEntryRecord[]> {
    if (this.supabaseAudit) {
      const rows = await this.supabaseAudit.getAll();
      return rows
        .filter((r) => r.requirement_id === requirementId)
        .map(rowToAudit);
    }
    return [...this.audit.values()].filter(
      (r) => r.requirementId === requirementId,
    );
  }

  async appendAuditAsync(record: ComplianceAuditEntryRecord): Promise<void> {
    if (this.supabaseAudit) {
      const row = auditToRow(record);
      const { id: _id, ...rest } = row;
      void _id;
      await this.supabaseAudit.create({
        ...rest,
        id: record.id,
      } as unknown as Omit<AuditRow, 'id'>);
      return;
    }
    this.audit.set(record.id, { ...record });
  }

  async deleteAuditAsync(id: string): Promise<boolean> {
    if (this.supabaseAudit) {
      try {
        await this.supabaseAudit.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.audit.delete(id);
  }
}
