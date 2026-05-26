/**
 * portfolio-change-order-metrics unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  pendingChangeOrders,
  avgApprovalCycleDays,
  costDeltaTotalJpy,
  mostFrequentChangeKind,
} from "../portfolio-change-order-metrics.js";
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

let s: ChangeOrderStore;

beforeEach(() => {
  localStorage.clear();
  _resetChangeOrderStore();
  s = new ChangeOrderStore();
});

function makeOrder(id: string, overrides: Partial<ChangeOrder> = {}): ChangeOrder {
  return {
    id: makeChangeOrderId(id),
    projectId: "proj-001",
    kind: "modification",
    status: "requested",
    descriptionJa: "変更",
    requestedBy: "田中様",
    requestedAt: "2026-05-01T00:00:00Z",
    approvalRecords: [],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("pendingChangeOrders", () => {
  it("空の場合は 0 を返す", () => {
    expect(pendingChangeOrders()).toBe(0);
  });

  it("approved / rejected 以外はすべてカウントされる", () => {
    s.save(makeOrder("co-1", { status: "requested" }));
    s.save(makeOrder("co-2", { status: "estimating" }));
    s.save(makeOrder("co-3", { status: "ownerApproval" }));
    s.save(makeOrder("co-4", { status: "supervisorApproval" }));
    s.save(makeOrder("co-5", { status: "executiveApproval" }));
    s.save(makeOrder("co-6", { status: "approved" }));
    s.save(makeOrder("co-7", { status: "rejected" }));
    expect(pendingChangeOrders()).toBe(5);
  });
});

describe("avgApprovalCycleDays", () => {
  it("空の場合は 0 を返す", () => {
    expect(avgApprovalCycleDays()).toBe(0);
  });

  it("承認済みの平均サイクル日数を返す", () => {
    s.save(makeOrder("co-1", {
      status: "approved",
      requestedAt: "2026-05-01T00:00:00Z",
      approvedAt: "2026-05-06T00:00:00Z",
    }));
    s.save(makeOrder("co-2", {
      status: "approved",
      requestedAt: "2026-05-01T00:00:00Z",
      approvedAt: "2026-05-11T00:00:00Z",
    }));
    // (5 + 10) / 2 = 7.5
    expect(avgApprovalCycleDays()).toBe(7.5);
  });

  it("未承認のみの場合は 0 を返す", () => {
    s.save(makeOrder("co-1", { status: "requested" }));
    expect(avgApprovalCycleDays()).toBe(0);
  });
});

describe("costDeltaTotalJpy", () => {
  it("空の場合は 0 を返す", () => {
    expect(costDeltaTotalJpy()).toBe(0);
  });

  it("影響分析のある変更指示の金額差分を合計する", () => {
    s.save(makeOrder("co-1", {
      impactAnalysis: {
        costDeltaJpy: 100_000,
        scheduleDeltaDays: 1,
        affectedTrades: [],
        dependencyChain: [],
        costIncreaseRatioPct: 5,
      },
    }));
    s.save(makeOrder("co-2", {
      impactAnalysis: {
        costDeltaJpy: 200_000,
        scheduleDeltaDays: 2,
        affectedTrades: [],
        dependencyChain: [],
        costIncreaseRatioPct: 10,
      },
    }));
    s.save(makeOrder("co-3")); // no impactAnalysis
    expect(costDeltaTotalJpy()).toBe(300_000);
  });

  it("減額を含む合計を計算する", () => {
    s.save(makeOrder("co-1", {
      impactAnalysis: {
        costDeltaJpy: 100_000,
        scheduleDeltaDays: 1,
        affectedTrades: [],
        dependencyChain: [],
        costIncreaseRatioPct: 5,
      },
    }));
    s.save(makeOrder("co-2", {
      impactAnalysis: {
        costDeltaJpy: -50_000,
        scheduleDeltaDays: -1,
        affectedTrades: [],
        dependencyChain: [],
        costIncreaseRatioPct: 0,
      },
    }));
    expect(costDeltaTotalJpy()).toBe(50_000);
  });
});

describe("mostFrequentChangeKind", () => {
  it("空の場合は null を返す", () => {
    expect(mostFrequentChangeKind()).toBeNull();
  });

  it("最も多い種別を返す", () => {
    s.save(makeOrder("co-1", { kind: "addition" }));
    s.save(makeOrder("co-2", { kind: "addition" }));
    s.save(makeOrder("co-3", { kind: "modification" }));
    expect(mostFrequentChangeKind()).toBe("addition");
  });

  it("全件が同じ種別の場合はその種別を返す", () => {
    s.save(makeOrder("co-1", { kind: "deletion" }));
    s.save(makeOrder("co-2", { kind: "deletion" }));
    expect(mostFrequentChangeKind()).toBe("deletion");
  });

  it("scheduleShift が最多の場合", () => {
    s.save(makeOrder("co-1", { kind: "scheduleShift" }));
    s.save(makeOrder("co-2", { kind: "scheduleShift" }));
    s.save(makeOrder("co-3", { kind: "scheduleShift" }));
    s.save(makeOrder("co-4", { kind: "materialUpgrade" }));
    expect(mostFrequentChangeKind()).toBe("scheduleShift");
  });
});
