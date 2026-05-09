/**
 * Tests for metrics-builder.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { buildProjectMetrics, buildAllProjectMetrics } from "../metrics-builder.js";
import { addProject, _resetProjectStore } from "../../store.js";
import { createOrder, transitionOrder } from "../../order-management.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeProject(id: string, budget?: number, endDate?: string) {
  addProject({
    id,
    name: `案件${id}`,
    description: "内装工事テスト",
    status: "active",
    startDate: "2025-01-01",
    endDate,
    budget,
    includeWeekends: false,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  });
}

beforeEach(() => {
  _resetProjectStore();
});

// ── buildProjectMetrics ────────────────────────────────────────────────────

describe("buildProjectMetrics", () => {
  it("存在しない projectId → null", () => {
    expect(buildProjectMetrics("nonexistent")).toBeNull();
  });

  it("予算なしプロジェクト → orderAmount=0, marginRatioPct=0", () => {
    makeProject("p-no-budget");
    const m = buildProjectMetrics("p-no-budget");
    expect(m).not.toBeNull();
    expect(m!.orderAmount).toBe(0);
    expect(m!.marginRatioPct).toBe(0);
  });

  it("オーダーなし → actualCost=0, forecastCost=0", () => {
    makeProject("p-empty", 10_000_000);
    const m = buildProjectMetrics("p-empty");
    expect(m!.actualCost).toBe(0);
    expect(m!.forecastCost).toBe(0);
  });

  it("受注額あり・コストなし → marginAmount = orderAmount", () => {
    makeProject("p-full-margin", 10_000_000);
    const m = buildProjectMetrics("p-full-margin");
    expect(m!.marginAmount).toBe(10_000_000);
    expect(m!.marginRatioPct).toBeCloseTo(100, 1);
  });

  it("検収済オーダーが actualCost に加算される", () => {
    makeProject("p-cost", 10_000_000);
    const order = createOrder(
      "p-cost",
      "vendor-1",
      "テスト業者",
      [{ code: "M1", name: "材料A", unit: "個", quantity: 10, unitPrice: 100_000 }],
      "2025-12-31",
    );
    transitionOrder(order.id, "発注済");
    transitionOrder(order.id, "納品待ち");
    transitionOrder(order.id, "納品済");
    transitionOrder(order.id, "検収済");

    const m = buildProjectMetrics("p-cost");
    expect(m!.actualCost).toBeGreaterThan(0);
    expect(m!.marginRatioPct).toBeLessThan(100);
  });

  it("発注済オーダーが forecastCost に含まれる", () => {
    makeProject("p-committed", 10_000_000);
    const order = createOrder(
      "p-committed",
      "vendor-1",
      "業者A",
      [{ code: "M1", name: "材料B", unit: "式", quantity: 1, unitPrice: 500_000 }],
      "2025-12-31",
    );
    transitionOrder(order.id, "発注済");

    const m = buildProjectMetrics("p-committed");
    expect(m!.forecastCost).toBeGreaterThan(0);
    expect(m!.forecastMarginRatioPct).toBeLessThan(m!.marginRatioPct);
  });

  it("durationMonths は最低1ヶ月", () => {
    makeProject("p-min-dur", 5_000_000, "2025-01-01");
    const m = buildProjectMetrics("p-min-dur");
    expect(m!.durationMonths).toBeGreaterThanOrEqual(1);
  });

  it("marginPerMonth = marginAmount / durationMonths", () => {
    makeProject("p-permonth", 12_000_000, "2025-06-30");
    const m = buildProjectMetrics("p-permonth");
    expect(m!.marginPerMonth).toBeCloseTo(m!.marginAmount / m!.durationMonths, 0);
  });

  it("projectName が正しく設定される", () => {
    makeProject("p-name-check", 5_000_000);
    const m = buildProjectMetrics("p-name-check");
    expect(m!.projectName).toBe("案件p-name-check");
  });

  it("projectId が正しく設定される", () => {
    makeProject("p-id-check", 5_000_000);
    const m = buildProjectMetrics("p-id-check");
    expect(m!.projectId).toBe("p-id-check");
  });
});

// ── buildAllProjectMetrics ─────────────────────────────────────────────────

describe("buildAllProjectMetrics", () => {
  it("プロジェクトなし → 空配列", () => {
    expect(buildAllProjectMetrics()).toHaveLength(0);
  });

  it("3案件 → 3件のメトリクスが返る", () => {
    makeProject("p-all-1", 10_000_000);
    makeProject("p-all-2", 8_000_000);
    makeProject("p-all-3", 5_000_000);
    const all = buildAllProjectMetrics();
    expect(all).toHaveLength(3);
  });

  it("全件の projectId が含まれる", () => {
    makeProject("p-ids-1", 5_000_000);
    makeProject("p-ids-2", 3_000_000);
    const all = buildAllProjectMetrics();
    const ids = all.map((m) => m.projectId);
    expect(ids).toContain("p-ids-1");
    expect(ids).toContain("p-ids-2");
  });
});
