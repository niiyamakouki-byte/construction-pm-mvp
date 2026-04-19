import { describe, it, expect, beforeEach } from "vitest";
import {
  OrderRepository,
  type PurchaseOrderRecord,
} from "./OrderRepository.js";

function makeOrder(
  overrides: Partial<PurchaseOrderRecord> = {},
): PurchaseOrderRecord {
  const now = new Date().toISOString();
  return {
    id: "po-1",
    projectId: "proj-1",
    contractorId: "c-1",
    contractorName: "山田内装工業",
    items: [
      { code: "A-01", name: "LGS 65mm", unit: "本", quantity: 100, unitPrice: 500, amount: 50000 },
    ],
    status: "下書き",
    orderDate: "2025-07-01",
    deliveryDate: "2025-07-15",
    totalAmount: 50000,
    taxAmount: 5000,
    totalWithTax: 55000,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("OrderRepository (InMemory mode)", () => {
  let repo: OrderRepository;

  beforeEach(() => {
    repo = new OrderRepository(false);
  });

  it("getAsync returns null for unknown id", async () => {
    expect(await repo.getAsync("missing")).toBeNull();
  });

  it("saveAsync persists order, getAsync retrieves it", async () => {
    await repo.saveAsync(makeOrder());
    const result = await repo.getAsync("po-1");
    expect(result?.contractorName).toBe("山田内装工業");
    expect(result?.items).toHaveLength(1);
  });

  it("listByProjectAsync filters by projectId", async () => {
    await repo.saveAsync(makeOrder({ id: "po-a", projectId: "p-1" }));
    await repo.saveAsync(makeOrder({ id: "po-b", projectId: "p-2" }));
    await repo.saveAsync(makeOrder({ id: "po-c", projectId: "p-1" }));

    const items = await repo.listByProjectAsync("p-1");
    expect(items).toHaveLength(2);
    expect(items.map((o) => o.id).sort()).toEqual(["po-a", "po-c"]);
  });

  it("saveAsync updates existing record", async () => {
    await repo.saveAsync(makeOrder());
    await repo.saveAsync(makeOrder({ status: "発注済" }));
    const result = await repo.getAsync("po-1");
    expect(result?.status).toBe("発注済");
  });

  it("preserves all 7 statuses", async () => {
    for (const status of [
      "下書き",
      "発注済",
      "納品待ち",
      "納品済",
      "検収済",
      "請求済",
      "支払済",
    ] as const) {
      await repo.saveAsync(makeOrder({ id: `po-${status}`, status }));
      const result = await repo.getAsync(`po-${status}`);
      expect(result?.status).toBe(status);
    }
  });

  it("deleteAsync returns true on existing id, false on missing", async () => {
    await repo.saveAsync(makeOrder());
    expect(await repo.deleteAsync("po-1")).toBe(true);
    expect(await repo.deleteAsync("po-1")).toBe(false);
    expect(await repo.getAsync("po-1")).toBeNull();
  });

  it("_reset clears state", async () => {
    await repo.saveAsync(makeOrder());
    repo._reset();
    expect(await repo.getAsync("po-1")).toBeNull();
  });

  it("preserves notes through save/load", async () => {
    await repo.saveAsync(makeOrder({ notes: "納品先は東棟1F" }));
    const result = await repo.getAsync("po-1");
    expect(result?.notes).toBe("納品先は東棟1F");
  });

  it("preserves empty notes (undefined)", async () => {
    await repo.saveAsync(makeOrder({ notes: undefined }));
    const result = await repo.getAsync("po-1");
    expect(result?.notes).toBeUndefined();
  });

  it("preserves totals (amount / tax / with-tax)", async () => {
    await repo.saveAsync(
      makeOrder({ totalAmount: 123456, taxAmount: 12345, totalWithTax: 135801 }),
    );
    const result = await repo.getAsync("po-1");
    expect(result?.totalAmount).toBe(123456);
    expect(result?.taxAmount).toBe(12345);
    expect(result?.totalWithTax).toBe(135801);
  });

  it("preserves multi-item orders", async () => {
    await repo.saveAsync(
      makeOrder({
        items: [
          { code: "A", name: "X", unit: "個", quantity: 1, unitPrice: 100, amount: 100 },
          { code: "B", name: "Y", unit: "kg", quantity: 2, unitPrice: 200, amount: 400 },
          { code: "C", name: "Z", unit: "m", quantity: 3, unitPrice: 300, amount: 900 },
        ],
      }),
    );
    const result = await repo.getAsync("po-1");
    expect(result?.items).toHaveLength(3);
    expect(result?.items[2].name).toBe("Z");
  });

  it("saveAsync copies items array (push to caller's array does not leak)", async () => {
    const order = makeOrder();
    await repo.saveAsync(order);
    order.items.push({
      code: "X",
      name: "leaked",
      unit: "",
      quantity: 0,
      unitPrice: 0,
      amount: 0,
    });
    const persisted = await repo.getAsync("po-1");
    expect(persisted?.items).toHaveLength(1);
  });

  it("listByProjectAsync returns empty array when no matches", async () => {
    await repo.saveAsync(makeOrder({ projectId: "other" }));
    expect(await repo.listByProjectAsync("nonexistent")).toEqual([]);
  });

  it("deleteAsync on empty store returns false", async () => {
    expect(await repo.deleteAsync("never-saved")).toBe(false);
  });

  it("isolates memory between repository instances", async () => {
    await repo.saveAsync(makeOrder());
    const repo2 = new OrderRepository(false);
    expect(await repo2.getAsync("po-1")).toBeNull();
  });

  it("preserves contractorId + contractorName", async () => {
    await repo.saveAsync(
      makeOrder({ contractorId: "c-42", contractorName: "鈴木設備" }),
    );
    const result = await repo.getAsync("po-1");
    expect(result?.contractorId).toBe("c-42");
    expect(result?.contractorName).toBe("鈴木設備");
  });

  it("preserves orderDate + deliveryDate", async () => {
    await repo.saveAsync(
      makeOrder({ orderDate: "2025-01-15", deliveryDate: "2025-02-28" }),
    );
    const result = await repo.getAsync("po-1");
    expect(result?.orderDate).toBe("2025-01-15");
    expect(result?.deliveryDate).toBe("2025-02-28");
  });

  it("handles empty items array", async () => {
    await repo.saveAsync(makeOrder({ items: [] }));
    const result = await repo.getAsync("po-1");
    expect(result?.items).toEqual([]);
  });
});
