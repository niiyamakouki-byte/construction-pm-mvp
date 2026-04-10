import { describe, it, expect, beforeEach } from "vitest";
import {
  generateOrderFromEstimate,
  syncEstimateToBudget,
  onEstimateApproved,
  type EstimateItem,
} from "./unified-data-flow.js";
import { deleteOrder, listOrders } from "./order-management.js";

function clearOrderStore() {
  for (const o of listOrders()) deleteOrder(o.id);
}

beforeEach(() => {
  clearOrderStore();
});

const ITEMS: EstimateItem[] = [
  { name: "床材フローリング", unitPrice: 5000, quantity: 10, amount: 50000 },
  { name: "壁紙張替", unitPrice: 2000, quantity: 20, amount: 40000 },
  { name: "大工作業", unitPrice: 8000, quantity: 5, amount: 40000 },
];

describe("generateOrderFromEstimate", () => {
  it("creates a 下書き purchase order from estimate items", () => {
    const order = generateOrderFromEstimate(ITEMS, "c-1", "テスト業者", "p-1", "2026-06-01");
    expect(order.status).toBe("下書き");
    expect(order.contractorId).toBe("c-1");
    expect(order.contractorName).toBe("テスト業者");
    expect(order.projectId).toBe("p-1");
    expect(order.items).toHaveLength(3);
    expect(order.totalAmount).toBe(130000);
  });

  it("maps item quantities and unit prices correctly", () => {
    const order = generateOrderFromEstimate(ITEMS, "c-1", "業者A", "p-1", "2026-06-01");
    expect(order.items[0].quantity).toBe(10);
    expect(order.items[0].unitPrice).toBe(5000);
    expect(order.items[0].amount).toBe(50000);
  });

  it("computes tax (10%) correctly", () => {
    const order = generateOrderFromEstimate(ITEMS, "c-1", "業者A", "p-1", "2026-06-01");
    expect(order.taxAmount).toBe(13000);
    expect(order.totalWithTax).toBe(143000);
  });
});

describe("syncEstimateToBudget", () => {
  it("groups items by inferred category", () => {
    const entries = syncEstimateToBudget(ITEMS);
    const materialEntry = entries.find((e) => e.category === "材料費");
    const laborEntry = entries.find((e) => e.category === "労務費");
    expect(materialEntry).toBeDefined();
    expect(materialEntry!.estimatedAmount).toBe(90000); // 50000 + 40000
    expect(laborEntry).toBeDefined();
    expect(laborEntry!.estimatedAmount).toBe(40000);
  });

  it("returns empty array for empty input", () => {
    expect(syncEstimateToBudget([])).toEqual([]);
  });

  it("defaults unknown items to 外注費", () => {
    const items: EstimateItem[] = [{ name: "その他工事", unitPrice: 100, quantity: 1, amount: 100 }];
    const entries = syncEstimateToBudget(items);
    expect(entries[0].category).toBe("外注費");
  });
});

describe("onEstimateApproved", () => {
  it("returns order and budget entries on approval", () => {
    const result = onEstimateApproved("est-1", ITEMS, "c-1", "テスト業者", "p-1", "2026-06-01");
    expect(result.order.status).toBe("下書き");
    expect(result.budgetEntries.length).toBeGreaterThan(0);
  });

  it("throws when estimate has no items", () => {
    expect(() =>
      onEstimateApproved("est-empty", [], "c-1", "業者A", "p-1", "2026-06-01"),
    ).toThrow("est-empty");
  });

  it("budget total equals estimate total", () => {
    const result = onEstimateApproved("est-1", ITEMS, "c-1", "業者A", "p-1", "2026-06-01");
    const budgetTotal = result.budgetEntries.reduce((s, e) => s + e.estimatedAmount, 0);
    const itemTotal = ITEMS.reduce((s, i) => s + i.amount, 0);
    expect(budgetTotal).toBe(itemTotal);
  });
});
