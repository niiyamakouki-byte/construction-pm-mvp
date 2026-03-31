import type {
  CostMaster,
  MasterItem,
  Estimate,
  EstimateLine,
  EstimateSection,
  EstimateRequest,
} from "./types";
import costMasterData from "./cost-master.json";

const master: CostMaster = costMasterData as CostMaster;

/** コードからマスター品目を検索 */
function findMasterItem(code: string): MasterItem | undefined {
  for (const cat of master.categories) {
    const item = cat.items.find((i) => i.code === code);
    if (item) return item;
  }
  return undefined;
}

/** コードからカテゴリを検索 */
function findCategory(code: string) {
  const prefix = code.split("-")[0];
  const map: Record<string, string> = {
    DM: "demolition",
    IN: "interior",
    EL: "electrical",
    PL: "plumbing",
    HV: "hvac",
    FX: "fixtures",
    OH: "overhead",
  };
  const catId = map[prefix];
  return master.categories.find((c) => c.id === catId);
}

/** ユニークID生成 */
function generateId(): string {
  return `EST-${Date.now().toString(36).toUpperCase()}`;
}

/** 見積書を生成 */
export function generateEstimate(req: EstimateRequest): Estimate {
  const {
    propertyName,
    clientName,
    validDays = 30,
    managementFeeRate = 0.1,
    generalExpenseRate = 0.05,
    items,
    notes = [],
  } = req;

  // カテゴリ別にグループ化
  const sectionMap = new Map<string, EstimateLine[]>();

  for (const input of items) {
    const masterItem = findMasterItem(input.code);
    if (!masterItem) {
      throw new Error(`品目コード ${input.code} が見つかりません`);
    }

    const cat = findCategory(input.code);
    if (!cat) continue;

    const unitPrice = input.unitPriceOverride ?? masterItem.unitPrice;
    const amount = unitPrice * input.quantity;

    const line: EstimateLine = {
      code: input.code,
      name: masterItem.name,
      unit: masterItem.unit,
      quantity: input.quantity,
      unitPrice,
      amount,
      note: masterItem.note,
    };

    const existing = sectionMap.get(cat.id) ?? [];
    existing.push(line);
    sectionMap.set(cat.id, existing);
  }

  // セクション構築
  const sections: EstimateSection[] = [];
  for (const cat of master.categories) {
    const lines = sectionMap.get(cat.id);
    if (!lines || lines.length === 0) continue;
    sections.push({
      categoryId: cat.id,
      categoryName: cat.name,
      lines,
      subtotal: lines.reduce((sum, l) => sum + l.amount, 0),
    });
  }

  const directCost = sections.reduce((sum, s) => sum + s.subtotal, 0);
  const managementFee = Math.round(directCost * managementFeeRate);
  const generalExpense = Math.round(
    (directCost + managementFee) * generalExpenseRate,
  );
  const subtotal = directCost + managementFee + generalExpense;
  const tax = Math.round(subtotal * master.taxRate);
  const total = subtotal + tax;

  const now = new Date();
  const validUntil = new Date(now);
  validUntil.setDate(validUntil.getDate() + validDays);

  return {
    id: generateId(),
    propertyName,
    clientName,
    createdAt: now.toISOString().slice(0, 10),
    validUntil: validUntil.toISOString().slice(0, 10),
    sections,
    directCost,
    managementFee,
    managementFeeRate,
    generalExpense,
    generalExpenseRate,
    subtotal,
    tax,
    taxRate: master.taxRate,
    total,
    notes,
  };
}

/** マスターの全品目一覧を取得 */
export function listAllItems() {
  return master.categories.flatMap((cat) =>
    cat.items.map((item) => ({
      ...item,
      categoryId: cat.id,
      categoryName: cat.name,
    })),
  );
}

/** カテゴリ一覧を取得 */
export function listCategories() {
  return master.categories.map((c) => ({
    id: c.id,
    name: c.name,
    itemCount: c.items.length,
  }));
}

/** カテゴリ内の品目一覧を取得 */
export function listItemsByCategory(categoryId: string) {
  const cat = master.categories.find((c) => c.id === categoryId);
  if (!cat) throw new Error(`カテゴリ ${categoryId} が見つかりません`);
  return cat.items;
}
