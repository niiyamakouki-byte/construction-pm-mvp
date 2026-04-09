/**
 * Permit application, approval, inspection scheduling, and expiry alerts.
 */

export type PermitStatus =
  | "applied"
  | "approved"
  | "inspection_scheduled"
  | "expired"
  | "closed";

export type PermitInspectionStatus =
  | "scheduled"
  | "passed"
  | "failed"
  | "cancelled";

export type PermitApplication = {
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

export type PermitInspection = {
  id: string;
  permitId: string;
  projectId: string;
  inspectionType: string;
  scheduledDate: string;
  status: PermitInspectionStatus;
  inspectorName?: string;
  notes?: string;
};

export type PermitExpiryAlert = {
  permitId: string;
  permitType: string;
  expiryDate: string;
  daysUntilExpiry: number;
  severity: "info" | "warning" | "critical" | "expired";
};

const permits: PermitApplication[] = [];
const inspections: PermitInspection[] = [];

export function createPermitApplication(
  permit: PermitApplication,
): PermitApplication {
  permits.push({ ...permit });
  return permit;
}

export function approvePermit(
  permitId: string,
  approvalDate: string,
  permitNumber: string,
  expiryDate?: string,
): PermitApplication | null {
  const permit = permits.find((entry) => entry.id === permitId);
  if (!permit) return null;

  permit.status = "approved";
  permit.approvalDate = approvalDate;
  permit.permitNumber = permitNumber;
  if (expiryDate) {
    permit.expiryDate = expiryDate;
  }

  return permit;
}

export function schedulePermitInspection(
  inspection: PermitInspection,
): PermitInspection | null {
  const permit = permits.find((entry) => entry.id === inspection.permitId);
  if (!permit) return null;

  inspections.push({ ...inspection });
  if (permit.status !== "expired" && permit.status !== "closed") {
    permit.status = "inspection_scheduled";
  }

  return inspection;
}

export function getPermits(projectId: string): PermitApplication[] {
  return permits.filter((permit) => permit.projectId === projectId);
}

export function getPermitInspections(
  projectId: string,
  permitId?: string,
): PermitInspection[] {
  return inspections.filter(
    (inspection) =>
      inspection.projectId === projectId &&
      (!permitId || inspection.permitId === permitId),
  );
}

export function getPermitExpiryAlerts(
  projectId: string,
  referenceDate: string,
  daysAhead = 30,
): PermitExpiryAlert[] {
  const alerts = getPermits(projectId)
    .filter((permit) => permit.expiryDate)
    .map((permit) => {
      const daysUntilExpiry = getDayDifference(referenceDate, permit.expiryDate!);
      if (daysUntilExpiry < 0) {
        permit.status = "expired";
      }

      return {
        permitId: permit.id,
        permitType: permit.permitType,
        expiryDate: permit.expiryDate!,
        daysUntilExpiry,
        severity: getAlertSeverity(daysUntilExpiry),
      };
    })
    .filter((alert) => alert.daysUntilExpiry <= daysAhead)
    .sort((left, right) => left.daysUntilExpiry - right.daysUntilExpiry);

  return alerts;
}

function getAlertSeverity(
  daysUntilExpiry: number,
): PermitExpiryAlert["severity"] {
  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry <= 7) return "critical";
  if (daysUntilExpiry <= 14) return "warning";
  return "info";
}

function getDayDifference(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00.000Z`);
  const to = new Date(`${toDate}T00:00:00.000Z`);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

export function _resetPermitStore(): void {
  permits.length = 0;
  inspections.length = 0;
}
