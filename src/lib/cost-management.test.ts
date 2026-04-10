import { describe, it, expect, beforeEach } from "vitest";
import {
  getRemainingBudgetDetail,
  type CostRow,
} from "./cost-management.js";
import type { Project } from "../domain/types.js";
import { createOrder, deleteOrder, listOrders, transitionOrder } from "./order-management.js";

function clearOrderStore() {
  for (const o of listOrders()) deleteOrder(o.id);
}

beforeEach(() => {
  clearOrderStore();
});

const PROJECT: Project = {
  id: "p-test",
  name: "テスト案件",
  description: "",
  status: "active",
  budget: 1_000_000,
  startDate: "2026-04-01",
  endDate: "2026-09-30",
  includeWeekends: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const PAID_ROW: CostRow = {
  id: "cr-1",
  projectId: "p-test",
  date: "2026-04-10",
  description: "内装解体",
  amount: 200_000,
  paymentStatus: "paid",
  category: "外注費",
  breakdownType: "task_cost",
  source: "cost_item",
};

describe("getRemainingBudgetDetail", () => {
  it("returns full budget when nothing spent or committed", () => {
    const detail = getRemainingBudgetDetail(PROJECT, []);
    expect(detail.budget).toBe(1_000_000);
    expect(detail.spent).toBe(0);
    expect(detail.committedUndelivered).toBe(0);
    expect(detail.remaining).toBe(1_000_000);
    expect(detail.usedPct).toBe(0);
    expect(detail.alertLevel).toBe("none");
  });

  it("subtracts paid spent from budget", () => {
    const detail = getRemainingBudgetDetail(PROJECT, [PAID_ROW]);
    expect(detail.spent).toBe(200_000);
    expect(detail.remaining).toBe(800_000);
  });

  it("subtracts 発注済 orders from remaining", () => {
    const order = createOrder(
      "p-test",
      "c-1",
      "業者A",
      [{ code: "X", name: "LGS", unit: "本", quantity: 10, unitPrice: 10_000 }],
      "2026-05-01",
    );
    transitionOrder(order.id, "発注済");

    const detail = getRemainingBudgetDetail(PROJECT, [PAID_ROW]);
    // spent=200,000 + committed=110,000 (100,000 + 10% tax) = 310,000 used
    expect(detail.committedUndelivered).toBe(order.totalWithTax);
    expect(detail.remaining).toBe(1_000_000 - 200_000 - order.totalWithTax);
  });

  it("subtracts 納品待ち orders from remaining", () => {
    const order = createOrder(
      "p-test",
      "c-1",
      "業者A",
      [{ code: "X", name: "LGS", unit: "本", quantity: 10, unitPrice: 10_000 }],
      "2026-05-01",
    );
    transitionOrder(order.id, "発注済");
    transitionOrder(order.id, "納品待ち");

    const detail = getRemainingBudgetDetail(PROJECT, []);
    expect(detail.committedUndelivered).toBe(order.totalWithTax);
  });

  it("alertLevel is warning when remaining <= 20% of budget", () => {
    // spend 82% so 18% remains → warning
    const rows: CostRow[] = [{ ...PAID_ROW, amount: 820_000 }];
    const detail = getRemainingBudgetDetail(PROJECT, rows);
    expect(detail.alertLevel).toBe("warning");
  });

  it("alertLevel is danger when remaining <= 10% of budget", () => {
    // spend 95% so 5% remains → danger
    const rows: CostRow[] = [{ ...PAID_ROW, amount: 950_000 }];
    const detail = getRemainingBudgetDetail(PROJECT, rows);
    expect(detail.alertLevel).toBe("danger");
  });

  it("alertLevel is none when project is null", () => {
    const detail = getRemainingBudgetDetail(null, []);
    expect(detail.budget).toBe(0);
    expect(detail.alertLevel).toBe("none");
  });
});
