/**
 * Tests for loss-aggregator.
 */

import { describe, expect, it } from "vitest";
import { aggregateLoss, runAllDetectors } from "../lib/cost-loss-detector/loss-aggregator.js";
import { LossKind } from "../lib/cost-loss-detector/types.js";
import type { LossSignal, OrderRecord, LaborRecord } from "../lib/cost-loss-detector/types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeSignal(overrides: Partial<LossSignal> = {}): LossSignal {
  return {
    id: `sig-${Math.random().toString(36).slice(2)}`,
    projectId: "p1",
    kind: LossKind.material_surplus,
    severity: "warning",
    detectedAt: new Date().toISOString(),
    evidenceRefs: [],
    lossYen: 10_000,
    message: "test",
    suggestedAction: "action",
    ...overrides,
  };
}

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

// ── aggregateLoss ─────────────────────────────────────────────────────────

describe("aggregateLoss", () => {
  it("空配列 → projectId 空・totalLossYen 0", () => {
    const summary = aggregateLoss([]);
    expect(summary.projectId).toBe("");
    expect(summary.totalLossYen).toBe(0);
    expect(summary.signals).toHaveLength(0);
  });

  it("totalLossYen = 全シグナルの lossYen 合計", () => {
    const signals = [
      makeSignal({ lossYen: 50_000 }),
      makeSignal({ lossYen: 30_000 }),
      makeSignal({ lossYen: 20_000 }),
    ];
    const summary = aggregateLoss(signals);
    expect(summary.totalLossYen).toBe(100_000);
  });

  it("projectId = 最初のシグナルの projectId", () => {
    const signals = [makeSignal({ projectId: "proj-ABC" })];
    const summary = aggregateLoss(signals);
    expect(summary.projectId).toBe("proj-ABC");
  });

  it("byKind: 対応するキーに lossYen が加算される", () => {
    const signals = [
      makeSignal({ kind: LossKind.material_surplus, lossYen: 20_000 }),
      makeSignal({ kind: LossKind.labor_overrun, lossYen: 10_500 }),
      makeSignal({ kind: LossKind.price_creep, lossYen: 5_000 }),
    ];
    const summary = aggregateLoss(signals);
    expect(summary.byKind.material_surplus).toBe(20_000);
    expect(summary.byKind.labor_overrun).toBe(10_500);
    expect(summary.byKind.price_creep).toBe(5_000);
    expect(summary.byKind.material_shortage_emergency).toBe(0);
  });

  it("byKind は LossKind の全キーを含む", () => {
    const summary = aggregateLoss([]);
    expect(Object.keys(summary.byKind)).toHaveLength(6);
    for (const k of Object.values(LossKind)) {
      expect(summary.byKind[k]).toBe(0);
    }
  });

  it("同 kind の複数シグナル → byKind に加算", () => {
    const signals = [
      makeSignal({ kind: LossKind.material_surplus, lossYen: 10_000 }),
      makeSignal({ kind: LossKind.material_surplus, lossYen: 15_000 }),
    ];
    const summary = aggregateLoss(signals);
    expect(summary.byKind.material_surplus).toBe(25_000);
  });

  it("signals フィールドに全シグナルが含まれる", () => {
    const signals = [makeSignal(), makeSignal(), makeSignal()];
    const summary = aggregateLoss(signals);
    expect(summary.signals).toHaveLength(3);
  });

  it("generatedAt は ISO 8601 形式", () => {
    const summary = aggregateLoss([]);
    expect(() => new Date(summary.generatedAt)).not.toThrow();
    expect(new Date(summary.generatedAt).toISOString()).toBeTruthy();
  });
});

// ── runAllDetectors ───────────────────────────────────────────────────────

describe("runAllDetectors", () => {
  it("空配列 → 空配列", () => {
    expect(runAllDetectors([], [])).toHaveLength(0);
  });

  it("material_surplus を検知する", () => {
    const orders = [makeOrder({ qty: 200, plannedQty: 100 })];
    const sigs = runAllDetectors(orders, []);
    expect(sigs.some((s) => s.kind === LossKind.material_surplus)).toBe(true);
  });

  it("labor_overrun を検知する", () => {
    const labor = [makeLabor({ hoursActual: 20, hoursPlanned: 10 })];
    const sigs = runAllDetectors([], labor);
    expect(sigs.some((s) => s.kind === LossKind.labor_overrun)).toBe(true);
  });

  it("out_of_scope_order を検知する", () => {
    const orders = [
      makeOrder({ id: "o1", scope: "in_scope", qty: 100, unitPriceYen: 100 }),
      makeOrder({ id: "o2", scope: "extra", qty: 10, unitPriceYen: 100 }),
    ];
    const sigs = runAllDetectors(orders, []);
    expect(sigs.some((s) => s.kind === LossKind.out_of_scope_order)).toBe(true);
  });

  it("price_creep を検知する", () => {
    const orders = [makeOrder({ unitPriceYen: 1200, plannedUnitPriceYen: 1000 })];
    const sigs = runAllDetectors(orders, []);
    expect(sigs.some((s) => s.kind === LossKind.price_creep)).toBe(true);
  });

  it("複数ルール同時発動 → 全シグナルを返す", () => {
    const orders = [
      makeOrder({ id: "o1", qty: 200, plannedQty: 100, unitPriceYen: 1200, plannedUnitPriceYen: 1000 }),
    ];
    const labor = [makeLabor({ hoursActual: 20, hoursPlanned: 10 })];
    const sigs = runAllDetectors(orders, labor);
    expect(sigs.length).toBeGreaterThanOrEqual(3);
  });

  it("shortage_emergency を検知する", () => {
    const orders = [
      makeOrder({ id: "o1", orderedAt: "2025-06-01T00:00:00Z" }),
      makeOrder({ id: "o2", orderedAt: "2025-06-10T00:00:00Z" }),
    ];
    const sigs = runAllDetectors(orders, []);
    expect(sigs.some((s) => s.kind === LossKind.material_shortage_emergency)).toBe(true);
  });

  it("wastage_high を検知する", () => {
    const orders = [
      makeOrder({ id: "o1", qty: 100, usedQty: 60 }),
      makeOrder({ id: "o2", qty: 100, usedQty: 60 }),
      makeOrder({ id: "o3", qty: 100, usedQty: 60 }),
    ];
    const sigs = runAllDetectors(orders, []);
    expect(sigs.some((s) => s.kind === LossKind.wastage_high)).toBe(true);
  });
});
