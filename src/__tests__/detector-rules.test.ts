/**
 * Tests for detector-rules — 6 rule functions, 5-7 cases each + boundary values.
 */

import { describe, expect, it } from "vitest";
import {
  detectMaterialSurplus,
  detectShortageEmergency,
  detectLaborOverrun,
  detectOutOfScopeOrder,
  detectPriceCreep,
  detectWastageHigh,
  LABOR_HOURLY_RATE_YEN,
} from "../lib/cost-loss-detector/detector-rules.js";
import { LossKind } from "../lib/cost-loss-detector/types.js";
import type { OrderRecord, LaborRecord } from "../lib/cost-loss-detector/types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: `o-${Math.random().toString(36).slice(2)}`,
    projectId: "p1",
    vendorId: "v1",
    itemCode: "ITEM-001",
    qty: 10,
    unit: "m",
    unitPriceYen: 1000,
    scope: "in_scope",
    orderedAt: "2025-06-01T00:00:00Z",
    ...overrides,
  };
}

function makeLabor(overrides: Partial<LaborRecord> = {}): LaborRecord {
  return {
    id: `l-${Math.random().toString(36).slice(2)}`,
    projectId: "p1",
    workerId: "w1",
    hoursActual: 8,
    hoursPlanned: 8,
    taskId: "t1",
    recordedAt: "2025-06-01T00:00:00Z",
    ...overrides,
  };
}

// ── detectMaterialSurplus ─────────────────────────────────────────────────

describe("detectMaterialSurplus", () => {
  it("plannedQty なし → シグナルなし", () => {
    const orders = [makeOrder({ qty: 20 })];
    expect(detectMaterialSurplus(orders)).toHaveLength(0);
  });

  it("ratio = 1.0 → シグナルなし", () => {
    const orders = [makeOrder({ qty: 10, plannedQty: 10 })];
    expect(detectMaterialSurplus(orders)).toHaveLength(0);
  });

  it("ratio = 1.1 境界値 → シグナルなし (1.1 以下は除外)", () => {
    const orders = [makeOrder({ qty: 11, plannedQty: 10 })];
    expect(detectMaterialSurplus(orders)).toHaveLength(0);
  });

  it("ratio = 1.11 → warning", () => {
    const orders = [makeOrder({ qty: 111, plannedQty: 100 })];
    const sigs = detectMaterialSurplus(orders);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].severity).toBe("warning");
    expect(sigs[0].kind).toBe(LossKind.material_surplus);
  });

  it("ratio = 1.3 境界値 → warning (1.3 以下は warning)", () => {
    const orders = [makeOrder({ qty: 130, plannedQty: 100 })];
    const sigs = detectMaterialSurplus(orders);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].severity).toBe("warning");
  });

  it("ratio > 1.3 → critical", () => {
    const orders = [makeOrder({ qty: 135, plannedQty: 100 })];
    const sigs = detectMaterialSurplus(orders);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].severity).toBe("critical");
  });

  it("lossYen = 超過数量 × 単価", () => {
    const orders = [makeOrder({ qty: 150, plannedQty: 100, unitPriceYen: 2000 })];
    const sigs = detectMaterialSurplus(orders);
    // 超過 50 × 2000 = 100000
    expect(sigs[0].lossYen).toBe(100_000);
  });

  it("複数オーダーで複数シグナル", () => {
    const orders = [
      makeOrder({ id: "o1", qty: 150, plannedQty: 100 }),
      makeOrder({ id: "o2", itemCode: "ITEM-002", qty: 200, plannedQty: 100 }),
    ];
    expect(detectMaterialSurplus(orders)).toHaveLength(2);
  });

  it("plannedQty = 0 → ゼロ除算を回避してシグナルなし", () => {
    const orders = [makeOrder({ qty: 10, plannedQty: 0 })];
    expect(detectMaterialSurplus(orders)).toHaveLength(0);
  });
});

// ── detectShortageEmergency ───────────────────────────────────────────────

