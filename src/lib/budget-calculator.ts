/**
 * Budget breakdown, estimate vs actual comparison, and budget report generation.
 */

export type BudgetCategory = {
  name: string;
  estimatedAmount: number;
  actualAmount: number;
};

export type BudgetBreakdown = {
  projectName: string;
  totalEstimated: number;
  totalActual: number;
  categories: BudgetCategory[];
  variance: number;
  variancePct: number;
  status: "under_budget" | "on_budget" | "over_budget";
};

export type ComparisonItem = {
  category: string;
  estimated: number;
  actual: number;
  difference: number;
  percentDiff: number;
  status: "under" | "on_track" | "over";
};

export type ComparisonResult = {
  items: ComparisonItem[];
  totalEstimated: number;
  totalActual: number;
  overallVariance: number;
  overallVariancePct: number;
};

// ── Calculate budget breakdown ────────────────────────

export function calculateBudgetBreakdown(
  projectName: string,
  categories: { name: string; estimated: number; actual: number }[],
): BudgetBreakdown {
  const totalEstimated = categories.reduce((s, c) => s + c.estimated, 0);
  const totalActual = categories.reduce((s, c) => s + c.actual, 0);
  const variance = totalActual - totalEstimated;
  const variancePct =
    totalEstimated > 0 ? (variance / totalEstimated) * 100 : 0;

  let status: BudgetBreakdown["status"] = "on_budget";
  if (variancePct > 5) status = "over_budget";
  else if (variancePct < -5) status = "under_budget";

  return {
    projectName,
    totalEstimated,
    totalActual,
    categories: categories.map((c) => ({
      name: c.name,
      estimatedAmount: c.estimated,
      actualAmount: c.actual,
    })),
    variance,
    variancePct: Math.round(variancePct * 100) / 100,
    status,
  };
}

// ── Compare estimate vs actual ────────────────────────

export function compareEstimateVsActual(
  items: { category: string; estimated: number; actual: number }[],
): ComparisonResult {
  const comparedItems: ComparisonItem[] = items.map((item) => {
    const difference = item.actual - item.estimated;
    const percentDiff =
      item.estimated > 0 ? (difference / item.estimated) * 100 : 0;

    let status: ComparisonItem["status"] = "on_track";
    if (percentDiff > 10) status = "over";
    else if (percentDiff < -10) status = "under";

    return {
      category: item.category,
      estimated: item.estimated,
      actual: item.actual,
      difference,
      percentDiff: Math.round(percentDiff * 100) / 100,
      status,
    };
  });

  const totalEstimated = items.reduce((s, i) => s + i.estimated, 0);
  const totalActual = items.reduce((s, i) => s + i.actual, 0);
  const overallVariance = totalActual - totalEstimated;
  const overallVariancePct =
    totalEstimated > 0 ? (overallVariance / totalEstimated) * 100 : 0;

  return {
    items: comparedItems,
    totalEstimated,
    totalActual,
    overallVariance,
    overallVariancePct: Math.round(overallVariancePct * 100) / 100,
  };
}

// ── Generate budget report HTML ───────────────────────

export function generateBudgetReport(breakdown: BudgetBreakdown): string {
  const statusLabel = {
    under_budget: "予算内",
    on_budget: "予算通り",
    over_budget: "予算超過",
  }[breakdown.status];

  const statusColor = {
    under_budget: "#22c55e",
    on_budget: "#3b82f6",
    over_budget: "#ef4444",
  }[breakdown.status];

  const rows = breakdown.categories
    .map(
      (c) =>
        `<tr><td>${c.name}</td><td>¥${c.estimatedAmount.toLocaleString()}</td><td>¥${c.actualAmount.toLocaleString()}</td><td>¥${(c.actualAmount - c.estimatedAmount).toLocaleString()}</td></tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>予算レポート - ${breakdown.projectName}</title>
<style>
body{font-family:sans-serif;padding:2rem;max-width:800px;margin:0 auto}
table{width:100%;border-collapse:collapse;margin:1rem 0}
th,td{border:1px solid #ddd;padding:8px;text-align:right}
th{background:#f5f5f5}
td:first-child,th:first-child{text-align:left}
.status{display:inline-block;padding:4px 12px;border-radius:4px;color:#fff;font-weight:bold}
</style></head>
<body>
<h1>予算レポート: ${breakdown.projectName}</h1>
<p>ステータス: <span class="status" style="background:${statusColor}">${statusLabel}</span></p>
<table>
<thead><tr><th>カテゴリ</th><th>見積額</th><th>実績額</th><th>差額</th></tr></thead>
<tbody>
${rows}
</tbody>
<tfoot>
<tr><th>合計</th><th>¥${breakdown.totalEstimated.toLocaleString()}</th><th>¥${breakdown.totalActual.toLocaleString()}</th><th>¥${breakdown.variance.toLocaleString()}</th></tr>
</tfoot>
</table>
<p>差異率: ${breakdown.variancePct}%</p>
</body></html>`;
}
