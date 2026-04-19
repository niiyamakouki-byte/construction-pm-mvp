import { describe, it, expect } from "vitest";
import {
  ProcurementMaterialSchema,
  ProcurementMaterialStatusSchema,
  PurchaseOrderSchema,
  PurchaseOrderItemSchema,
  PurchaseOrderStatusSchema,
} from "../schemas.js";

const UUID = "123e4567-e89b-12d3-a456-426614174000";
const NOW = new Date().toISOString();

function base() {
  return { id: UUID, createdAt: NOW, updatedAt: NOW };
}

// ── ProcurementMaterialStatusSchema ─────────────────────────────────────────

describe("ProcurementMaterialStatusSchema", () => {
  it.each(["unordered", "ordered", "delivered", "accepted"])(
    "accepts %s",
    (status) => {
      expect(ProcurementMaterialStatusSchema.safeParse(status).success).toBe(true);
    },
  );

  it("rejects unknown status", () => {
    expect(ProcurementMaterialStatusSchema.safeParse("paid").success).toBe(false);
  });
});

// ── ProcurementMaterialSchema ───────────────────────────────────────────────

describe("ProcurementMaterialSchema", () => {
  const validMaterial = {
    ...base(),
    projectId: UUID,
    name: "LGS 65mm",
    category: "軽鉄材",
    quantity: 200,
    unit: "本",
    status: "unordered" as const,
    dueDate: "2025-07-10",
  };

  it("happy path: parses valid material", () => {
    expect(ProcurementMaterialSchema.safeParse(validMaterial).success).toBe(true);
  });

  it("rejects invalid uuid for projectId", () => {
    expect(
      ProcurementMaterialSchema.safeParse({ ...validMaterial, projectId: "not-uuid" })
        .success,
    ).toBe(false);
  });

  it("rejects negative quantity", () => {
    expect(
      ProcurementMaterialSchema.safeParse({ ...validMaterial, quantity: -1 }).success,
    ).toBe(false);
  });

  it("accepts zero quantity", () => {
    expect(
      ProcurementMaterialSchema.safeParse({ ...validMaterial, quantity: 0 }).success,
    ).toBe(true);
  });

  it("rejects NaN quantity", () => {
    expect(
      ProcurementMaterialSchema.safeParse({
        ...validMaterial,
        quantity: Number.NaN,
      }).success,
    ).toBe(false);
  });

  it("rejects invalid dueDate", () => {
    expect(
      ProcurementMaterialSchema.safeParse({ ...validMaterial, dueDate: "foo" }).success,
    ).toBe(false);
  });

  it("accepts full ISO datetime dueDate", () => {
    expect(
      ProcurementMaterialSchema.safeParse({
        ...validMaterial,
        dueDate: "2025-07-10T12:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(
      ProcurementMaterialSchema.safeParse({ ...validMaterial, status: "shipped" })
        .success,
    ).toBe(false);
  });

  it("rejects missing name", () => {
    const { name: _n, ...rest } = validMaterial;
    void _n;
    expect(ProcurementMaterialSchema.safeParse(rest).success).toBe(false);
  });
});

// ── PurchaseOrderStatusSchema ────────────────────────────────────────────────

describe("PurchaseOrderStatusSchema", () => {
  it.each([
    "下書き",
    "発注済",
    "納品待ち",
    "納品済",
    "検収済",
    "請求済",
    "支払済",
  ])("accepts %s", (status) => {
    expect(PurchaseOrderStatusSchema.safeParse(status).success).toBe(true);
  });

  it("rejects English status", () => {
    expect(PurchaseOrderStatusSchema.safeParse("draft").success).toBe(false);
  });

  it("rejects unknown status", () => {
    expect(PurchaseOrderStatusSchema.safeParse("キャンセル").success).toBe(false);
  });
});

// ── PurchaseOrderItemSchema ──────────────────────────────────────────────────

describe("PurchaseOrderItemSchema", () => {
  const validItem = {
    code: "A-01",
    name: "LGS 65mm",
    unit: "本",
    quantity: 100,
    unitPrice: 500,
    amount: 50000,
  };

  it("happy path: parses valid item", () => {
    expect(PurchaseOrderItemSchema.safeParse(validItem).success).toBe(true);
  });

  it("rejects negative quantity", () => {
    expect(
      PurchaseOrderItemSchema.safeParse({ ...validItem, quantity: -1 }).success,
    ).toBe(false);
  });

  it("rejects negative unitPrice", () => {
    expect(
      PurchaseOrderItemSchema.safeParse({ ...validItem, unitPrice: -500 }).success,
    ).toBe(false);
  });

  it("rejects negative amount", () => {
    expect(
      PurchaseOrderItemSchema.safeParse({ ...validItem, amount: -1 }).success,
    ).toBe(false);
  });

  it("accepts zero values", () => {
    expect(
      PurchaseOrderItemSchema.safeParse({
        ...validItem,
        quantity: 0,
        unitPrice: 0,
        amount: 0,
      }).success,
    ).toBe(true);
  });

  it("rejects missing code", () => {
    const { code: _c, ...rest } = validItem;
    void _c;
    expect(PurchaseOrderItemSchema.safeParse(rest).success).toBe(false);
  });
});

// ── PurchaseOrderSchema ──────────────────────────────────────────────────────

describe("PurchaseOrderSchema", () => {
  const validOrder = {
    ...base(),
    projectId: UUID,
    contractorId: "c-1",
    contractorName: "山田内装工業",
    items: [
      {
        code: "A-01",
        name: "LGS 65mm",
        unit: "本",
        quantity: 100,
        unitPrice: 500,
        amount: 50000,
      },
    ],
    status: "下書き" as const,
    orderDate: "2025-07-01",
    deliveryDate: "2025-07-15",
    totalAmount: 50000,
    taxAmount: 5000,
    totalWithTax: 55000,
  };

  it("happy path: parses valid order", () => {
    expect(PurchaseOrderSchema.safeParse(validOrder).success).toBe(true);
  });

  it("accepts order without optional notes", () => {
    expect(PurchaseOrderSchema.safeParse(validOrder).success).toBe(true);
  });

  it("accepts order with notes", () => {
    expect(
      PurchaseOrderSchema.safeParse({ ...validOrder, notes: "納品先指定" }).success,
    ).toBe(true);
  });

  it("accepts empty items array", () => {
    expect(
      PurchaseOrderSchema.safeParse({ ...validOrder, items: [] }).success,
    ).toBe(true);
  });

  it("rejects invalid projectId", () => {
    expect(
      PurchaseOrderSchema.safeParse({ ...validOrder, projectId: "not-uuid" })
        .success,
    ).toBe(false);
  });

  it("rejects invalid status", () => {
    expect(
      PurchaseOrderSchema.safeParse({ ...validOrder, status: "draft" }).success,
    ).toBe(false);
  });

  it("rejects negative totalAmount", () => {
    expect(
      PurchaseOrderSchema.safeParse({ ...validOrder, totalAmount: -1 }).success,
    ).toBe(false);
  });

  it("rejects invalid deliveryDate string", () => {
    expect(
      PurchaseOrderSchema.safeParse({ ...validOrder, deliveryDate: "xyz" }).success,
    ).toBe(false);
  });

  it("rejects non-array items", () => {
    expect(
      PurchaseOrderSchema.safeParse({ ...validOrder, items: "not-array" }).success,
    ).toBe(false);
  });

  it("rejects missing contractorName", () => {
    const { contractorName: _n, ...rest } = validOrder;
    void _n;
    expect(PurchaseOrderSchema.safeParse(rest).success).toBe(false);
  });
});
