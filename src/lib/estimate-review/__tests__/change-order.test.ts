import { describe, expect, it } from "vitest";
import {
  calcChangeOrderDiff,
  createChangeOrderRecord,
  type EstimateItem,
} from "../change-order.js";

function item(id: string, name: string, amount: number): EstimateItem {
  return { id, name, quantity: 1, unitPrice: amount, amount };
}

describe("calcChangeOrderDiff", () => {
  it("detects added items", () => {
    const original = [item("a", "壁紙", 500_000)];
    const updated = [item("a", "壁紙", 500_000), item("b", "追加照明", 100_000)];
    const diff = calcChangeOrderDiff(original, updated);
    expect(diff.items).toHaveLength(1);
    expect(diff.items[0].type).toBe("add");
    expect(diff.delta).toBe(100_000);
  });

  it("detects deleted items", () => {
    const original = [item("a", "壁紙", 500_000), item("b", "照明", 100_000)];
    const updated = [item("a", "壁紙", 500_000)];
    const diff = calcChangeOrderDiff(original, updated);
    expect(diff.items).toHaveLength(1);
    expect(diff.items[0].type).toBe("delete");
    expect(diff.delta).toBe(-100_000);
  });

  it("detects modified amounts", () => {
    const original = [item("a", "壁紙", 500_000)];
    const updated = [item("a", "壁紙", 600_000)];
    const diff = calcChangeOrderDiff(original, updated);
    expect(diff.items[0].type).toBe("modify");
    expect(diff.delta).toBe(100_000);
    expect(diff.deltaPct).toBe(20);
  });

  it("returns empty items when no changes", () => {
    const original = [item("a", "壁紙", 500_000)];
    const diff = calcChangeOrderDiff(original, [...original]);
    expect(diff.items).toHaveLength(0);
    expect(diff.delta).toBe(0);
  });
});

describe("createChangeOrderRecord", () => {
  it("creates record with pending_approval status", () => {
    const diff = calcChangeOrderDiff(
      [item("a", "壁紙", 500_000)],
      [item("a", "壁紙", 600_000)],
    );
    const record = createChangeOrderRecord(
      "co-1",
      "est-100",
      "施主要望による仕様変更",
      "田中",
      "2025-03-01",
      diff,
    );
    expect(record.status).toBe("pending_approval");
    expect(record.reason).toBe("施主要望による仕様変更");
    expect(record.items).toHaveLength(1);
  });
});
