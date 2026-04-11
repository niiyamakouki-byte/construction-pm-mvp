/** コストマスターの品目 */
export type MasterItem = {
  code: string;
  name: string;
  unit: string;
  unitPrice: number;
  note: string;
};

/** コストマスターのカテゴリ */
export type MasterCategory = {
  id: string;
  name: string;
  items: MasterItem[];
};

/** コストマスター全体 */
export type CostMaster = {
  version: string;
  updatedAt: string;
  currency: string;
  taxRate: number;
  categories: MasterCategory[];
};

/** 見積の1行 */
export type EstimateLine = {
  code: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  note: string;
};

/** 見積のカテゴリ小計 */
export type EstimateSection = {
  categoryId: string;
  categoryName: string;
  lines: EstimateLine[];
  subtotal: number;
};

/** 見積書全体 */
export type Estimate = {
  id: string;
  propertyName: string;
  clientName: string;
  createdAt: string;
  validUntil: string;
  sections: EstimateSection[];
  directCost: number;
  managementFee: number;
  managementFeeRate: number;
  generalExpense: number;
  generalExpenseRate: number;
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  notes: string[];
};

/** 見積入力（1品目分） */
export type EstimateInput = {
  code: string;
  quantity: number;
  unitPriceOverride?: number;
};

/** 見積生成リクエスト */
export type EstimateRequest = {
  propertyName: string;
  clientName: string;
  validDays?: number;
  managementFeeRate?: number;
  generalExpenseRate?: number;
  items: EstimateInput[];
  notes?: string[];
};

/** Phase4フィードバック用: 見積修正履歴 */
export type EstimateRevision = {
  /** 修正前の見積行 */
  originalItems: EstimateLine[];
  /** 修正後の見積行 */
  revisedItems: EstimateLine[];
  /** レビュアーコメント */
  reviewerNote: string;
  /** 修正日時 (ISO 8601) */
  timestamp: string;
};
