/**
 * Insurance claim creation, documentation, disputes, resolution, and impact.
 */

export type ClaimStatus =
  | "open"
  | "under_review"
  | "approved"
  | "disputed"
  | "resolved"
  | "rejected";

export type DisputeStatus = "open" | "resolved" | "withdrawn";

export type InsuranceClaim = {
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

export type ClaimDocument = {
  id: string;
  claimId: string;
  projectId: string;
  fileName: string;
  documentType: "photo" | "invoice" | "report" | "correspondence" | "other";
  uploadedAt: string;
  uploadedBy: string;
};

export type ClaimDispute = {
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

export type ClaimImpactSummary = {
  projectId: string;
  totalClaims: number;
  openClaims: number;
  resolvedClaims: number;
  disputedClaims: number;
  totalClaimedAmount: number;
  totalApprovedAmount: number;
  totalDisputedAmount: number;
  netImpact: number;
};

const claims: InsuranceClaim[] = [];
const claimDocuments: ClaimDocument[] = [];
const claimDisputes: ClaimDispute[] = [];

export function createClaim(claim: InsuranceClaim): InsuranceClaim {
  claims.push({ ...claim });
  return claim;
}

export function addClaimDocument(
  document: ClaimDocument,
): ClaimDocument | null {
  const claim = claims.find((entry) => entry.id === document.claimId);
  if (!claim) return null;

  claimDocuments.push({ ...document });
  return document;
}

export function openClaimDispute(
  dispute: ClaimDispute,
): ClaimDispute | null {
  const claim = claims.find((entry) => entry.id === dispute.claimId);
  if (!claim) return null;

  claim.status = "disputed";
  claimDisputes.push({ ...dispute });
  return dispute;
}

export function updateClaimStatus(
  claimId: string,
  status: ClaimStatus,
  options: {
    resolutionDate?: string;
    approvedAmount?: number;
    notes?: string;
  } = {},
): InsuranceClaim | null {
  const claim = claims.find((entry) => entry.id === claimId);
  if (!claim) return null;

  claim.status = status;
  if (options.resolutionDate) {
    claim.resolutionDate = options.resolutionDate;
  }
  if (options.approvedAmount !== undefined) {
    claim.approvedAmount = options.approvedAmount;
  }
  if (options.notes) {
    claim.notes = options.notes;
  }

  return claim;
}

export function resolveDispute(
  disputeId: string,
  resolutionDate: string,
  outcome: string,
): ClaimDispute | null {
  const dispute = claimDisputes.find((entry) => entry.id === disputeId);
  if (!dispute) return null;

  dispute.status = "resolved";
  dispute.resolutionDate = resolutionDate;
  dispute.outcome = outcome;

  return dispute;
}

export function getClaims(projectId: string): InsuranceClaim[] {
  return claims.filter((claim) => claim.projectId === projectId);
}

export function getClaimDocuments(claimId: string): ClaimDocument[] {
  return claimDocuments.filter((document) => document.claimId === claimId);
}

export function getClaimDisputes(
  projectId: string,
  claimId?: string,
): ClaimDispute[] {
  return claimDisputes.filter(
    (dispute) =>
      dispute.projectId === projectId &&
      (!claimId || dispute.claimId === claimId),
  );
}

export function calculateClaimImpact(projectId: string): ClaimImpactSummary {
  const projectClaims = getClaims(projectId);
  const projectDisputes = getClaimDisputes(projectId);
  const totalClaimedAmount = projectClaims.reduce(
    (sum, claim) => sum + claim.claimedAmount,
    0,
  );
  const totalApprovedAmount = projectClaims.reduce(
    (sum, claim) => sum + (claim.approvedAmount ?? 0),
    0,
  );
  const totalDisputedAmount = projectDisputes
    .filter((dispute) => dispute.status === "open")
    .reduce((sum, dispute) => sum + dispute.disputedAmount, 0);

  return {
    projectId,
    totalClaims: projectClaims.length,
    openClaims: projectClaims.filter((claim) =>
      ["open", "under_review", "disputed"].includes(claim.status),
    ).length,
    resolvedClaims: projectClaims.filter((claim) =>
      ["approved", "resolved", "rejected"].includes(claim.status),
    ).length,
    disputedClaims: projectClaims.filter((claim) => claim.status === "disputed").length,
    totalClaimedAmount,
    totalApprovedAmount,
    totalDisputedAmount,
    netImpact: totalClaimedAmount - totalApprovedAmount,
  };
}

export function _resetClaimStore(): void {
  claims.length = 0;
  claimDocuments.length = 0;
  claimDisputes.length = 0;
}
