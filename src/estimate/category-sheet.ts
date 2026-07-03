import extendedCostMaster from "./cost-master-extended.json";

type ExtendedItem = {
  item_id: string;
  name: string;
  unit: string;
  unit_price: number;
  price_range_low: number;
  price_range_high: number;
  subcategory: string;
  notes: string;
};

type ExtendedCategory = {
  id: string;
  name: string;
  items: ExtendedItem[];
};

type ExtendedCostMaster = {
  categories: ExtendedCategory[];
};

const master = extendedCostMaster as ExtendedCostMaster;

const sheetTitleMap: Record<string, string> = {
  scaffolding: "仮設工事 明細シート",
  plastering: "左官工事 明細シート",
};

function findCategory(categoryId: string): ExtendedCategory {
  const category = master.categories.find((entry) => entry.id === categoryId);
  if (!category) {
    throw new Error(`カテゴリ ${categoryId} が見つかりません`);
  }
  return category;
}

export function formatCategorySheetMarkdown(categoryId: string): string {
  const category = findCategory(categoryId);
  const title = sheetTitleMap[categoryId] ?? `${category.name} 明細シート`;
  const lines = [
    `# ${title}`,
    "",
    `- 区分: ${category.name}`,
    "- 単価基準: 東京都心 2025-2026年相場",
    "- 用途: カテゴリ単位で明細をすぐ引くための抜粋シート",
    "",
    "| コード | 品目 | 細目 | 単位 | 標準単価 | 価格帯 | 備考 |",
    "|---|---|---|---|---:|---|---|",
    ...category.items.map((item) =>
      `| ${item.item_id} | ${item.name} | ${item.subcategory} | ${item.unit} | ${item.unit_price.toLocaleString("ja-JP")} | ${item.price_range_low.toLocaleString("ja-JP")}~${item.price_range_high.toLocaleString("ja-JP")} | ${item.notes} |`,
    ),
  ];
  return lines.join("\n");
}

export function formatCategorySheetCSV(categoryId: string): string {
  const category = findCategory(categoryId);
  const rows = [
    "コード,品目,細目,単位,標準単価,価格帯下限,価格帯上限,備考",
    ...category.items.map((item) =>
      [
        item.item_id,
        item.name,
        item.subcategory,
        item.unit,
        item.unit_price,
        item.price_range_low,
        item.price_range_high,
        item.notes.replaceAll('"', '""'),
      ]
        .map((value) => `"${String(value)}"`)
        .join(","),
    ),
  ];
  return rows.join("\n");
}
