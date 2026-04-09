import { beforeEach, describe, expect, it } from "vitest";
import {
  type ClaimDispute,
  type ClaimDocument,
  type InsuranceClaim,
  _resetClaimStore,
  addClaimDocument,
  calculateClaimImpact,
  createClaim,
  getClaimDisputes,
  getClaimDocuments,
  getClaims,
  openClaimDispute,
  resolveDispute,
  updateClaimStatus,
} from "./claim-manager.js";

beforeEach(() => {
  _resetClaimStore();
});

function makeClaim(overrides: Partial<InsuranceClaim> = {}): InsuranceClaim {
  return {
    id: "claim-1",
    projectId: "proj-1",
    claimType: "Water Damage",
    incidentDate: "2025-04-01",
    description: "Pipe burst damaged interior finishes.",
    claimedAmount: 500000,
    status: "open",
    openedBy: "PM-1",
    ...overrides,
  };
}

function makeDocument(
  overrides: Partial<ClaimDocument> = {},
): ClaimDocument {
  return {
    id: "doc-1",
    claimId: "claim-1",
    projectId: "proj-1",
    fileName: "damage-photo.jpg",
    documentType: "photo",
    uploadedAt: "2025-04-02T09:00:00.000Z",
    uploadedBy: "PM-1",
    ...overrides,
  };
}

function makeDispute(
  overrides: Partial<ClaimDispute> = {},
): ClaimDispute {
  return {
    id: "disp-1",
    claimId: "claim-1",
    projectId: "proj-1",
    reason: "Coverage excludes only part of the damage scope.",
    disputedAmount: 120000,
    openedDate: "2025-04-10",
    status: "open",
    ...overrides,
  };
}

describe("claim-manager", () => {
  it("creates and lists insurance claims", () => {
    const claim = createClaim(makeClaim());

    expect(claim.id).toBe("claim-1");
    expect(getClaims("proj-1")).toHaveLength(1);
  });

  it("attaches claim documents for existing claims", () => {
    createClaim(makeClaim());

    const document = addClaimDocument(makeDocument());

    expect(document?.fileName).toBe("damage-photo.jpg");
    expect(getClaimDocuments("claim-1")).toHaveLength(1);
  });

  it("rejects documents for unknown claims", () => {
    expect(addClaimDocument(makeDocument())).toBeNull();
  });

  it("opens disputes and updates the parent claim status", () => {
    createClaim(makeClaim({ status: "under_review" }));

    const dispute = openClaimDispute(makeDispute());

    expect(dispute?.id).toBe("disp-1");
    expect(getClaimDisputes("proj-1")).toHaveLength(1);
    expect(getClaims("proj-1")[0].status).toBe("disputed");
  });

  it("updates claim resolution details", () => {
    createClaim(makeClaim());

    const claim = updateClaimStatus("claim-1", "approved", {
      approvedAmount: 420000,
      resolutionDate: "2025-04-20",
    });

    expect(claim?.approvedAmount).toBe(420000);
    expect(claim?.resolutionDate).toBe("2025-04-20");
  });

  it("resolves disputes", () => {
    createClaim(makeClaim());
    openClaimDispute(makeDispute());

    const dispute = resolveDispute("disp-1", "2025-04-18", "Carrier accepted revised scope.");

    expect(dispute?.status).toBe("resolved");
    expect(dispute?.outcome).toContain("accepted");
  });

  it("calculates project claim impact", () => {
    createClaim(makeClaim({ claimedAmount: 500000, approvedAmount: 300000, status: "approved" }));
    createClaim(makeClaim({ id: "claim-2", claimedAmount: 200000, status: "under_review" }));
    openClaimDispute(
      makeDispute({
        id: "disp-2",
        claimId: "claim-2",
        disputedAmount: 80000,
      }),
    );

    const summary = calculateClaimImpact("proj-1");

    expect(summary.totalClaims).toBe(2);
    expect(summary.totalClaimedAmount).toBe(700000);
    expect(summary.totalApprovedAmount).toBe(300000);
    expect(summary.totalDisputedAmount).toBe(80000);
    expect(summary.netImpact).toBe(400000);
  });

  it("returns zeroed impact for unknown projects", () => {
    const summary = calculateClaimImpact("unknown");

    expect(summary.totalClaims).toBe(0);
    expect(summary.netImpact).toBe(0);
  });
});
