/**
 * Tests for cost-loss-detector types.
 */

import { describe, expect, it } from "vitest";
import {
  LossKind,
  type LossSignal,
  type OrderRecord,
  type LaborRecord,
  type LossSummary,
  type Severity,
} from "../lib/cost-loss-detector/types.js";

// ── LossKind ───────────────────────────────────────────────────────────────

describe("LossKind", () => {
  it("material_surplus が存在する", () => {
    expect(LossKind.material_surplus).toBe("material_surplus");
  });

  it("material_shortage_emergency が存在する", () => {
    expect(LossKind.material_shortage_emergency).toBe("material_shortage_emergency");
  });

  it("labor_overrun が存在する", () => {
    expect(LossKind.labor_overrun).toBe("labor_overrun");
  });

  it("out_of_scope_order が存在する", () => {
    expect(LossKind.out_of_scope_order).toBe("out_of_scope_order");
  });

  it("price_creep が存在する", () => {
    expect(LossKind.price_creep).toBe("price_creep");
  });

  it("wastage_high が存在する", () => {
    expect(LossKind.wastage_high).toBe("wastage_high");
  });

  it("LossKind は 6 種類", () => {
    expect(Object.keys(LossKind)).toHaveLength(6);
  });
});

// ── LossSignal 型チェック ───────────────────────────────────────────────────

describe("LossSignal", () => {
  it("有効な LossSignal オブジェクトを作成できる", () => {
    const signal: LossSignal = {
      id: "sig-1",
      projectId: "p1",
      kind: LossKind.material_surplus,
      severity: "warning",
      detectedAt: "2025-06-01T10:00:00Z",
      evidenceRefs: ["order-1"],
      lossYen: 50_000,
      message: "材料余剰",
      suggestedAction: "返品交渉",
    };
    expect(signal.kind).toBe("material_surplus");
    expect(signal.severity).toBe("warning");
    expect(signal.lossYen).toBe(50_000);
  });

  it("severity は info | warning | critical", () => {
    const severities: Severity[] = ["info", "warning", "critical"];
    expect(severities).toHaveLength(3);
  });

  it("evidenceRefs は string 配列", () => {
    const signal: LossSignal = {
      id: "sig-2",
      projectId: "p1",
      kind: LossKind.labor_overrun,
      severity: "critical",
      detectedAt: "2025-06-01T00:00:00Z",
      evidenceRefs: ["labor-1", "labor-2"],
      lossYen: 10_500,
      message: "工数超過",
      suggestedAction: "工程見直し",
    };
    expect(signal.evidenceRefs).toHaveLength(2);
  });
});

// ── OrderRecord ────────────────────────────────────────────────────────────

describe("OrderRecord", () => {
  it("in_scope の scope が有効", () => {
    const order: OrderRecord = {
      id: "o1",
      projectId: "p1",
      vendorId: "v1",
      itemCode: "ITEM-001",
      qty: 10,
      unit: "m",
      unitPriceYen: 1000,
      scope: "in_scope",
      orderedAt: "2025-06-01T00:00:00Z",
    };
    expect(order.scope).toBe("in_scope");
  });

  it("extra の scope が有効", () => {
    const order: OrderRecord = {
      id: "o2",
      projectId: "p1",
      vendorId: "v1",
      itemCode: "ITEM-002",
      qty: 5,
      unit: "枚",
      unitPriceYen: 2000,
      scope: "extra",
      orderedAt: "2025-06-01T00:00:00Z",
    };
    expect(order.scope).toBe("extra");
  });

  it("オプションフィールドが undefined でも有効", () => {
    const order: OrderRecord = {
      id: "o3",
      projectId: "p1",
      vendorId: "v1",
      itemCode: "ITEM-003",
      qty: 3,
      unit: "本",
      unitPriceYen: 500,
      scope: "in_scope",
      orderedAt: "2025-06-01T00:00:00Z",
    };
    expect(order.plannedQty).toBeUndefined();
    expect(order.plannedUnitPriceYen).toBeUndefined();
    expect(order.usedQty).toBeUndefined();
  });
});

// ── LaborRecord ────────────────────────────────────────────────────────────

describe("LaborRecord", () => {
  it("有効な LaborRecord を作成できる", () => {
    const record: LaborRecord = {
      id: "l1",
      projectId: "p1",
      workerId: "w1",
      hoursActual: 10,
      hoursPlanned: 8,
      taskId: "t1",
      recordedAt: "2025-06-01T00:00:00Z",
    };
    expect(record.hoursActual).toBe(10);
    expect(record.hoursPlanned).toBe(8);
  });
});

// ── LossSummary ────────────────────────────────────────────────────────────

describe("LossSummary", () => {
  it("byKind は LossKind の全キーを持つ", () => {
    const summary: LossSummary = {
      projectId: "p1",
      totalLossYen: 0,
      signals: [],
      byKind: {
        material_surplus: 0,
        material_shortage_emergency: 0,
        labor_overrun: 0,
        out_of_scope_order: 0,
        price_creep: 0,
        wastage_high: 0,
      },
      generatedAt: "2025-06-01T00:00:00Z",
    };
    expect(Object.keys(summary.byKind)).toHaveLength(6);
    for (const k of Object.values(LossKind)) {
      expect(summary.byKind[k]).toBe(0);
    }
  });
});
