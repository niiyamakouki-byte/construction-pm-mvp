/** 複数案シミュレーション（松竹梅見積）ライブラリ — ATLUS蒸留 */

import { escapeHtml } from "./utils/escape-html.js";

// ── Types ────────────────────────────────────────────────────────────────────

/** 松竹梅グレード */
export type EstimateGrade = "economy" | "standard" | "premium";

/** シナリオ品目 */
export type ScenarioItem = {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  grade: EstimateGrade;
  note?: string;
  /** このアイテムが代替元アイテム名を参照する場合 */
  alternativeOf?: string;
};

/** シナリオ（見積案1本） */
export type Scenario = {
  id: string;
  name: string;
  grade: EstimateGrade;
  items: ScenarioItem[];
  subtotal: number;
  overhead: number;
  total: number;
  totalWithTax: number;
  description?: string;
};

/** 品目ごとのグレード横断比較 */
export type ScenarioComparison = {
  itemName: string;
  economy?: { unitPrice: number; amount: number };
  standard?: { unitPrice: number; amount: number };
  premium?: { unitPrice: number; amount: number };
  /** standardとeconomyの差額（savings = standard.amount - economy.amount） */
  savings: number;
  note?: string;
};

/** 複数案シミュレーション結果 */
export type MultiScenarioResult = {
  projectName: string;
  scenarios: Scenario[];
  comparisons: ScenarioComparison[];
  recommendation?: EstimateGrade;
  createdAt: Date;
};

/** シナリオ差分 */
export type ScenarioDiff = {
  onlyInA: ScenarioItem[];
  onlyInB: ScenarioItem[];
  inBoth: {
    name: string;
    unitPriceA: number;
    unitPriceB: number;
    amountA: number;
    amountB: number;
    priceDiff: number;
  }[];
  totalDiff: number;
};

// ── Constants ────────────────────────────────────────────────────────────────

const TAX_RATE = 0.1;
const DEFAULT_OVERHEAD_RATE = 0.1;

const GRADE_LABELS: Record<EstimateGrade, string> = {
  economy: "松（エコノミー）",
  standard: "竹（スタンダード）",
  premium: "梅（プレミアム）",
};

const GRADE_COLORS: Record<EstimateGrade, string> = {
  economy: "#e8f5e9",
  standard: "#e3f2fd",
  premium: "#fce4ec",
};

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * シナリオを作成し、小計・諸経費・合計・税込合計を自動計算する
 */
export function createScenario(
  name: string,
  grade: EstimateGrade,
  items: Omit<ScenarioItem, "amount" | "grade">[],
  overheadRate: number = DEFAULT_OVERHEAD_RATE,
  options?: { id?: string; description?: string },
): Scenario {
  const scenarioItems: ScenarioItem[] = items.map((item) => ({
    ...item,
    grade,
    amount: item.unitPrice * item.quantity,
  }));

  const subtotal = scenarioItems.reduce((s, i) => s + i.amount, 0);
  const overhead = Math.round(subtotal * overheadRate);
  const total = subtotal + overhead;
  const totalWithTax = Math.round(total * (1 + TAX_RATE));

  return {
    id: options?.id ?? `${grade}-${Date.now()}`,
    name,
    grade,
    items: scenarioItems,
    subtotal,
    overhead,
    total,
    totalWithTax,
    description: options?.description,
  };
}

/**
 * 複数シナリオをまとめて MultiScenarioResult を生成する（比較表を自動生成）
 */
export function createMultiScenario(
  projectName: string,
  scenarios: Scenario[],
  recommendation?: EstimateGrade,
): MultiScenarioResult {
  const comparisons = generateComparisons(scenarios);
  const rec = recommendation ?? recommendScenario(scenarios).grade;

  return {
    projectName,
    scenarios,
    comparisons,
    recommendation: rec,
    createdAt: new Date(),
  };
}

