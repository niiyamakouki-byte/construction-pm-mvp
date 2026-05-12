/**
 * ClaimRepository — Sprint 61 Phase 2
 *
 * insurance_claims + claim_documents + claim_disputes テーブル向け async repository。
 */

import { SupabaseRepository } from '../repository/supabase-repository.js';

export type ClaimStatus =
  | 'open'
  | 'under_review'
  | 'approved'
  | 'disputed'
  | 'resolved'
  | 'rejected';

export type ClaimDocumentType =
  | 'photo'
  | 'invoice'
  | 'report'
  | 'correspondence'
  | 'other';

export type DisputeStatus = 'open' | 'resolved' | 'withdrawn';

export type InsuranceClaimRecord = {
  id: string;
  projectId: string;
  claimType: string;
  incidentDate: string;
  description: string;
  claimedAmount: number;
  approvedAmount?: number;
  status: ClaimStatus;
  openedBy: string;
  resolutionDate?: string;
  notes?: string;
};

export type ClaimDocumentRecord = {
  id: string;
  claimId: string;
  projectId: string;
  fileName: string;
  documentType: ClaimDocumentType;
  uploadedAt: string;
  uploadedBy: string;
};

export type ClaimDisputeRecord = {
  id: string;
  claimId: string;
  projectId: string;
  reason: string;
  disputedAmount: number;
  openedDate: string;
  status: DisputeStatus;
  resolutionDate?: string;
  outcome?: string;
};

type ClaimRow = {
  id: string;
  project_id: string;
  claim_type: string;
  incident_date: string;
  description: string;
  claimed_amount: number;
  approved_amount: number | null;
  status: ClaimStatus;
  opened_by: string;
  resolution_date: string | null;
  notes: string | null;
};

type DocumentRow = {
  id: string;
  claim_id: string;
  project_id: string;
  file_name: string;
  document_type: ClaimDocumentType;
  uploaded_at: string;
  uploaded_by: string;
};

type DisputeRow = {
  id: string;
  claim_id: string;
  project_id: string;
  reason: string;
  disputed_amount: number;
  opened_date: string;
  status: DisputeStatus;
  resolution_date: string | null;
  outcome: string | null;
};

function rowToClaim(row: ClaimRow): InsuranceClaimRecord {
  const r: InsuranceClaimRecord = {
    id: row.id,
    projectId: row.project_id,
    claimType: row.claim_type,
    incidentDate: row.incident_date,
    description: row.description,
    claimedAmount: Number(row.claimed_amount),
    status: row.status,
    openedBy: row.opened_by,
  };
  if (row.approved_amount !== null) r.approvedAmount = Number(row.approved_amount);
  if (row.resolution_date) r.resolutionDate = row.resolution_date;
  if (row.notes) r.notes = row.notes;
  return r;
}

function claimToRow(r: InsuranceClaimRecord): ClaimRow {
  return {
    id: r.id,
    project_id: r.projectId,
    claim_type: r.claimType,
    incident_date: r.incidentDate,
    description: r.description,
    claimed_amount: r.claimedAmount,
    approved_amount: r.approvedAmount ?? null,
    status: r.status,
    opened_by: r.openedBy,
    resolution_date: r.resolutionDate ?? null,
    notes: r.notes ?? null,
  };
}

function rowToDocument(row: DocumentRow): ClaimDocumentRecord {
  return {
    id: row.id,
    claimId: row.claim_id,
    projectId: row.project_id,
    fileName: row.file_name,
    documentType: row.document_type,
    uploadedAt: row.uploaded_at,
    uploadedBy: row.uploaded_by,
  };
}

function documentToRow(r: ClaimDocumentRecord): DocumentRow {
  return {
    id: r.id,
    claim_id: r.claimId,
    project_id: r.projectId,
    file_name: r.fileName,
    document_type: r.documentType,
    uploaded_at: r.uploadedAt,
    uploaded_by: r.uploadedBy,
  };
}

function rowToDispute(row: DisputeRow): ClaimDisputeRecord {
  const r: ClaimDisputeRecord = {
    id: row.id,
    claimId: row.claim_id,
    projectId: row.project_id,
    reason: row.reason,
    disputedAmount: Number(row.disputed_amount),
    openedDate: row.opened_date,
    status: row.status,
  };
  if (row.resolution_date) r.resolutionDate = row.resolution_date;
  if (row.outcome) r.outcome = row.outcome;
  return r;
}

