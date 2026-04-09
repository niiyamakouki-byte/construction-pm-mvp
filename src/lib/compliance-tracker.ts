/**
 * Compliance tracking: regulatory deadlines, document management,
 * and audit trail for construction projects.
 */

export type ComplianceStatus = "compliant" | "warning" | "overdue" | "not_applicable";

export type ComplianceRequirement = {
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

export type ComplianceSummary = {
  projectId: string;
  totalRequirements: number;
  compliant: number;
  warning: number;
  overdue: number;
  complianceRate: number;
  upcomingDeadlines: ComplianceRequirement[];
  overdueItems: ComplianceRequirement[];
};

export type AuditEntry = {
  id: string;
  requirementId: string;
  action: string;
  performedBy: string;
  timestamp: string;
  details: string;
};

// ── Storage ────────────────────────────────────────

const requirements: ComplianceRequirement[] = [];
const auditLog: AuditEntry[] = [];

// ── CRUD ───────────────────────────────────────────

export function addRequirement(req: ComplianceRequirement): ComplianceRequirement {
  requirements.push(req);
  _audit(req.id, "created", "system", `Requirement '${req.name}' added`);
  return req;
}

export function updateRequirementStatus(
  id: string,
  status: ComplianceStatus,
  updatedBy: string,
  completedDate?: string,
): ComplianceRequirement | null {
  const req = requirements.find((r) => r.id === id);
  if (!req) return null;

  const oldStatus = req.status;
  req.status = status;
  if (completedDate) req.completedDate = completedDate;
  _audit(id, "status_update", updatedBy, `${oldStatus} → ${status}`);
  return req;
}

export function getRequirements(projectId: string): ComplianceRequirement[] {
  return requirements.filter((r) => r.projectId === projectId);
}

// ── Status evaluation ──────────────────────────────

export function evaluateStatus(
  req: ComplianceRequirement,
  today?: string,
): ComplianceStatus {
  if (req.status === "not_applicable") return "not_applicable";
  if (req.completedDate) return "compliant";

  const now = today ? new Date(today) : new Date();
  const due = new Date(req.dueDate);
  const daysUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= 14) return "warning";
  return "compliant";
}

export function refreshAllStatuses(projectId: string, today?: string): void {
  const reqs = getRequirements(projectId);
  for (const req of reqs) {
    const newStatus = evaluateStatus(req, today);
    if (newStatus !== req.status) {
      req.status = newStatus;
    }
  }
}

// ── Summary ────────────────────────────────────────

export function getComplianceSummary(
  projectId: string,
  today?: string,
): ComplianceSummary {
  refreshAllStatuses(projectId, today);
  const reqs = getRequirements(projectId);
  const applicable = reqs.filter((r) => r.status !== "not_applicable");

  const compliant = applicable.filter((r) => r.status === "compliant").length;
  const warning = applicable.filter((r) => r.status === "warning").length;
  const overdue = applicable.filter((r) => r.status === "overdue").length;
  const total = applicable.length;
  const rate = total > 0 ? Math.round((compliant / total) * 100) : 100;

  const now = today ? new Date(today) : new Date();
  const thirtyDaysLater = new Date(now);
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

  const upcoming = reqs
    .filter(
      (r) =>
        r.status !== "not_applicable" &&
        !r.completedDate &&
        new Date(r.dueDate) <= thirtyDaysLater,
    )
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return {
    projectId,
    totalRequirements: total,
    compliant,
    warning,
    overdue,
    complianceRate: rate,
    upcomingDeadlines: upcoming,
    overdueItems: reqs.filter((r) => r.status === "overdue"),
  };
}

// ── Audit trail ────────────────────────────────────

function _audit(reqId: string, action: string, by: string, details: string): void {
  auditLog.push({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    requirementId: reqId,
    action,
    performedBy: by,
    timestamp: new Date().toISOString(),
    details,
  });
}

export function getAuditLog(requirementId?: string): AuditEntry[] {
  if (requirementId) {
    return auditLog.filter((a) => a.requirementId === requirementId);
  }
  return [...auditLog];
}

// ── Reset (for testing) ────────────────────────────

export function _resetComplianceStore(): void {
  requirements.length = 0;
  auditLog.length = 0;
}
