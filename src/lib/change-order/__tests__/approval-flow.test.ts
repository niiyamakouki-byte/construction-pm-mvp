/**
 * approval-flow unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  markEstimatingComplete,
  recordOwnerApproval,
  recordSupervisorApproval,
  recordExecutiveApproval,
  requiredApproverRole,
  computeApprovalCycleDays,
} from "../approval-flow.js";
import { ChangeOrderStore, _resetChangeOrderStore } from "../change-order-store.js";
import type { ChangeOrder } from "../types.js";
import { makeChangeOrderId } from "../types.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

// ── Helpers ────────────────────────────────────────────────────────────────

let storeInstance: ChangeOrderStore;

beforeEach(() => {
  localStorage.clear();
  _resetChangeOrderStore();
  storeInstance = new ChangeOrderStore();
});

function seedOrder(overrides: Partial<ChangeOrder> = {}): ChangeOrder {
  const co: ChangeOrder = {
    id: makeChangeOrderId("co-test"),
    projectId: "proj-001",
    kind: "modification",
    status: "estimating",
    descriptionJa: "壁仕上げ変更",
    requestedBy: "田中様",
    requestedAt: "2026-05-01T00:00:00Z",
    approvalRecords: [],
    ...overrides,
  };
  storeInstance.save(co);
  return co;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("markEstimatingComplete", () => {
  it("estimating → ownerApproval に遷移する", () => {
    seedOrder({ status: "estimating" });
    const updated = markEstimatingComplete("co-test");
    expect(updated?.status).toBe("ownerApproval");
  });

  it("estimating 以外では null を返す", () => {
    seedOrder({ status: "requested" });
    expect(markEstimatingComplete("co-test")).toBeNull();
  });

  it("存在しない ID では null を返す", () => {
    expect(markEstimatingComplete("nonexistent")).toBeNull();
  });
});

describe("recordOwnerApproval", () => {
  it("ownerApproval → supervisorApproval に遷移する (承認)", () => {
    seedOrder({ status: "ownerApproval" });
    const updated = recordOwnerApproval("co-test", "田中様", "approved");
    expect(updated?.status).toBe("supervisorApproval");
    expect(updated?.approvalRecords).toHaveLength(1);
    expect(updated?.approvalRecords[0].role).toBe("owner");
    expect(updated?.approvalRecords[0].decision).toBe("approved");
  });

  it("却下すると rejected に遷移する", () => {
    seedOrder({ status: "ownerApproval" });
    const updated = recordOwnerApproval("co-test", "田中様", "rejected", "予算超過");
    expect(updated?.status).toBe("rejected");
    expect(updated?.approvalRecords[0].comment).toBe("予算超過");
    expect(updated?.rejectedAt).toBeDefined();
  });

  it("ownerApproval 以外では null を返す", () => {
    seedOrder({ status: "supervisorApproval" });
    expect(recordOwnerApproval("co-test", "田中様", "approved")).toBeNull();
  });
});

describe("recordSupervisorApproval", () => {
  it("supervisorApproval → executiveApproval に遷移する", () => {
    seedOrder({ status: "supervisorApproval" });
    const updated = recordSupervisorApproval("co-test", "新山", "approved");
    expect(updated?.status).toBe("executiveApproval");
    expect(updated?.approvalRecords[0].role).toBe("supervisor");
  });

  it("supervisorApproval 以外では null を返す", () => {
    seedOrder({ status: "ownerApproval" });
    expect(recordSupervisorApproval("co-test", "新山", "approved")).toBeNull();
  });
});

describe("recordExecutiveApproval", () => {
  it("executiveApproval → approved に遷移する", () => {
    const now = new Date("2026-05-09T10:00:00Z");
    seedOrder({ status: "executiveApproval" });
    const updated = recordExecutiveApproval("co-test", "社長", "approved", undefined, now);
    expect(updated?.status).toBe("approved");
    expect(updated?.approvedAt).toBeDefined();
    expect(updated?.approvalRecords[0].role).toBe("executive");
  });

  it("却下すると rejected になる", () => {
    seedOrder({ status: "executiveApproval" });
    const updated = recordExecutiveApproval("co-test", "社長", "rejected");
    expect(updated?.status).toBe("rejected");
    expect(updated?.rejectedAt).toBeDefined();
  });

  it("executiveApproval 以外では null を返す", () => {
    seedOrder({ status: "supervisorApproval" });
    expect(recordExecutiveApproval("co-test", "社長", "approved")).toBeNull();
  });
});

describe("requiredApproverRole", () => {
  it("ownerApproval → owner", () => {
    const co = seedOrder({ status: "ownerApproval" });
    expect(requiredApproverRole(co)).toBe("owner");
  });

  it("supervisorApproval → supervisor", () => {
    const co = seedOrder({ status: "supervisorApproval" });
    expect(requiredApproverRole(co)).toBe("supervisor");
  });

  it("executiveApproval → executive", () => {
    const co = seedOrder({ status: "executiveApproval" });
    expect(requiredApproverRole(co)).toBe("executive");
  });

  it("approved → null", () => {
    const co = seedOrder({ status: "approved" });
    expect(requiredApproverRole(co)).toBeNull();
  });

  it("requested → null", () => {
    const co = seedOrder({ status: "requested" });
    expect(requiredApproverRole(co)).toBeNull();
  });
});

describe("computeApprovalCycleDays", () => {
  it("承認済みの場合は日数を返す", () => {
    const co = seedOrder({
      status: "approved",
      requestedAt: "2026-05-01T00:00:00Z",
      approvedAt: "2026-05-06T00:00:00Z",
    });
    expect(computeApprovalCycleDays(co)).toBe(5);
  });

  it("未承認の場合は null を返す", () => {
    const co = seedOrder({ status: "ownerApproval" });
    expect(computeApprovalCycleDays(co)).toBeNull();
  });

  it("当日承認の場合は 0 を返す", () => {
    const now = "2026-05-09T00:00:00Z";
    const co = seedOrder({
      status: "approved",
      requestedAt: now,
      approvedAt: now,
    });
    expect(computeApprovalCycleDays(co)).toBe(0);
  });
});

describe("フル承認フロー", () => {
  it("estimating → ownerApproval → supervisorApproval → executiveApproval → approved", () => {
    seedOrder({ status: "estimating" });

    const afterEst = markEstimatingComplete("co-test");
    expect(afterEst?.status).toBe("ownerApproval");

    const afterOwner = recordOwnerApproval("co-test", "田中様", "approved");
    expect(afterOwner?.status).toBe("supervisorApproval");

    const afterSup = recordSupervisorApproval("co-test", "新山", "approved");
    expect(afterSup?.status).toBe("executiveApproval");

    const afterExec = recordExecutiveApproval("co-test", "社長", "approved");
    expect(afterExec?.status).toBe("approved");
    expect(afterExec?.approvalRecords).toHaveLength(3);
    expect(afterExec?.approvedAt).toBeDefined();
  });
});
