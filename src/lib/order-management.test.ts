import { describe, it, expect, beforeEach } from "vitest";
import {
  createOrder,
  transitionOrder,
  getOrder,
  listOrders,
  deleteOrder,
  canTransition,
  getNextStatuses,
  recordDeliveryCheck,
  getDeliveryCheck,
  buildPdfData,
  getOrderSummaryByStatus,
  getTotalByStatus,
} from "./order-management.js";
import type { OrderStatus } from "./order-management.js";

// Reset in-memory store between tests by deleting all orders
// (module-level Map persists across tests in same process, so we delete manually)
function clearStore() {
  const all = listOrders();
  for (const o of all) deleteOrder(o.id);
}

beforeEach(() => {
  clearStore();
});

const DEMO_ITEMS = [
  { code: "DM-001", name: "内装解体", unit: "㎡", quantity: 10, unitPrice: 3500 },
  { code: "LGS-001", name: "LGS 65mm", unit: "本", quantity: 100, unitPrice: 800 },
];

describe("createOrder", () => {
  it("creates an order in 下書き status with computed amounts", () => {
    const order = createOrder("p-1", "c-1", "テスト業者", DEMO_ITEMS, "2026-05-01");
    expect(order.status).toBe("下書き");
    expect(order.items[0].amount).toBe(35000);
    expect(order.items[1].amount).toBe(80000);
    expect(order.totalAmount).toBe(115000);
    expect(order.taxAmount).toBe(11500);
    expect(order.totalWithTax).toBe(126500);
    expect(order.projectId).toBe("p-1");
    expect(order.contractorName).toBe("テスト業者");
  });

  it("stores the order and retrieves via getOrder", () => {
    const order = createOrder("p-1", "c-1", "テスト業者", DEMO_ITEMS, "2026-05-01");
    const fetched = getOrder(order.id);
    expect(fetched).toEqual(order);
  });
});

describe("transitionOrder", () => {
  it("transitions 下書き → 発注済", () => {
    const order = createOrder("p-1", "c-1", "テスト業者", DEMO_ITEMS, "2026-05-01");
    const updated = transitionOrder(order.id, "発注済");
    expect(updated.status).toBe("発注済");
  });

  it("transitions through full flow", () => {
    const order = createOrder("p-1", "c-1", "テスト業者", DEMO_ITEMS, "2026-05-01");
    const flow: OrderStatus[] = ["発注済", "納品待ち", "納品済", "検収済", "請求済", "支払済"];
    let current = order;
    for (const next of flow) {
      current = transitionOrder(current.id, next);
      expect(current.status).toBe(next);
    }
  });

  it("throws on invalid transition", () => {
    const order = createOrder("p-1", "c-1", "テスト業者", DEMO_ITEMS, "2026-05-01");
    expect(() => transitionOrder(order.id, "支払済")).toThrow("Invalid transition");
  });

  it("throws if order not found", () => {
    expect(() => transitionOrder("nonexistent", "発注済")).toThrow("Order not found");
  });
});

describe("canTransition / getNextStatuses", () => {
  it("returns true for valid transition", () => {
    expect(canTransition("下書き", "発注済")).toBe(true);
    expect(canTransition("発注済", "納品待ち")).toBe(true);
  });

  it("returns false for invalid transition", () => {
    expect(canTransition("下書き", "支払済")).toBe(false);
    expect(canTransition("支払済", "発注済")).toBe(false);
  });

  it("returns no next statuses for 支払済", () => {
    expect(getNextStatuses("支払済")).toHaveLength(0);
  });

  it("returns 発注済 from 下書き", () => {
    expect(getNextStatuses("下書き")).toContain("発注済");
  });
});

describe("listOrders", () => {
  it("lists all orders when no projectId given", () => {
    createOrder("p-1", "c-1", "A", DEMO_ITEMS, "2026-05-01");
    createOrder("p-2", "c-2", "B", DEMO_ITEMS, "2026-05-02");
    expect(listOrders()).toHaveLength(2);
  });

  it("filters by projectId", () => {
    createOrder("p-1", "c-1", "A", DEMO_ITEMS, "2026-05-01");
    createOrder("p-2", "c-2", "B", DEMO_ITEMS, "2026-05-02");
    expect(listOrders("p-1")).toHaveLength(1);
    expect(listOrders("p-1")[0].projectId).toBe("p-1");
  });
});

describe("deleteOrder", () => {
  it("deletes an existing order", () => {
    const order = createOrder("p-1", "c-1", "A", DEMO_ITEMS, "2026-05-01");
    expect(deleteOrder(order.id)).toBe(true);
    expect(getOrder(order.id)).toBeUndefined();
  });

  it("returns false for nonexistent order", () => {
    expect(deleteOrder("nope")).toBe(false);
  });
});

describe("recordDeliveryCheck / getDeliveryCheck", () => {
  it("records and retrieves a delivery check", () => {
    const order = createOrder("p-1", "c-1", "A", DEMO_ITEMS, "2026-05-01");
    const check = recordDeliveryCheck(order.id, "現場監督", true, "問題なし");
    expect(check.orderId).toBe(order.id);
    expect(check.passed).toBe(true);
    expect(check.remarks).toBe("問題なし");
    expect(getDeliveryCheck(order.id)).toEqual(check);
  });

  it("marks failed inspection", () => {
    const order = createOrder("p-1", "c-1", "A", DEMO_ITEMS, "2026-05-01");
    const check = recordDeliveryCheck(order.id, "田中", false, "数量不足");
    expect(check.passed).toBe(false);
  });
});

describe("buildPdfData", () => {
  it("builds PDF data for an order", () => {
    const order = createOrder("p-1", "c-1", "テスト業者", DEMO_ITEMS, "2026-05-01");
    const pdf = buildPdfData(order.id);
    expect(pdf.order.id).toBe(order.id);
    expect(pdf.issuerName).toBe("株式会社ラポルタ");
    expect(pdf.issueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("throws for nonexistent order", () => {
    expect(() => buildPdfData("nope")).toThrow("Order not found");
  });
});

describe("getOrderSummaryByStatus / getTotalByStatus", () => {
  it("counts orders by status", () => {
    createOrder("p-1", "c-1", "A", DEMO_ITEMS, "2026-05-01");
    const order2 = createOrder("p-1", "c-2", "B", DEMO_ITEMS, "2026-05-02");
    transitionOrder(order2.id, "発注済");
    const summary = getOrderSummaryByStatus("p-1");
    expect(summary["下書き"]).toBe(1);
    expect(summary["発注済"]).toBe(1);
  });

  it("sums totals by status", () => {
    const order = createOrder("p-1", "c-1", "A", DEMO_ITEMS, "2026-05-01");
    transitionOrder(order.id, "発注済");
    const total = getTotalByStatus("発注済", "p-1");
    expect(total).toBe(order.totalWithTax);
  });
});
