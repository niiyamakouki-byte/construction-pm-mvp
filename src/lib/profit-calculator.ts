/** 粗利逆算計算ライブラリ */

/** コスト品目 */
export type CostItem = {
  code: string;
  name: string;
  unitPrice: number;
  quantity: number;
  /** 労務費かどうか（法定福利費の対象） */
  isLaborCost?: boolean;
};

/** 法定福利率（建設業標準: 15.35%） */
export const LEGAL_WELFARE_RATE = 0.1535;

/** 法定福利費を計算 */
export function calcLegalWelfare(costItems: CostItem[]): number {
  const laborCost = costItems
    .filter((i) => i.isLaborCost)
    .reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  return Math.round(laborCost * LEGAL_WELFARE_RATE);
}

/** 直接原価合計を計算（法定福利費込み） */
export function calcTotalCost(costItems: CostItem[], includeLegalWelfare = false): number {
  const direct = costItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  return direct + (includeLegalWelfare ? calcLegalWelfare(costItems) : 0);
}

/** 目標粗利率から見積金額を逆算 */
export function calculateFromMargin(
  costItems: CostItem[],
  targetMarginPercent: number,
  includeLegalWelfare = false,
): {
  totalCost: number;
  legalWelfare: number;
  estimatePrice: number;
  grossProfit: number;
  marginPercent: number;
} {
  if (targetMarginPercent <= 0 || targetMarginPercent >= 100) {
    throw new Error(`粗利率は0〜100の範囲で指定してください: ${targetMarginPercent}`);
  }
  const legalWelfare = includeLegalWelfare ? calcLegalWelfare(costItems) : 0;
  const totalCost = calcTotalCost(costItems, includeLegalWelfare);
  // 見積金額 = 原価 ÷ (1 - 粗利率)
  const estimatePrice = Math.round(totalCost / (1 - targetMarginPercent / 100));
  const grossProfit = estimatePrice - totalCost;
  const marginPercent = estimatePrice > 0 ? (grossProfit / estimatePrice) * 100 : 0;
  return { totalCost, legalWelfare, estimatePrice, grossProfit, marginPercent };
}

/** 目標金額から粗利率を逆算 */
export function calculateFromPrice(
  costItems: CostItem[],
  targetPrice: number,
  includeLegalWelfare = false,
): {
  totalCost: number;
  legalWelfare: number;
  estimatePrice: number;
  grossProfit: number;
  marginPercent: number;
} {
  if (targetPrice <= 0) {
    throw new Error(`目標金額は0より大きい値を指定してください: ${targetPrice}`);
  }
  const legalWelfare = includeLegalWelfare ? calcLegalWelfare(costItems) : 0;
  const totalCost = calcTotalCost(costItems, includeLegalWelfare);
  const grossProfit = targetPrice - totalCost;
  const marginPercent = (grossProfit / targetPrice) * 100;
  return { totalCost, legalWelfare, estimatePrice: targetPrice, grossProfit, marginPercent };
}

/** 松竹梅3パターン同時計算 */
export function simulateMultiple(
  costItems: CostItem[],
  margins: number[],
  includeLegalWelfare = false,
): Array<{
  label: string;
  marginPercent: number;
  totalCost: number;
  legalWelfare: number;
  estimatePrice: number;
  grossProfit: number;
  actualMarginPercent: number;
}> {
  const labels = ["梅", "竹", "松"];
  return margins.map((margin, idx) => {
    const result = calculateFromMargin(costItems, margin, includeLegalWelfare);
    return {
      label: labels[idx] ?? `パターン${idx + 1}`,
      marginPercent: margin,
      totalCost: result.totalCost,
      legalWelfare: result.legalWelfare,
      estimatePrice: result.estimatePrice,
      grossProfit: result.grossProfit,
      actualMarginPercent: result.marginPercent,
    };
  });
}
