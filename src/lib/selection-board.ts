/**
 * 施主セレクションボード — Buildertrend/CoConstruct蒸留
 * 内装工事の仕上材選定を施主がオンラインで行うためのライブラリ
 */

import type { EstimateItem } from "./estimate-comparison.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type SelectionCategory =
  | "床材"
  | "壁材"
  | "天井材"
  | "建具"
  | "照明"
  | "衛生器具"
  | "その他";

export type SelectionStatus =
  | "選定中"
  | "施主確認待ち"
  | "承認済"
  | "変更依頼";

export type SelectionOption = {
  id: string;
  name: string;
  description: string;
  unitPrice: number;
  imageUrl?: string;
  catalogUrl?: string;
};

export type SelectionItem = {
  id: string;
  projectId: string;
  category: SelectionCategory;
  name: string;
  options: SelectionOption[];
  selectedOptionId: string | null;
  status: SelectionStatus;
  clientNote: string;
};

// ── In-memory store ───────────────────────────────────────────────────────────

const store = new Map<string, SelectionItem>();

// ── ID generator ──────────────────────────────────────────────────────────────

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function createSelectionItem(
  params: Omit<SelectionItem, "id" | "status" | "selectedOptionId" | "clientNote">,
): SelectionItem {
  const item: SelectionItem = {
    ...params,
    id: genId("sel"),
    selectedOptionId: null,
    status: "選定中",
    clientNote: "",
  };
  store.set(item.id, item);
  return item;
}

export function getSelectionItem(id: string): SelectionItem | undefined {
  return store.get(id);
}

export function getSelectionItemsByProject(projectId: string): SelectionItem[] {
  return Array.from(store.values()).filter((item) => item.projectId === projectId);
}

export function updateSelectionItem(
  id: string,
  patch: Partial<Omit<SelectionItem, "id" | "projectId">>,
): SelectionItem {
  const item = store.get(id);
  if (!item) throw new Error(`SelectionItem not found: ${id}`);
  const updated: SelectionItem = { ...item, ...patch };
  store.set(id, updated);
  return updated;
}

export function deleteSelectionItem(id: string): void {
  store.delete(id);
}

// ── Status transitions ────────────────────────────────────────────────────────

export function setStatus(id: string, status: SelectionStatus): SelectionItem {
  return updateSelectionItem(id, { status });
}

export function selectOption(id: string, optionId: string): SelectionItem {
  const item = store.get(id);
  if (!item) throw new Error(`SelectionItem not found: ${id}`);
  const optionExists = item.options.some((o) => o.id === optionId);
  if (!optionExists) throw new Error(`SelectionOption not found: ${optionId}`);
  return updateSelectionItem(id, { selectedOptionId: optionId, status: "施主確認待ち" });
}

export function approveSelection(id: string): SelectionItem {
  return updateSelectionItem(id, { status: "承認済" });
}

// ── Estimate integration (unified-data-flow) ──────────────────────────────────

/**
 * 承認済み品目を EstimateItem[] に変換して見積に反映できる形にする
 */
export function selectionToEstimateItems(projectId: string): EstimateItem[] {
  const items = getSelectionItemsByProject(projectId).filter(
    (item) => item.status === "承認済" && item.selectedOptionId,
  );

  return items.map((item) => {
    const opt = item.options.find((o) => o.id === item.selectedOptionId)!;
    return {
      name: `${item.category} - ${item.name}（${opt.name}）`,
      unitPrice: opt.unitPrice,
      quantity: 1,
      amount: opt.unitPrice,
    };
  });
}

// ── Seed helper (for demo/test) ───────────────────────────────────────────────

export function clearSelectionStore(): void {
  store.clear();
}
