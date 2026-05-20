import { CostMasterRepository, type CostMasterItem } from "../lib/supabase-adapter/CostMasterRepository.js";

export type EstimateTotalItem = {
  quantity: number;
  unit_price: number;
};

const costMasterRepository = new CostMasterRepository();

export async function listCostItems(category?: string): Promise<CostMasterItem[]> {
  return category
    ? costMasterRepository.listByCategoryAsync(category)
    : costMasterRepository.listAsync();
}

export async function searchCostMaster(query: string): Promise<CostMasterItem[]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const items = await costMasterRepository.listAsync();
  return items.filter((item) =>
    [item.code, item.name, item.category, item.note ?? ""]
      .some((value) => value.toLowerCase().includes(normalized)),
  );
}

export function computeEstimateTotal(items: EstimateTotalItem[]): { subtotal: number; tax: number; total: number } {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const tax = Math.round(subtotal * 0.1);
  return { subtotal, tax, total: subtotal + tax };
}

export async function saveCostMasterItemForMcp(item: CostMasterItem): Promise<CostMasterItem> {
  await costMasterRepository.saveAsync(item);
  return item;
}
