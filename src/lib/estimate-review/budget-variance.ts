/**
 * 予実差異分析レポート（DDC Phase 2）
 * 見積 vs 実績の差異、アラート閾値±10%黄/±20%赤、次回フィードバック
 */

export type VarianceItem = {
  category: string;
  estimated: number;
  actual: number;
  variance: number;
  variancePct: number;
  alert: "green" | "yellow" | "red";
};

export type VarianceReport = {
  projectId: string;
  items: VarianceItem[];
  totalEstimated: number;
  totalActual: number;
  totalVariance: number;
  totalVariancePct: number;
  overallAlert: "green" | "yellow" | "red";
  feedback: string[];
};

function alertLevel(pct: number): "green" | "yellow" | "red" {
  const abs = Math.abs(pct);
  if (abs >= 20) return "red";
  if (abs >= 10) return "yellow";
  return "green";
}

/**
 * 予実差異レポートを生成する
 * @param projectId プロジェクトID
 * @param items 各費目の見積・実績ペア
 */
export function buildVarianceReport(
  projectId: string,
  items: { category: string; estimated: number; actual: number }[],
): VarianceReport {
  const varItems: VarianceItem[] = items.map((item) => {
    const variance = item.actual - item.estimated;
    const variancePct =
      item.estimated > 0
        ? Math.round((variance / item.estimated) * 10000) / 100
        : 0;
    return {
      category: item.category,
      estimated: item.estimated,
      actual: item.actual,
      variance,
      variancePct,
      alert: alertLevel(variancePct),
    };
  });

  const totalEstimated = items.reduce((s, i) => s + i.estimated, 0);
  const totalActual = items.reduce((s, i) => s + i.actual, 0);
  const totalVariance = totalActual - totalEstimated;
  const totalVariancePct =
    totalEstimated > 0
      ? Math.round((totalVariance / totalEstimated) * 10000) / 100
      : 0;

  const overallAlert = alertLevel(totalVariancePct);

  // 次回見積フィードバック（赤・黄の費目を抽出）
  const feedback: string[] = [];
  for (const v of varItems) {
    if (v.alert === "red") {
      const dir = v.variance > 0 ? "超過" : "削減";
      feedback.push(
        `[要修正] ${v.category}: ${dir}${Math.abs(v.variancePct)}%（次回単価を見直す）`,
      );
    } else if (v.alert === "yellow") {
      const dir = v.variance > 0 ? "超過" : "削減";
      feedback.push(
        `[要注意] ${v.category}: ${dir}${Math.abs(v.variancePct)}%（次回で確認）`,
      );
    }
  }
  if (feedback.length === 0) {
    feedback.push("全費目が±10%以内: 見積精度良好");
  }

  return {
    projectId,
    items: varItems,
    totalEstimated,
    totalActual,
    totalVariance,
    totalVariancePct,
    overallAlert,
    feedback,
  };
}
