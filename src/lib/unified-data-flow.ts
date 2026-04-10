/**
 * Unified data flow — one-entry chain: estimate → spec → order → budget.
 * CoConstruct-inspired: a single estimate approval auto-generates purchase orders
 * and registers category budgets, eliminating duplicate data entry.
 */

import type { EstimateItem } from "./estimate-comparison.js";
import {
  createOrder,
  type PurchaseOrder,
} from "./order-management.js";
import type { CostCategory } from "./cost-management.js";

export type { EstimateItem };

/** Budget category entry auto-derived from estimate items */
export type BudgetCategoryEntry = {
  category: CostCategory;
  estimatedAmount: number;
};

/** Result of onEstimateApproved */
export type EstimateApprovalResult = {
  order: PurchaseOrder;
  budgetEntries: BudgetCategoryEntry[];
};

// ── Category mapping ─────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: { pattern: RegExp; category: CostCategory }[] = [
  { pattern: /材料|資材|部材|床|壁|天井|タイル|フローリング|ビニル/i, category: "材料費" },
  { pattern: /労務|作業|施工|大工|電気工|内装|解体/i, category: "労務費" },
  { pattern: /外注|下請|業者/i, category: "外注費" },
];

function inferCategory(itemName: string): CostCategory {
  for (const { pattern, category } of CATEGORY_KEYWORDS) {
    if (pattern.test(itemName)) return category;
  }
  return "外注費";
}

// ── Core functions ───────────────────────────────────────────────────────────

/**
 * Generate a purchase order draft from estimate items for the given contractor.
 */
export function generateOrderFromEstimate(
  estimateItems: EstimateItem[],
  contractorId: string,
  contractorName: string,
  projectId: string,
  deliveryDate: string,
): PurchaseOrder {
  const orderItems = estimateItems.map((item) => ({
    code: `EST-${item.name.slice(0, 6).toUpperCase().replace(/\s/g, "_")}`,
    name: item.name,
    unit: "式",
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }));

  return createOrder(projectId, contractorId, contractorName, orderItems, deliveryDate);
}

/**
 * Derive per-category budget entries from estimate items.
 * Groups items by inferred cost category and sums amounts.
 */
export function syncEstimateToBudget(estimateItems: EstimateItem[]): BudgetCategoryEntry[] {
  const totals = new Map<CostCategory, number>();

  for (const item of estimateItems) {
    const category = inferCategory(item.name);
    totals.set(category, (totals.get(category) ?? 0) + item.amount);
  }

  return Array.from(totals.entries()).map(([category, estimatedAmount]) => ({
    category,
    estimatedAmount,
  }));
}

/**
 * Triggered when an estimate is approved.
 * Auto-generates a purchase order draft and registers budget entries.
 */
export function onEstimateApproved(
  estimateId: string,
  estimateItems: EstimateItem[],
  contractorId: string,
  contractorName: string,
  projectId: string,
  deliveryDate: string,
): EstimateApprovalResult {
  if (estimateItems.length === 0) {
    throw new Error(`Estimate ${estimateId} has no items`);
  }

  const order = generateOrderFromEstimate(
    estimateItems,
    contractorId,
    contractorName,
    projectId,
    deliveryDate,
  );

  const budgetEntries = syncEstimateToBudget(estimateItems);

  return { order, budgetEntries };
}
