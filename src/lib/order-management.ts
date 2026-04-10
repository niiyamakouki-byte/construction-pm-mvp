/**
 * Order management — purchase orders, delivery, inspection, billing, and payment flow.
 */

export type OrderStatus =
  | "下書き"
  | "発注済"
  | "納品待ち"
  | "納品済"
  | "検収済"
  | "請求済"
  | "支払済";

export type OrderItem = {
  code: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number; // quantity * unitPrice
};

export type PurchaseOrder = {
  id: string;
  projectId: string;
  contractorId: string;
  contractorName: string;
  items: OrderItem[];
  status: OrderStatus;
  orderDate: string;
  deliveryDate: string;
  totalAmount: number;
  taxAmount: number;
  totalWithTax: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryCheck = {
  orderId: string;
  checkedAt: string;
  checkedBy: string;
  passed: boolean;
  remarks?: string;
};

export type PurchaseOrderPdfData = {
  order: PurchaseOrder;
  issueDate: string;
  issuerName: string;
  issuerAddress: string;
};

// ── Status transition rules ─────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  下書き: ["発注済"],
  発注済: ["納品待ち", "下書き"],
  納品待ち: ["納品済"],
  納品済: ["検収済"],
  検収済: ["請求済"],
  請求済: ["支払済"],
  支払済: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function getNextStatuses(current: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[current];
}

// ── In-memory store ─────────────────────────────────────────────────────────

const orders: Map<string, PurchaseOrder> = new Map();
let nextId = 1;

// ── Core functions ──────────────────────────────────────────────────────────

export function createOrder(
  projectId: string,
  contractorId: string,
  contractorName: string,
  items: Omit<OrderItem, "amount">[],
  deliveryDate: string,
  notes?: string,
): PurchaseOrder {
  const TAX_RATE = 0.1;
  const fullItems: OrderItem[] = items.map((item) => ({
    ...item,
    amount: item.quantity * item.unitPrice,
  }));
  const totalAmount = fullItems.reduce((sum, i) => sum + i.amount, 0);
  const taxAmount = Math.floor(totalAmount * TAX_RATE);
  const now = new Date().toISOString();

  const order: PurchaseOrder = {
    id: `po-${nextId++}`,
    projectId,
    contractorId,
    contractorName,
    items: fullItems,
    status: "下書き",
    orderDate: now.slice(0, 10),
    deliveryDate,
    totalAmount,
    taxAmount,
    totalWithTax: totalAmount + taxAmount,
    notes,
    createdAt: now,
    updatedAt: now,
  };

  orders.set(order.id, order);
  return order;
}

export function transitionOrder(
  orderId: string,
  to: OrderStatus,
): PurchaseOrder {
  const order = orders.get(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (!canTransition(order.status, to)) {
    throw new Error(
      `Invalid transition: ${order.status} → ${to}`,
    );
  }
  const updated: PurchaseOrder = {
    ...order,
    status: to,
    updatedAt: new Date().toISOString(),
  };
  orders.set(orderId, updated);
  return updated;
}

export function getOrder(id: string): PurchaseOrder | undefined {
  return orders.get(id);
}

export function listOrders(projectId?: string): PurchaseOrder[] {
  const all = Array.from(orders.values());
  if (projectId) return all.filter((o) => o.projectId === projectId);
  return all;
}

export function deleteOrder(id: string): boolean {
  return orders.delete(id);
}

// ── Delivery inspection ─────────────────────────────────────────────────────

const deliveryChecks: Map<string, DeliveryCheck> = new Map();

export function recordDeliveryCheck(
  orderId: string,
  checkedBy: string,
  passed: boolean,
  remarks?: string,
): DeliveryCheck {
  const check: DeliveryCheck = {
    orderId,
    checkedAt: new Date().toISOString(),
    checkedBy,
    passed,
    remarks,
  };
  deliveryChecks.set(orderId, check);
  return check;
}

export function getDeliveryCheck(orderId: string): DeliveryCheck | undefined {
  return deliveryChecks.get(orderId);
}

// ── PDF data builder ────────────────────────────────────────────────────────

export function buildPdfData(
  orderId: string,
  issuerName = "株式会社ラポルタ",
  issuerAddress = "東京都港区南青山",
): PurchaseOrderPdfData {
  const order = orders.get(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  return {
    order,
    issueDate: new Date().toISOString().slice(0, 10),
    issuerName,
    issuerAddress,
  };
}

// ── Summary helpers ─────────────────────────────────────────────────────────

export function getOrderSummaryByStatus(projectId?: string): Record<OrderStatus, number> {
  const list = listOrders(projectId);
  const summary: Record<OrderStatus, number> = {
    下書き: 0,
    発注済: 0,
    納品待ち: 0,
    納品済: 0,
    検収済: 0,
    請求済: 0,
    支払済: 0,
  };
  for (const o of list) {
    summary[o.status]++;
  }
  return summary;
}

export function getTotalByStatus(status: OrderStatus, projectId?: string): number {
  return listOrders(projectId)
    .filter((o) => o.status === status)
    .reduce((sum, o) => sum + o.totalWithTax, 0);
}