/**
 * シナリオ群から品目ごとの横断比較を生成する
 */
export function generateComparisons(scenarios: Scenario[]): ScenarioComparison[] {
  // 全品目名を収集（order保持）
  const allNames = Array.from(
    new Set(scenarios.flatMap((s) => s.items.map((i) => i.name))),
  );

  return allNames.map((itemName) => {
    const comparison: ScenarioComparison = { itemName, savings: 0 };

    for (const scenario of scenarios) {
      const item = scenario.items.find((i) => i.name === itemName);
      if (item) {
        comparison[scenario.grade] = {
          unitPrice: item.unitPrice,
          amount: item.amount,
        };
      }
    }

    // savings = standard.amount - economy.amount（差が分かりやすい軸）
    const stdAmount = comparison.standard?.amount ?? 0;
    const ecoAmount = comparison.economy?.amount ?? 0;
    comparison.savings = stdAmount - ecoAmount;

    return comparison;
  });
}

/**
 * 2つのシナリオの詳細差分を返す
 */
export function getScenarioDiff(scenarioA: Scenario, scenarioB: Scenario): ScenarioDiff {
  const namesA = new Set(scenarioA.items.map((i) => i.name));
  const namesB = new Set(scenarioB.items.map((i) => i.name));

  const onlyInA = scenarioA.items.filter((i) => !namesB.has(i.name));
  const onlyInB = scenarioB.items.filter((i) => !namesA.has(i.name));

  const commonNames = scenarioA.items
    .map((i) => i.name)
    .filter((n) => namesB.has(n));

  const inBoth = commonNames.map((name) => {
    const itemA = scenarioA.items.find((i) => i.name === name)!;
    const itemB = scenarioB.items.find((i) => i.name === name)!;
    return {
      name,
      unitPriceA: itemA.unitPrice,
      unitPriceB: itemB.unitPrice,
      amountA: itemA.amount,
      amountB: itemB.amount,
      priceDiff: itemB.unitPrice - itemA.unitPrice,
    };
  });

  const totalDiff = scenarioB.total - scenarioA.total;

  return { onlyInA, onlyInB, inBoth, totalDiff };
}

/**
 * 予算に基づいてシナリオを推薦する。
 * 予算指定なしの場合は standard を推薦（竹の原則）。
 */
export function recommendScenario(
  scenarios: Scenario[],
  budget?: number,
): { grade: EstimateGrade; scenario: Scenario | undefined; reason: string } {
  if (scenarios.length === 0) {
    return { grade: "standard", scenario: undefined, reason: "シナリオなし" };
  }

  if (budget === undefined) {
    const std = scenarios.find((s) => s.grade === "standard");
    return {
      grade: "standard",
      scenario: std,
      reason: "予算指定なし：スタンダードを推薦",
    };
  }

  // 予算内で最も高品質なシナリオ
  const gradeOrder: EstimateGrade[] = ["premium", "standard", "economy"];
  for (const grade of gradeOrder) {
    const scenario = scenarios.find((s) => s.grade === grade && s.totalWithTax <= budget);
    if (scenario) {
      return {
        grade,
        scenario,
        reason: `予算${budget.toLocaleString()}円以内：${GRADE_LABELS[grade]}を推薦`,
      };
    }
  }

  // 全て予算超過の場合は最安を推薦
  const cheapest = [...scenarios].sort((a, b) => a.totalWithTax - b.totalWithTax)[0];
  return {
    grade: cheapest.grade,
    scenario: cheapest,
    reason: `全案が予算超過：最安の${GRADE_LABELS[cheapest.grade]}を推薦`,
  };
}

// ── HTML / Export ─────────────────────────────────────────────────────────────

/**
 * 松竹梅横断比較の印刷用 HTML テーブルを生成する
 */
