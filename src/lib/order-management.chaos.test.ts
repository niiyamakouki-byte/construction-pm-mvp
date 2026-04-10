/**
 * order-management カオステスト — 異常入力・境界値の網羅
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  createOrder,
  transitionOrder,
  listOrders,
  deleteOrder,
} from "./order-management.js";

function clearStore() {
  const all = listOrders();
  for (const o of all) deleteOrder(o.id);
}

const VALID_ITEMS = [
  { code: "A", name: "材料", unit: "個", quantity: 10, unitPrice: 1000 },
];

describe("order-management: カオステスト", () => {
  beforeEach(() => clearStore());

  // ── 数量の境界値 ──────────────────────────────────────────────────────────

  it("数量0のアイテムはamount=0で登録される", () => {
    const order = createOrder("p-1", "c-1", "業者A", [
      { code: "A", name: "材料", unit: "個", quantity: 0, unitPrice: 1000 },
    ], "2026-05-01");
    expect(order.items[0].amount).toBe(0);
    expect(order.totalAmount).toBe(0);
    expect(order.totalWithTax).toBe(0);
  });

  it("負の数量のアイテムはamountがマイナスになる（バリデーション未実装確認）", () => {
    const order = createOrder("p-1", "c-1", "業者A", [
      { code: "A", name: "材料", unit: "個", quantity: -5, unitPrice: 1000 },
    ], "2026-05-01");
    expect(order.items[0].amount).toBe(-5000);
    expect(order.totalAmount).toBe(-5000);
  });

  // ── 不正な遷移（スキップ） ────────────────────────────────────────────────

  it("下書き→支払済の直接遷移はエラーを投げる", () => {
    const order = createOrder("p-1", "c-1", "業者A", VALID_ITEMS, "2026-05-01");
    expect(() => transitionOrder(order.id, "支払済")).toThrow("Invalid transition");
  });

  it("下書き→検収済の直接遷移はエラーを投げる", () => {
    const order = createOrder("p-1", "c-1", "業者A", VALID_ITEMS, "2026-05-01");
    expect(() => transitionOrder(order.id, "検収済")).toThrow("Invalid transition");
  });

  it("下書き→請求済の直接遷移はエラーを投げる", () => {
    const order = createOrder("p-1", "c-1", "業者A", VALID_ITEMS, "2026-05-01");
    expect(() => transitionOrder(order.id, "請求済")).toThrow("Invalid transition");
  });

  // ── 空のitems配列で発注 ────────────────────────────────────────────────────

  it("空のitems配列で発注するとtotalAmount=0の発注書が作成される", () => {
    const order = createOrder("p-1", "c-1", "業者A", [], "2026-05-01");
    expect(order.items).toHaveLength(0);
    expect(order.totalAmount).toBe(0);
    expect(order.taxAmount).toBe(0);
    expect(order.totalWithTax).toBe(0);
  });

  it("空のitems配列の発注書はステータス遷移できる", () => {
    const order = createOrder("p-1", "c-1", "業者A", [], "2026-05-01");
    const placed = transitionOrder(order.id, "発注済");
    expect(placed.status).toBe("発注済");
  });
});
