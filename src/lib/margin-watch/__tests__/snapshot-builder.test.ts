/**
 * Tests for snapshot-builder.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { buildSnapshotFromProject } from "../snapshot-builder.js";
import { addProject, _resetProjectStore } from "../../store.js";
import { createOrder, transitionOrder } from "../../order-management.js";

// ── Reset ──────────────────────────────────────────────────────────────────

function resetOrders() {
  // order-management uses a module-level Map; reset by accessing it indirectly
  // We rely on the module reset pattern used in order-management tests
  // Since there's no public reset, we re-import but can clear via the module
  // Actually we can import from order-management
}

beforeEach(() => {
  _resetProjectStore();
});

// ── buildSnapshotFromProject ───────────────────────────────────────────────

describe("buildSnapshotFromProject", () => {
  it("存在しない projectId → null を返す", () => {
    const snap = buildSnapshotFromProject("nonexistent");
    expect(snap).toBeNull();
  });

  it("プロジェクトが存在する → snapshot を返す", () => {
    addProject({
      id: "p-snap-1",
      name: "スナップショット案件",
      description: "",
      status: "active",
      startDate: "2025-01-01",
      budget: 10_000_000,
      includeWeekends: false,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    });

    const snap = buildSnapshotFromProject("p-snap-1");
    expect(snap).not.toBeNull();
    expect(snap!.projectId).toBe("p-snap-1");
    expect(snap!.projectName).toBe("スナップショット案件");
    expect(snap!.contractAmountYen).toBe(10_000_000);
  });

  it("budget=undefined → contractAmountYen=0", () => {
    addProject({
      id: "p-snap-no-budget",
      name: "予算なし",
      description: "",
      status: "active",
      startDate: "2025-01-01",
      budget: undefined,
      includeWeekends: false,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    });

    const snap = buildSnapshotFromProject("p-snap-no-budget");
    expect(snap!.contractAmountYen).toBe(0);
  });

  it("発注済オーダーがない → totalCostYen=0, estimatedRemainingCostYen=0", () => {
    addProject({
      id: "p-snap-empty",
      name: "空案件",
      description: "",
      status: "active",
      startDate: "2025-01-01",
      budget: 5_000_000,
      includeWeekends: false,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    });

    const snap = buildSnapshotFromProject("p-snap-empty");
    expect(snap!.totalCostYen).toBe(0);
    expect(snap!.estimatedRemainingCostYen).toBe(0);
  });

  it("検収済オーダーが totalCostYen に加算される", () => {
    addProject({
      id: "p-snap-2",
      name: "発注案件",
      description: "",
      status: "active",
      startDate: "2025-01-01",
      budget: 10_000_000,
      includeWeekends: false,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    });

    const order = createOrder(
      "p-snap-2",
      "vendor-1",
      "テスト業者",
      [{ code: "M1", name: "材料A", unit: "個", quantity: 10, unitPrice: 100_000 }],
      "2025-12-31",
    );
    // transition to 検収済
    transitionOrder(order.id, "発注済");
    transitionOrder(order.id, "納品待ち");
    transitionOrder(order.id, "納品済");
    transitionOrder(order.id, "検収済");

    const snap = buildSnapshotFromProject("p-snap-2");
    expect(snap!.totalCostYen).toBeGreaterThan(0);
  });

  it("粗利率フィールドが計算されて返る", () => {
    addProject({
      id: "p-snap-3",
      name: "粗利率案件",
      description: "",
      status: "active",
      startDate: "2025-01-01",
      budget: 10_000_000,
      includeWeekends: false,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    });

    const snap = buildSnapshotFromProject("p-snap-3");
    expect(typeof snap!.marginRatioPct).toBe("number");
    expect(typeof snap!.forecastMarginRatioPct).toBe("number");
  });
});