function disputeToRow(r: ClaimDisputeRecord): DisputeRow {
  return {
    id: r.id,
    claim_id: r.claimId,
    project_id: r.projectId,
    reason: r.reason,
    disputed_amount: r.disputedAmount,
    opened_date: r.openedDate,
    status: r.status,
    resolution_date: r.resolutionDate ?? null,
    outcome: r.outcome ?? null,
  };
}

function isSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  return false;
}

export class ClaimRepository {
  private claims = new Map<string, InsuranceClaimRecord>();
  private documents = new Map<string, ClaimDocumentRecord>();
  private disputes = new Map<string, ClaimDisputeRecord>();
  private supabaseClaims: SupabaseRepository<ClaimRow> | null;
  private supabaseDocs: SupabaseRepository<DocumentRow> | null;
  private supabaseDisputes: SupabaseRepository<DisputeRow> | null;

  constructor(useSupabase?: boolean) {
    const enabled = useSupabase ?? isSupabaseEnabled();
    this.supabaseClaims = enabled
      ? new SupabaseRepository<ClaimRow>('insurance_claims')
      : null;
    this.supabaseDocs = enabled
      ? new SupabaseRepository<DocumentRow>('claim_documents')
      : null;
    this.supabaseDisputes = enabled
      ? new SupabaseRepository<DisputeRow>('claim_disputes')
      : null;
  }

  // ── claims ─────────────────────────────────────────────────────────

  async getClaimAsync(id: string): Promise<InsuranceClaimRecord | null> {
    if (this.supabaseClaims) {
      const row = await this.supabaseClaims.getById(id);
      return row ? rowToClaim(row) : null;
    }
    return this.claims.get(id) ?? null;
  }

  async listClaimsAsync(): Promise<InsuranceClaimRecord[]> {
    if (this.supabaseClaims) {
      const rows = await this.supabaseClaims.getAll();
      return rows.map(rowToClaim);
    }
    return [...this.claims.values()];
  }

  async listClaimsByProjectAsync(projectId: string): Promise<InsuranceClaimRecord[]> {
    const all = await this.listClaimsAsync();
    return all.filter((r) => r.projectId === projectId);
  }

  async saveClaimAsync(record: InsuranceClaimRecord): Promise<void> {
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

  // ── documents ───────────────────────────────────────────────────────

  async listDocumentsByClaimAsync(claimId: string): Promise<ClaimDocumentRecord[]> {
    if (this.supabaseDocs) {
      const rows = await this.supabaseDocs.getAll();
      return rows.filter((r) => r.claim_id === claimId).map(rowToDocument);
    }
    return [...this.documents.values()].filter((r) => r.claimId === claimId);
  }

  async appendDocumentAsync(record: ClaimDocumentRecord): Promise<void> {
    if (this.supabaseDocs) {
      const row = documentToRow(record);
      const { id: _id, ...rest } = row;
      void _id;
      await this.supabaseDocs.create({
        ...rest,
        id: record.id,
      } as unknown as Omit<DocumentRow, 'id'>);
      return;
    }
    this.documents.set(record.id, { ...record });
  }

  async deleteDocumentAsync(id: string): Promise<boolean> {
    if (this.supabaseDocs) {
      try {
        await this.supabaseDocs.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.documents.delete(id);
  }

  // ── disputes ────────────────────────────────────────────────────────

  async listDisputesByClaimAsync(claimId: string): Promise<ClaimDisputeRecord[]> {
    if (this.supabaseDisputes) {
      const rows = await this.supabaseDisputes.getAll();
      return rows.filter((r) => r.claim_id === claimId).map(rowToDispute);
    }
    return [...this.disputes.values()].filter((r) => r.claimId === claimId);
  }

  async saveDisputeAsync(record: ClaimDisputeRecord): Promise<void> {
    if (this.supabaseDisputes) {
      const row = disputeToRow(record);
      const existing = await this.supabaseDisputes.getById(record.id);
      if (existing) {
        await this.supabaseDisputes.update(record.id, row);
      } else {
        const { id: _id, ...rest } = row;
        void _id;
        await this.supabaseDisputes.create({
          ...rest,
          id: record.id,
        } as unknown as Omit<DisputeRow, 'id'>);
      }
      return;
    }
    this.disputes.set(record.id, { ...record });
  }

  async deleteDisputeAsync(id: string): Promise<boolean> {
    if (this.supabaseDisputes) {
      try {
        await this.supabaseDisputes.delete(id);
        return true;
      } catch {
        return false;
      }
    }
    return this.disputes.delete(id);
  }
}
