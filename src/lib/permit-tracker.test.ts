import { beforeEach, describe, expect, it } from "vitest";
import {
  type PermitApplication,
  type PermitInspection,
  _resetPermitStore,
  approvePermit,
  createPermitApplication,
  getPermitExpiryAlerts,
  getPermitInspections,
  getPermits,
  schedulePermitInspection,
} from "./permit-tracker.js";

beforeEach(() => {
  _resetPermitStore();
});

function makePermit(
  overrides: Partial<PermitApplication> = {},
): PermitApplication {
  return {
    id: "permit-1",
    projectId: "proj-1",
    permitType: "Building Permit",
    jurisdiction: "City Hall",
    applicationDate: "2025-04-01",
    applicantName: "A. Sato",
    status: "applied",
    ...overrides,
  };
}

function makeInspection(
  overrides: Partial<PermitInspection> = {},
): PermitInspection {
  return {
    id: "insp-1",
    permitId: "permit-1",
    projectId: "proj-1",
    inspectionType: "Foundation Inspection",
    scheduledDate: "2025-04-20",
    status: "scheduled",
    ...overrides,
  };
}

describe("permit-tracker", () => {
  it("stores submitted permit applications", () => {
    const permit = makePermit();
    const result = createPermitApplication(permit);

    expect(result.id).toBe("permit-1");
    expect(getPermits("proj-1")).toHaveLength(1);
  });

  it("approves a permit and records approval metadata", () => {
    createPermitApplication(makePermit());

    const updated = approvePermit(
      "permit-1",
      "2025-04-10",
      "BP-2025-001",
      "2025-10-10",
    );

    expect(updated?.status).toBe("approved");
    expect(updated?.permitNumber).toBe("BP-2025-001");
    expect(updated?.expiryDate).toBe("2025-10-10");
  });

  it("returns null when approving an unknown permit", () => {
    expect(approvePermit("missing", "2025-04-10", "BP-1")).toBeNull();
  });

  it("schedules inspections for known permits", () => {
    createPermitApplication(makePermit({ status: "approved" }));

    const inspection = schedulePermitInspection(makeInspection());

    expect(inspection?.id).toBe("insp-1");
    expect(getPermitInspections("proj-1", "permit-1")).toHaveLength(1);
    expect(getPermits("proj-1")[0].status).toBe("inspection_scheduled");
  });

  it("rejects inspection scheduling when the permit does not exist", () => {
    expect(schedulePermitInspection(makeInspection())).toBeNull();
  });

  it("generates expiry alerts with severity levels", () => {
    createPermitApplication(
      makePermit({
        id: "permit-info",
        expiryDate: "2025-05-25",
        status: "approved",
      }),
    );
    createPermitApplication(
      makePermit({
        id: "permit-critical",
        expiryDate: "2025-05-05",
        status: "approved",
      }),
    );

    const alerts = getPermitExpiryAlerts("proj-1", "2025-05-01");

    expect(alerts).toHaveLength(2);
    expect(alerts[0].permitId).toBe("permit-critical");
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[1].severity).toBe("info");
  });

  it("marks expired permits and includes expired alerts", () => {
    createPermitApplication(
      makePermit({
        id: "permit-expired",
        expiryDate: "2025-04-15",
        status: "approved",
      }),
    );

    const alerts = getPermitExpiryAlerts("proj-1", "2025-05-01");

    expect(alerts[0].severity).toBe("expired");
    expect(alerts[0].daysUntilExpiry).toBeLessThan(0);
    expect(getPermits("proj-1")[0].status).toBe("expired");
  });

  it("filters alerts by the provided lookahead window", () => {
    createPermitApplication(
      makePermit({
        id: "permit-late",
        expiryDate: "2025-07-10",
        status: "approved",
      }),
    );

    expect(getPermitExpiryAlerts("proj-1", "2025-05-01", 30)).toEqual([]);
  });
});
