/** 業者見積比較ライブラリ */

/** 見積品目 */
export type EstimateItem = {
  name: string;
  unitPrice: number;
  quantity: number;
  amount: number;
};

/** 業者見積 */
export type CompetitorEstimate = {
  contractorId: string;
  contractorName: string;
  items: EstimateItem[];
  totalAmount: number;
  submittedDate: string;
};

/** 品目ごとの横断比較結果 */
export type ItemComparison = {
  itemName: string;
  prices: { contractorId: string; contractorName: string; unitPrice: number; amount: number }[];
  minUnitPrice: number;
  maxUnitPrice: number;
  avgUnitPrice: number;
  bestContractorId: string;
};

/** 全体比較結果 */
export type ComparisonResult = {
  itemComparisons: ItemComparison[];
  totalComparison: { contractorId: string; contractorName: string; totalAmount: number }[];
  bestContractorId: string;
};

/** 最安選択結果 */
export type BestPriceSelection = {
  itemName: string;
  bestContractorId: string;
  bestContractorName: string;
  unitPrice: number;
  quantity: number;
  amount: number;
};

/** 比較レポート行 */
export type ComparisonReportLine = {
  itemName: string;
  contractors: { contractorId: string; contractorName: string; unitPrice: number; isBest: boolean }[];
  bestContractorId: string;
  savingsVsAvg: number;
};

/**
 * 複数業者の見積を品目ごとに横断比較する
 */
export function compareEstimates(estimates: CompetitorEstimate[]): ComparisonResult {
  if (estimates.length === 0) {
    return { itemComparisons: [], totalComparison: [], bestContractorId: "" };
  }

  // 全品目名を収集
  const allItemNames = Array.from(
    new Set(estimates.flatMap((e) => e.items.map((i) => i.name))),
  );

  const itemComparisons: ItemComparison[] = allItemNames.map((itemName) => {
    const prices = estimates
      .map((e) => {
        const item = e.items.find((i) => i.name === itemName);
        if (!item) return null;
        return {
          contractorId: e.contractorId,
          contractorName: e.contractorName,
          unitPrice: item.unitPrice,
          amount: item.amount,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    const unitPrices = prices.map((p) => p.unitPrice);
    const minUnitPrice = Math.min(...unitPrices);
    const maxUnitPrice = Math.max(...unitPrices);
    const avgUnitPrice = Math.round(unitPrices.reduce((s, v) => s + v, 0) / unitPrices.length);
    const bestEntry = prices.find((p) => p.unitPrice === minUnitPrice)!;

    return {
      itemName,
      prices,
      minUnitPrice,
      maxUnitPrice,
      avgUnitPrice,
      bestContractorId: bestEntry.contractorId,
    };
  });

  const totalComparison = estimates.map((e) => ({
    contractorId: e.contractorId,
    contractorName: e.contractorName,
    totalAmount: e.totalAmount,
  }));

  const bestTotal = totalComparison.reduce((best, c) =>
    c.totalAmount < best.totalAmount ? c : best,
  );

  return {
    itemComparisons,
    totalComparison,
    bestContractorId: bestTotal.contractorId,
  };
}

/**
 * 各品目で最安業者を自動選択する
 */
export function selectBestPrices(estimates: CompetitorEstimate[]): BestPriceSelection[] {
  if (estimates.length === 0) return [];

  const allItemNames = Array.from(
    new Set(estimates.flatMap((e) => e.items.map((i) => i.name))),
  );

  return allItemNames.map((itemName) => {
    const candidates = estimates
      .map((e) => {
        const item = e.items.find((i) => i.name === itemName);
        if (!item) return null;
        return {
          contractorId: e.contractorId,
          contractorName: e.contractorName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          amount: item.amount,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    const best = candidates.reduce((a, b) => (a.unitPrice <= b.unitPrice ? a : b));

    return {
      itemName,
      bestContractorId: best.contractorId,
      bestContractorName: best.contractorName,
      unitPrice: best.unitPrice,
      quantity: best.quantity,
      amount: best.amount,
    };
  });
}

/**
 * 比較レポートを生成する
 */
export function generateComparisonReport(estimates: CompetitorEstimate[]): ComparisonReportLine[] {
  if (estimates.length === 0) return [];

  const result = compareEstimates(estimates);

  return result.itemComparisons.map((ic) => {
    const bestUnitPrice = ic.minUnitPrice;
    const savingsVsAvg = ic.avgUnitPrice - bestUnitPrice;

    const contractors = ic.prices.map((p) => ({
      contractorId: p.contractorId,
      contractorName: p.contractorName,
      unitPrice: p.unitPrice,
      isBest: p.unitPrice === bestUnitPrice,
    }));

    return {
      itemName: ic.itemName,
      contractors,
      bestContractorId: ic.bestContractorId,
      savingsVsAvg,
    };
  });
}