describe("detectShortageEmergency", () => {
  it("1件のみ → シグナルなし", () => {
    const orders = [makeOrder()];
    expect(detectShortageEmergency(orders)).toHaveLength(0);
  });

  it("同 itemCode で 31 日超の 2 件 → シグナルなし", () => {
    const orders = [
      makeOrder({ id: "o1", orderedAt: "2025-01-01T00:00:00Z" }),
      makeOrder({ id: "o2", orderedAt: "2025-02-15T00:00:00Z" }),
    ];
    expect(detectShortageEmergency(orders)).toHaveLength(0);
  });

  it("同 itemCode/projectId で 30 日以内の 2 件 → シグナル 1", () => {
    const orders = [
      makeOrder({ id: "o1", orderedAt: "2025-06-01T00:00:00Z" }),
      makeOrder({ id: "o2", orderedAt: "2025-06-20T00:00:00Z" }),
    ];
    const sigs = detectShortageEmergency(orders);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].kind).toBe(LossKind.material_shortage_emergency);
    expect(sigs[0].severity).toBe("warning");
  });

  it("異なる projectId → 別々に評価される", () => {
    const orders = [
      makeOrder({ id: "o1", projectId: "p1", orderedAt: "2025-06-01T00:00:00Z" }),
      makeOrder({ id: "o2", projectId: "p2", orderedAt: "2025-06-15T00:00:00Z" }),
    ];
    // 異なる projectId なのでグループが分かれる
    expect(detectShortageEmergency(orders)).toHaveLength(0);
  });

  it("異なる itemCode → グループが別れてシグナルなし", () => {
    const orders = [
      makeOrder({ id: "o1", itemCode: "A", orderedAt: "2025-06-01T00:00:00Z" }),
      makeOrder({ id: "o2", itemCode: "B", orderedAt: "2025-06-10T00:00:00Z" }),
    ];
    expect(detectShortageEmergency(orders)).toHaveLength(0);
  });

  it("3 件 30 日以内 → シグナル 1 件 (同グループ)", () => {
    const orders = [
      makeOrder({ id: "o1", orderedAt: "2025-06-01T00:00:00Z" }),
      makeOrder({ id: "o2", orderedAt: "2025-06-10T00:00:00Z" }),
      makeOrder({ id: "o3", orderedAt: "2025-06-20T00:00:00Z" }),
    ];
    const sigs = detectShortageEmergency(orders);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].evidenceRefs).toHaveLength(3);
  });

  it("evidenceRefs に全発注 ID が含まれる", () => {
    const orders = [
      makeOrder({ id: "ordA", orderedAt: "2025-06-01T00:00:00Z" }),
      makeOrder({ id: "ordB", orderedAt: "2025-06-15T00:00:00Z" }),
    ];
    const sigs = detectShortageEmergency(orders);
    expect(sigs[0].evidenceRefs).toContain("ordA");
    expect(sigs[0].evidenceRefs).toContain("ordB");
  });
});

// ── detectLaborOverrun ────────────────────────────────────────────────────

describe("detectLaborOverrun", () => {
  it("ratio = 1.0 → シグナルなし", () => {
    const labor = [makeLabor({ hoursActual: 8, hoursPlanned: 8 })];
    expect(detectLaborOverrun(labor)).toHaveLength(0);
  });

  it("ratio = 1.2 境界値 → シグナルなし (1.2 以下)", () => {
    const labor = [makeLabor({ hoursActual: 12, hoursPlanned: 10 })];
    expect(detectLaborOverrun(labor)).toHaveLength(0);
  });

  it("ratio = 1.21 → warning", () => {
    const labor = [makeLabor({ hoursActual: 12.1, hoursPlanned: 10 })];
    const sigs = detectLaborOverrun(labor);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].severity).toBe("warning");
    expect(sigs[0].kind).toBe(LossKind.labor_overrun);
  });

  it("ratio = 1.5 境界値 → warning (1.5 以下)", () => {
    const labor = [makeLabor({ hoursActual: 15, hoursPlanned: 10 })];
    const sigs = detectLaborOverrun(labor);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].severity).toBe("warning");
  });

  it("ratio > 1.5 → critical", () => {
    const labor = [makeLabor({ hoursActual: 16, hoursPlanned: 10 })];
    const sigs = detectLaborOverrun(labor);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].severity).toBe("critical");
  });

  it("lossYen = 超過時間 × 3500", () => {
    const labor = [makeLabor({ hoursActual: 14, hoursPlanned: 10 })];
    const sigs = detectLaborOverrun(labor);
    // 超過 4h × 3500 = 14000
    expect(sigs[0].lossYen).toBe(4 * LABOR_HOURLY_RATE_YEN);
  });

  it("hoursPlanned = 0 → シグナルなし", () => {
    const labor = [makeLabor({ hoursActual: 10, hoursPlanned: 0 })];
    expect(detectLaborOverrun(labor)).toHaveLength(0);
  });

  it("LABOR_HOURLY_RATE_YEN = 3500", () => {
    expect(LABOR_HOURLY_RATE_YEN).toBe(3_500);
  });
});

