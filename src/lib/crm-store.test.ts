import { describe, it, expect, beforeEach } from "vitest";
import {
  addCustomer,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  getAllCustomers,
  searchCustomers,
  addDeal,
  getDeal,
  updateDeal,
  deleteDeal,
  getAllDeals,
  getDealsByCustomer,
  getDealsByStage,
  changeStage,
  getPipelineSummary,
  getCRMStats,
  getStageOrder,
  _resetCRMStore,
  type Customer,
  type Deal,
} from "./crm-store.js";

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "c1",
    name: "田中 太郎",
    company: "田中建設",
    phone: "03-1234-5678",
    email: "tanaka@example.com",
    address: "東京都港区",
    note: "",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeDeal(overrides: Partial<Deal> = {}): Deal {
  const now = new Date().toISOString();
  return {
    id: "d1",
    customerId: "c1",
    projectName: "南青山内装工事",
    stage: "引合",
    estimatedAmount: 5000000,
    actualAmount: null,
    probability: 20,
    expectedCloseDate: "2025-06-30",
    note: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("crm-store: customers", () => {
  beforeEach(() => _resetCRMStore());

  it("adds and retrieves a customer", () => {
    const c = makeCustomer();
    addCustomer(c);
    expect(getCustomer("c1")).toEqual(c);
  });

  it("returns undefined for unknown customer", () => {
    expect(getCustomer("nope")).toBeUndefined();
  });

  it("updates a customer", () => {
    addCustomer(makeCustomer());
    const updated = updateCustomer("c1", { company: "新会社" });
    expect(updated?.company).toBe("新会社");
    expect(getCustomer("c1")?.company).toBe("新会社");
  });

  it("returns null when updating unknown customer", () => {
    expect(updateCustomer("nope", { name: "X" })).toBeNull();
  });

  it("deletes a customer", () => {
    addCustomer(makeCustomer());
    expect(deleteCustomer("c1")).toBe(true);
    expect(getCustomer("c1")).toBeUndefined();
  });

  it("returns false when deleting unknown customer", () => {
    expect(deleteCustomer("nope")).toBe(false);
  });

  it("getAllCustomers returns sorted by createdAt", () => {
    addCustomer(makeCustomer({ id: "c1", createdAt: "2025-01-01T00:00:00Z" }));
    addCustomer(makeCustomer({ id: "c2", createdAt: "2025-01-02T00:00:00Z" }));
    const all = getAllCustomers();
    expect(all.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("searchCustomers matches name, company, email, phone", () => {
    addCustomer(makeCustomer({ id: "c1", name: "田中 太郎", company: "ABC" }));
    addCustomer(makeCustomer({ id: "c2", name: "鈴木 花子", company: "XYZ", email: "suzuki@test.jp" }));
    expect(searchCustomers("田中")).toHaveLength(1);
    expect(searchCustomers("xyz")).toHaveLength(1);
    expect(searchCustomers("suzuki")).toHaveLength(1);
    expect(searchCustomers("999")).toHaveLength(0);
  });
});

describe("crm-store: deals", () => {
  beforeEach(() => _resetCRMStore());

  it("adds and retrieves a deal", () => {
    const d = makeDeal();
    addDeal(d);
    expect(getDeal("d1")).toEqual(d);
  });

  it("returns undefined for unknown deal", () => {
    expect(getDeal("nope")).toBeUndefined();
  });

  it("updates a deal and sets updatedAt", () => {
    const d = makeDeal();
    addDeal(d);
    const updated = updateDeal("d1", { projectName: "改修工事" });
    expect(updated?.projectName).toBe("改修工事");
    expect(typeof updated?.updatedAt).toBe("string");
    expect(getDeal("d1")?.projectName).toBe("改修工事");
  });

  it("returns null when updating unknown deal", () => {
    expect(updateDeal("nope", { projectName: "X" })).toBeNull();
  });

  it("deletes a deal", () => {
    addDeal(makeDeal());
    expect(deleteDeal("d1")).toBe(true);
    expect(getDeal("d1")).toBeUndefined();
  });

  it("getDealsByCustomer filters correctly", () => {
    addDeal(makeDeal({ id: "d1", customerId: "c1" }));
    addDeal(makeDeal({ id: "d2", customerId: "c2" }));
    expect(getDealsByCustomer("c1")).toHaveLength(1);
    expect(getDealsByCustomer("c2")).toHaveLength(1);
    expect(getDealsByCustomer("c3")).toHaveLength(0);
  });

  it("getDealsByStage filters correctly", () => {
    addDeal(makeDeal({ id: "d1", stage: "引合" }));
    addDeal(makeDeal({ id: "d2", stage: "受注" }));
    expect(getDealsByStage("引合")).toHaveLength(1);
    expect(getDealsByStage("受注")).toHaveLength(1);
    expect(getDealsByStage("失注")).toHaveLength(0);
  });

  it("changeStage updates stage", () => {
    addDeal(makeDeal({ stage: "引合" }));
    const updated = changeStage("d1", "受注");
    expect(updated?.stage).toBe("受注");
  });
});

describe("crm-store: pipeline aggregation", () => {
  beforeEach(() => _resetCRMStore());

  it("getPipelineSummary returns all stages", () => {
    const summary = getPipelineSummary();
    expect(summary).toHaveLength(6);
    expect(summary.map((s) => s.stage)).toEqual(getStageOrder());
  });

  it("getPipelineSummary aggregates amounts correctly", () => {
    addDeal(makeDeal({ id: "d1", stage: "引合", estimatedAmount: 1000000, probability: 10 }));
    addDeal(makeDeal({ id: "d2", stage: "引合", estimatedAmount: 2000000, probability: 20 }));
    const summary = getPipelineSummary();
    const ひき = summary.find((s) => s.stage === "引合")!;
    expect(ひき.count).toBe(2);
    expect(ひき.totalEstimated).toBe(3000000);
    expect(ひき.weightedAmount).toBeCloseTo(1000000 * 0.1 + 2000000 * 0.2);
  });

  it("getCRMStats calculates win rate", () => {
    addDeal(makeDeal({ id: "d1", stage: "受注" }));
    addDeal(makeDeal({ id: "d2", stage: "受注" }));
    addDeal(makeDeal({ id: "d3", stage: "失注" }));
    const stats = getCRMStats();
    expect(stats.wonDeals).toBe(2);
    expect(stats.lostDeals).toBe(1);
    expect(stats.winRate).toBe(67);
  });

  it("getCRMStats returns zero winRate when no closed deals", () => {
    addDeal(makeDeal({ id: "d1", stage: "引合" }));
    expect(getCRMStats().winRate).toBe(0);
  });

  it("getCRMStats sums totalEstimated and totalActual", () => {
    addDeal(makeDeal({ id: "d1", stage: "受注", estimatedAmount: 3000000, actualAmount: 3200000 }));
    addDeal(makeDeal({ id: "d2", stage: "引合", estimatedAmount: 1000000, actualAmount: null }));
    const stats = getCRMStats();
    expect(stats.totalEstimated).toBe(4000000);
    expect(stats.totalActual).toBe(3200000);
  });
});