export function buildComparisonTableHtml(result: MultiScenarioResult): string {
  const { projectName, scenarios, comparisons } = result;

  const gradeOrder: EstimateGrade[] = ["economy", "standard", "premium"];
  const presentGrades = gradeOrder.filter((g) => scenarios.some((s) => s.grade === g));

  const headerCols = presentGrades
    .map(
      (g) =>
        `<th style="background:${GRADE_COLORS[g]};padding:8px;text-align:center">${escapeHtml(GRADE_LABELS[g])}</th>`,
    )
    .join("");

  const rows = comparisons
    .map((cmp) => {
      const cells = presentGrades
        .map((g) => {
          const val = cmp[g];
          if (!val) return `<td style="padding:8px;text-align:right;color:#999">—</td>`;
          return `<td style="padding:8px;text-align:right">${val.amount.toLocaleString()}円<br><small>${val.unitPrice.toLocaleString()}円/単位</small></td>`;
        })
        .join("");
      return `<tr><td style="padding:8px">${escapeHtml(cmp.itemName)}</td>${cells}</tr>`;
    })
    .join("\n");

  const totalRow = presentGrades
    .map((g) => {
      const scenario = scenarios.find((s) => s.grade === g);
      if (!scenario) return `<td style="padding:8px;text-align:right">—</td>`;
      return `<td style="padding:8px;text-align:right;font-weight:bold">${scenario.totalWithTax.toLocaleString()}円<br><small>（税込）</small></td>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>${escapeHtml(projectName)} — 松竹梅見積比較</title>
<style>body{font-family:sans-serif;margin:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd}h1{font-size:18px}</style>
</head>
<body>
<h1>${escapeHtml(projectName)} — 見積案比較（松竹梅）</h1>
<table>
  <thead>
    <tr><th style="padding:8px">品目</th>${headerCols}</tr>
  </thead>
  <tbody>
${rows}
  </tbody>
  <tfoot>
    <tr style="background:#f5f5f5"><td style="padding:8px;font-weight:bold">税込合計</td>${totalRow}</tr>
  </tfoot>
</table>
</body>
</html>`;
}

/**
 * 1シナリオの詳細 HTML を生成する
 */
export function buildScenarioDetailHtml(scenario: Scenario): string {
  const itemRows = scenario.items
    .map(
      (item) =>
        `<tr>
      <td style="padding:6px">${escapeHtml(item.name)}</td>
      <td style="padding:6px;text-align:center">${escapeHtml(item.unit)}</td>
      <td style="padding:6px;text-align:right">${item.quantity.toLocaleString()}</td>
      <td style="padding:6px;text-align:right">${item.unitPrice.toLocaleString()}円</td>
      <td style="padding:6px;text-align:right">${item.amount.toLocaleString()}円</td>
      <td style="padding:6px">${escapeHtml(item.note ?? "")}</td>
    </tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>${escapeHtml(scenario.name)}</title>
<style>body{font-family:sans-serif;margin:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd}h1{font-size:18px}h2{font-size:15px}</style>
</head>
<body>
<h1>${escapeHtml(scenario.name)}</h1>
<p>${escapeHtml(GRADE_LABELS[scenario.grade])}</p>
${scenario.description ? `<p>${escapeHtml(scenario.description)}</p>` : ""}
<table>
  <thead>
    <tr>
      <th style="padding:6px">品目</th>
      <th style="padding:6px">単位</th>
      <th style="padding:6px;text-align:right">数量</th>
      <th style="padding:6px;text-align:right">単価</th>
      <th style="padding:6px;text-align:right">金額</th>
      <th style="padding:6px">備考</th>
    </tr>
  </thead>
  <tbody>
${itemRows}
  </tbody>
  <tfoot>
    <tr><td colspan="4" style="padding:6px;text-align:right;font-weight:bold">小計</td><td style="padding:6px;text-align:right">${scenario.subtotal.toLocaleString()}円</td><td></td></tr>
    <tr><td colspan="4" style="padding:6px;text-align:right">諸経費</td><td style="padding:6px;text-align:right">${scenario.overhead.toLocaleString()}円</td><td></td></tr>
    <tr><td colspan="4" style="padding:6px;text-align:right;font-weight:bold">合計（税抜）</td><td style="padding:6px;text-align:right">${scenario.total.toLocaleString()}円</td><td></td></tr>
    <tr style="background:#f5f5f5"><td colspan="4" style="padding:6px;text-align:right;font-weight:bold">税込合計</td><td style="padding:6px;text-align:right;font-weight:bold">${scenario.totalWithTax.toLocaleString()}円</td><td></td></tr>
  </tfoot>
</table>
</body>
</html>`;
}

/**
 * 比較結果を CSV にエクスポートする
 */
export function exportComparisonCSV(result: MultiScenarioResult): string {
  const { projectName, scenarios, comparisons } = result;

  const gradeOrder: EstimateGrade[] = ["economy", "standard", "premium"];
  const presentGrades = gradeOrder.filter((g) => scenarios.some((s) => s.grade === g));

  const headerGrades = presentGrades
    .flatMap((g) => [`${GRADE_LABELS[g]}_単価`, `${GRADE_LABELS[g]}_金額`])
    .join(",");

  const header = `プロジェクト,品目,${headerGrades},差額(標準-松)\n`;

  const dataRows = comparisons
    .map((cmp) => {
      const gradeCols = presentGrades
        .flatMap((g) => {
          const val = cmp[g];
          return val ? [String(val.unitPrice), String(val.amount)] : ["", ""];
        })
        .join(",");
      return `${csvEscape(projectName)},${csvEscape(cmp.itemName)},${gradeCols},${cmp.savings}`;
    })
    .join("\n");

  const totalRow = presentGrades
    .flatMap((g) => {
      const s = scenarios.find((sc) => sc.grade === g);
      return s ? ["", String(s.totalWithTax)] : ["", ""];
    })
    .join(",");

  const footerRow = `${csvEscape(projectName)},税込合計,${totalRow},`;

  return header + dataRows + "\n" + footerRow + "\n";
}

/** CSV セル用エスケープ */
function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ── Scenario manipulation ─────────────────────────────────────────────────────

/**
 * シナリオをクローンし、全単価に乗数を掛ける（松竹梅の素早い生成に便利）
 */
export function cloneScenario(
  scenario: Scenario,
  newGrade: EstimateGrade,
  priceMultiplier: number,
  options?: { id?: string; name?: string; description?: string },
): Scenario {
  const items: Omit<ScenarioItem, "amount" | "grade">[] = scenario.items.map((item) => ({
    name: item.name,
    unit: item.unit,
    quantity: item.quantity,
    unitPrice: Math.round(item.unitPrice * priceMultiplier),
    note: item.note,
    alternativeOf: item.alternativeOf,
  }));

  // Find original overhead rate
  const overheadRate = scenario.subtotal > 0 ? scenario.overhead / scenario.subtotal : DEFAULT_OVERHEAD_RATE;

  return createScenario(
    options?.name ?? `${scenario.name}（${GRADE_LABELS[newGrade]}）`,
    newGrade,
    items,
    overheadRate,
    {
      id: options?.id ?? `${newGrade}-${Date.now()}`,
      description: options?.description ?? scenario.description,
    },
  );
}

/**
 * ベースアイテムにアップグレードアイテムをマージする。
 * 同名アイテムはアップグレード側で上書き。新規アイテムは追加。
 */
export function mergeScenarioItems(
  baseItems: ScenarioItem[],
  upgradeItems: ScenarioItem[],
): ScenarioItem[] {
  const result = [...baseItems];

  for (const upgrade of upgradeItems) {
    const idx = result.findIndex((b) => b.name === upgrade.name);
    if (idx >= 0) {
      result[idx] = upgrade;
    } else {
      result.push(upgrade);
    }
  }

  return result;
}