// ── detectOutOfScopeOrder ─────────────────────────────────────────────────

describe("detectOutOfScopeOrder", () => {
  it("extra 発注なし → シグナルなし", () => {
    const orders = [makeOrder({ scope: "in_scope" })];
    expect(detectOutOfScopeOrder(orders)).toHaveLength(0);
  });

  it("extra が in_scope の 5% 以下 → シグナルなし", () => {
    const orders = [
      makeOrder({ id: "o1", scope: "in_scope", qty: 100, unitPriceYen: 1000 }),
      makeOrder({ id: "o2", scope: "extra", qty: 4, unitPriceYen: 1000 }), // 4% < 5%
    ];
    expect(detectOutOfScopeOrder(orders)).toHaveLength(0);
  });

  it("extra が in_scope の 5% 超 → warning", () => {
    const orders = [
      makeOrder({ id: "o1", scope: "in_scope", qty: 100, unitPriceYen: 1000 }),
      makeOrder({ id: "o2", scope: "extra", qty: 6, unitPriceYen: 1000 }), // 6% > 5%
    ];
    const sigs = detectOutOfScopeOrder(orders);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].kind).toBe(LossKind.out_of_scope_order);
    expect(sigs[0].severity).toBe("warning");
  });

  it("lossYen = extra 合計", () => {
    const orders = [
      makeOrder({ id: "o1", scope: "in_scope", qty: 100, unitPriceYen: 1000 }),
      makeOrder({ id: "o2", scope: "extra", qty: 10, unitPriceYen: 2000 }),
    ];
    const sigs = detectOutOfScopeOrder(orders);
    expect(sigs[0].lossYen).toBe(20_000);
  });

  it("異なる projectId は別シグナル", () => {
    const orders = [
      makeOrder({ id: "o1", projectId: "p1", scope: "in_scope", qty: 100, unitPriceYen: 100 }),
      makeOrder({ id: "o2", projectId: "p1", scope: "extra", qty: 10, unitPriceYen: 100 }),
      makeOrder({ id: "o3", projectId: "p2", scope: "in_scope", qty: 100, unitPriceYen: 100 }),
      makeOrder({ id: "o4", projectId: "p2", scope: "extra", qty: 10, unitPriceYen: 100 }),
    ];
    expect(detectOutOfScopeOrder(orders)).toHaveLength(2);
  });

  it("in_scope なしで extra だけある場合 → シグナル発生 (base = extraTotal)", () => {
    // base = extraTotal なので ratio = 1.0 > 0.05 → signal
    const orders = [
      makeOrder({ id: "o1", scope: "extra", qty: 10, unitPriceYen: 1000 }),
    ];
    const sigs = detectOutOfScopeOrder(orders);
    expect(sigs).toHaveLength(1);
  });
});

// ── detectPriceCreep ──────────────────────────────────────────────────────

describe("detectPriceCreep", () => {
  it("plannedUnitPriceYen なし → シグナルなし", () => {
    const orders = [makeOrder({ unitPriceYen: 1200 })];
    expect(detectPriceCreep(orders)).toHaveLength(0);
  });

  it("ratio = 1.05 境界値 → シグナルなし", () => {
    const orders = [makeOrder({ unitPriceYen: 1050, plannedUnitPriceYen: 1000 })];
    expect(detectPriceCreep(orders)).toHaveLength(0);
  });

  it("ratio = 1.06 → warning", () => {
    const orders = [makeOrder({ unitPriceYen: 1060, plannedUnitPriceYen: 1000 })];
    const sigs = detectPriceCreep(orders);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].severity).toBe("warning");
    expect(sigs[0].kind).toBe(LossKind.price_creep);
  });

  it("ratio > 1.2 → critical", () => {
    const orders = [makeOrder({ unitPriceYen: 1250, plannedUnitPriceYen: 1000 })];
    const sigs = detectPriceCreep(orders);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].severity).toBe("critical");
  });

  it("lossYen = (actual - planned) × qty", () => {
    const orders = [makeOrder({ qty: 10, unitPriceYen: 1200, plannedUnitPriceYen: 1000 })];
    const sigs = detectPriceCreep(orders);
    // (1200 - 1000) × 10 = 2000
    expect(sigs[0].lossYen).toBe(2_000);
  });

  it("plannedUnitPriceYen = 0 → シグナルなし", () => {
    const orders = [makeOrder({ unitPriceYen: 1000, plannedUnitPriceYen: 0 })];
    expect(detectPriceCreep(orders)).toHaveLength(0);
  });

  it("複数オーダーで複数シグナル", () => {
    const orders = [
      makeOrder({ id: "o1", unitPriceYen: 1100, plannedUnitPriceYen: 1000 }),
      makeOrder({ id: "o2", itemCode: "B", unitPriceYen: 1300, plannedUnitPriceYen: 1000 }),
    ];
    expect(detectPriceCreep(orders)).toHaveLength(2);
  });
});

