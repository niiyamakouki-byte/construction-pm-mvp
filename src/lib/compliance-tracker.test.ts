import { describe, expect, it, beforeEach } from "vitest";
import {
  type ComplianceRequirement,
  addRequirement,
  updateRequirementStatus,
  getRequirements,
  evaluateStatus,
  getComplianceSummary,
  getAuditLog,
  _resetComplianceStore,
} from "./compliance-tracker.js";

beforeEach(() => {
  _resetComplianceStore();
});

function makeReq(
  overrides: Partial<ComplianceRequirement> = {},
): ComplianceRequirement {
  return {
    id: "req-1",
    projectId: "proj-1",
    name: "建築確認申請",
    category: "許認可",
    description: "建築確認申請の提出",
    dueDate: "2025-12-01",
    status: "compliant",
    ...overrides,
  };
}

// ── CRUD ───────────────────────────────────────────

describe("addRequirement", () => {
  it("stores and returns requirement", () => {
    const req = addRequirement(makeReq());
    expect(req.id).toBe("req-1");
    expect(getRequirements("proj-1")).toHaveLength(1);
  });

  it("creates audit entry", () => {
    addRequirement(makeReq());
    const log = getAuditLog("req-1");
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].action).toBe("created");
  });
});

describe("updateRequirementStatus", () => {
  it("updates status", () => {
    addRequirement(makeReq());
    const updated = updateRequirementStatus("req-1", "overdue", "admin");
    expect(updated?.status).toBe("overdue");
  });

  it("returns null for unknown id", () => {
    const result = updateRequirementStatus("unknown", "compliant", "admin");
    expect(result).toBeNull();
  });

  it("records status change in audit", () => {
    addRequirement(makeReq());
    updateRequirementStatus("req-1", "overdue", "admin");
    const log = getAuditLog("req-1");
    expect(log.some((e) => e.action === "status_update")).toBe(true);
  });
});

// ── Status evaluation ──────────────────────────────

describe("evaluateStatus", () => {
  it("returns compliant when completed", () => {
    const req = makeReq({ completedDate: "2025-06-01" });
    expect(evaluateStatus(req)).toBe("compliant");
  });

  it("returns overdue when past due", () => {
    const req = makeReq({ dueDate: "2020-01-01", completedDate: undefined });
    expect(evaluateStatus(req, "2025-01-01")).toBe("overdue");
  });

  it("returns warning within 14 days", () => {
    const req = makeReq({ dueDate: "2025-07-10", completedDate: undefined });
    expect(evaluateStatus(req, "2025-07-01")).toBe("warning");
  });

  it("returns compliant when far from due", () => {
    const req = makeReq({ dueDate: "2025-12-01", completedDate: undefined });
    expect(evaluateStatus(req, "2025-06-01")).toBe("compliant");
  });

  it("returns not_applicable unchanged", () => {
    const req = makeReq({ status: "not_applicable" });
    expect(evaluateStatus(req)).toBe("not_applicable");
  });
});

// ── Summary ────────────────────────────────────────

describe("getComplianceSummary", () => {
  it("returns summary with all counts", () => {
    addRequirement(makeReq({ id: "r1", dueDate: "2026-12-01" }));
    addRequirement(
      makeReq({
        id: "r2",
        dueDate: "2020-01-01",
      }),
    );
    const summary = getComplianceSummary("proj-1", "2025-06-01");
    expect(summary.totalRequirements).toBe(2);
    expect(summary.compliant).toBe(1);
    expect(summary.overdue).toBe(1);
    expect(summary.overdueItems).toHaveLength(1);
  });

  it("returns 100% when no requirements", () => {
    const summary = getComplianceSummary("empty-proj");
    expect(summary.complianceRate).toBe(100);
  });

  it("lists upcoming deadlines", () => {
    addRequirement(makeReq({ id: "r1", dueDate: "2025-06-15" }));
    const summary = getComplianceSummary("proj-1", "2025-06-01");
    expect(summary.upcomingDeadlines.length).toBeGreaterThan(0);
  });
});

// ── Audit log ──────────────────────────────────────

describe("getAuditLog", () => {
  it("returns all entries without filter", () => {
    addRequirement(makeReq({ id: "r1" }));
    addRequirement(makeReq({ id: "r2" }));
    const log = getAuditLog();
    expect(log.length).toBe(2);
  });

  it("filters by requirement id", () => {
    addRequirement(makeReq({ id: "r1" }));
    addRequirement(makeReq({ id: "r2" }));
    const log = getAuditLog("r1");
    expect(log.length).toBe(1);
    expect(log[0].requirementId).toBe("r1");
  });
});
