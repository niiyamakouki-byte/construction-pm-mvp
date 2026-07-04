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

/** ローカル日付をYYYY-MM-DD形式に変換（toISOString()はUTC基準のため深夜0-9時のJSTで日付がズレる） */
function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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
    SF: "shop_fitting",
    RN: "renovation",
    SC: "scaffolding",
    PL2: "plastering",
    OH: "overhead",
  };
  const catId = map[prefix];
  return master.categories.find((c) => c.id === catId);
}

/** ユニークID生成 */
function generateId(): string {
  return `EST-${crypto.randomUUID().replace(/-/g, '').toUpperCase()}`;
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

  // 入力バリデーション
  if (managementFeeRate < 0 || managementFeeRate > 1) {
    throw new Error(`現場管理費率が不正です: ${managementFeeRate} (0〜1の範囲で指定)`);
  }
  if (generalExpenseRate < 0 || generalExpenseRate > 1) {
    throw new Error(`一般管理費率が不正です: ${generalExpenseRate} (0〜1の範囲で指定)`);
  }

  // カテゴリ別にグループ化
  const sectionMap = new Map<string, EstimateLine[]>();

  for (const input of items) {
    if (!Number.isFinite(input.quantity) || input.quantity < 0) {
      throw new Error(`数量が不正です: ${input.code} quantity=${input.quantity}`);
    }
    if (input.unitPriceOverride !== undefined && (!Number.isFinite(input.unitPriceOverride) || input.unitPriceOverride < 0)) {
      throw new Error(`単価が不正です: ${input.code} unitPrice=${input.unitPriceOverride}`);
    }

    const masterItem = findMasterItem(input.code);
    if (!masterItem) {
      throw new Error(`品目コード ${input.code} が見つかりません`);
    }

    const cat = findCategory(input.code);
    if (!cat) continue;

    const unitPrice = input.unitPriceOverride ?? masterItem.unitPrice;
    // 端数処理: 四捨五入で整数円に丸める（小数点以下が蓄積して合計がずれるのを防ぐ）
    const amount = Math.round(unitPrice * input.quantity);

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
    createdAt: toLocalDateString(now),
    validUntil: toLocalDateString(validUntil),
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