// ── detectWastageHigh ─────────────────────────────────────────────────────

describe("detectWastageHigh", () => {
  it("usedQty なし → シグナルなし", () => {
    const orders = [
      makeOrder({ id: "o1" }),
      makeOrder({ id: "o2" }),
      makeOrder({ id: "o3" }),
    ];
    expect(detectWastageHigh(orders)).toHaveLength(0);
  });

  it("3 件未満 → シグナルなし (最低 3 件必要)", () => {
    const orders = [
      makeOrder({ id: "o1", qty: 10, usedQty: 5 }),
      makeOrder({ id: "o2", qty: 10, usedQty: 5 }),
    ];
    expect(detectWastageHigh(orders)).toHaveLength(0);
  });

  it("歩留り = 85% 境界値 → シグナルなし", () => {
    const orders = [
      makeOrder({ id: "o1", qty: 100, usedQty: 85 }),
      makeOrder({ id: "o2", qty: 100, usedQty: 85 }),
      makeOrder({ id: "o3", qty: 100, usedQty: 85 }),
    ];
    expect(detectWastageHigh(orders)).toHaveLength(0);
  });

  it("歩留り < 85% → warning", () => {
    const orders = [
      makeOrder({ id: "o1", qty: 100, usedQty: 80 }),
      makeOrder({ id: "o2", qty: 100, usedQty: 80 }),
      makeOrder({ id: "o3", qty: 100, usedQty: 80 }),
    ];
    const sigs = detectWastageHigh(orders);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].kind).toBe(LossKind.wastage_high);
    expect(sigs[0].severity).toBe("warning");
  });

  it("歩留り < 70% → critical", () => {
    const orders = [
      makeOrder({ id: "o1", qty: 100, usedQty: 60 }),
      makeOrder({ id: "o2", qty: 100, usedQty: 60 }),
      makeOrder({ id: "o3", qty: 100, usedQty: 60 }),
    ];
    const sigs = detectWastageHigh(orders);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].severity).toBe("critical");
  });

  it("lossYen = 廃材数量 × 平均単価", () => {
    const orders = [
      makeOrder({ id: "o1", qty: 100, usedQty: 70, unitPriceYen: 500 }),
      makeOrder({ id: "o2", qty: 100, usedQty: 70, unitPriceYen: 500 }),
      makeOrder({ id: "o3", qty: 100, usedQty: 70, unitPriceYen: 500 }),
    ];
    const sigs = detectWastageHigh(orders);
    // 廃材 = 300 - 210 = 90 × 500 = 45000
    expect(sigs[0].lossYen).toBe(45_000);
  });

  it("異なる itemCode は別グループ", () => {
    const ordersA = [
      makeOrder({ id: "a1", itemCode: "A", qty: 100, usedQty: 70 }),
      makeOrder({ id: "a2", itemCode: "A", qty: 100, usedQty: 70 }),
      makeOrder({ id: "a3", itemCode: "A", qty: 100, usedQty: 70 }),
    ];
    const ordersB = [
      makeOrder({ id: "b1", itemCode: "B", qty: 100, usedQty: 70 }),
      makeOrder({ id: "b2", itemCode: "B", qty: 100, usedQty: 70 }),
      makeOrder({ id: "b3", itemCode: "B", qty: 100, usedQty: 70 }),
    ];
    const sigs = detectWastageHigh([...ordersA, ...ordersB]);
    expect(sigs).toHaveLength(2);
  });
});
