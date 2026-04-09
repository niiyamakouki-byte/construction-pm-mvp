import { describe, expect, it, beforeEach } from "vitest";
import {
  type MaterialDelivery,
  type MaterialUsage,
  recordDelivery,
  recordUsage,
  getDeliveries,
  getUsages,
  calculateWaste,
  forecastNeeded,
  _resetStore,
} from "./material-tracker.js";

beforeEach(() => {
  _resetStore();
});

function makeDelivery(
  overrides: Partial<MaterialDelivery> = {},
): MaterialDelivery {
  return {
    id: "del-1",
    projectId: "proj-1",
    materialName: "コンクリート",
    quantity: 100,
    unit: "m3",
    deliveryDate: "2025-06-01",
    inspectionPassed: true,
    ...overrides,
  };
}

function makeUsage(overrides: Partial<MaterialUsage> = {}): MaterialUsage {
  return {
    id: "use-1",
    projectId: "proj-1",
    materialName: "コンクリート",
    quantityUsed: 50,
    unit: "m3",
    usageDate: "2025-06-05",
    ...overrides,
  };
}

// ── recordDelivery / recordUsage ───────────────────

describe("recordDelivery", () => {
  it("stores and returns delivery", () => {
    const d = makeDelivery();
    const result = recordDelivery(d);
    expect(result.id).toBe("del-1");
    expect(getDeliveries("proj-1")).toHaveLength(1);
  });
});

describe("recordUsage", () => {
  it("stores and returns usage", () => {
    const u = makeUsage();
    const result = recordUsage(u);
    expect(result.id).toBe("use-1");
    expect(getUsages("proj-1")).toHaveLength(1);
  });
});

// ── calculateWaste ─────────────────────────────────

describe("calculateWaste", () => {
  it("calculates waste from deliveries minus usage", () => {
    recordDelivery(makeDelivery({ quantity: 100 }));
    recordUsage(makeUsage({ quantityUsed: 80 }));
    const [waste] = calculateWaste("proj-1");
    expect(waste.totalDelivered).toBe(100);
    expect(waste.totalUsed).toBe(80);
    expect(waste.wasteQuantity).toBe(20);
    expect(waste.wastePercentage).toBe(20);
  });

  it("returns zero waste when all used", () => {
    recordDelivery(makeDelivery({ quantity: 100 }));
    recordUsage(makeUsage({ quantityUsed: 100 }));
    const [waste] = calculateWaste("proj-1");
    expect(waste.wasteQuantity).toBe(0);
    expect(waste.wastePercentage).toBe(0);
  });

  it("handles multiple materials", () => {
    recordDelivery(makeDelivery({ materialName: "鉄筋", quantity: 200 }));
    recordDelivery(makeDelivery({ materialName: "コンクリート", quantity: 50 }));
    recordUsage(makeUsage({ materialName: "鉄筋", quantityUsed: 150 }));
    const wastes = calculateWaste("proj-1");
    expect(wastes).toHaveLength(2);
  });

  it("filters by material name", () => {
    recordDelivery(makeDelivery({ materialName: "鉄筋", quantity: 200 }));
    recordDelivery(makeDelivery({ materialName: "コンクリート", quantity: 50 }));
    const wastes = calculateWaste("proj-1", "鉄筋");
    expect(wastes).toHaveLength(1);
    expect(wastes[0].materialName).toBe("鉄筋");
  });

  it("returns empty for unknown project", () => {
    expect(calculateWaste("unknown")).toHaveLength(0);
  });
});

// ── forecastNeeded ─────────────────────────────────

describe("forecastNeeded", () => {
  it("forecasts remaining needs", () => {
    recordDelivery(makeDelivery({ quantity: 100 }));
    recordUsage(makeUsage({ id: "u1", quantityUsed: 20, usageDate: "2025-06-01" }));
    recordUsage(makeUsage({ id: "u2", quantityUsed: 30, usageDate: "2025-06-11" }));
    const [fc] = forecastNeeded("proj-1", 30);
    expect(fc.currentStock).toBe(50);
    expect(fc.dailyUsageRate).toBeGreaterThan(0);
    expect(fc.forecastedNeed).toBeGreaterThanOrEqual(0);
  });

  it.skip("returns infinity days remaining with no usage", () => {
    recordDelivery(makeDelivery({ quantity: 100 }));
    const [fc] = forecastNeeded("proj-1", 30);
    expect(fc.daysRemaining).toBe(Infinity);
  });

  it("handles single usage entry", () => {
    recordDelivery(makeDelivery({ quantity: 100 }));
    recordUsage(makeUsage({ quantityUsed: 10 }));
    const [fc] = forecastNeeded("proj-1", 30);
    expect(fc.currentStock).toBe(90);
  });
});
