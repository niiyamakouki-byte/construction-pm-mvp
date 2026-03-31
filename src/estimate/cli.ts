#!/usr/bin/env npx tsx
/**
 * 見積書生成CLI
 *
 * Usage:
 *   npx tsx src/estimate/cli.ts --property "南青山ビル3F" --client "○○株式会社" \
 *     --item DM-001:50 --item IN-005:120 --item EL-005:10 \
 *     --format text
 *
 * Options:
 *   --property   物件名 (required)
 *   --client     宛先 (required)
 *   --item       品目コード:数量 (repeatable)
 *   --format     text | csv | json (default: text)
 *   --mgmt-rate  現場管理費率 (default: 0.10)
 *   --gen-rate   一般管理費率 (default: 0.05)
 *   --list       品目一覧を表示
 *   --list-cat   カテゴリ指定で品目一覧を表示
 */

import { generateEstimate, listAllItems, listCategories, listItemsByCategory } from "./estimate-generator";
import { formatEstimateText, formatEstimateCSV, formatEstimateJSON } from "./format-estimate";
import type { EstimateInput } from "./types";

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function getAllArgs(name: string): string[] {
  const results: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === `--${name}` && i + 1 < args.length) {
      results.push(args[i + 1]);
    }
  }
  return results;
}

// 品目一覧表示
if (args.includes("--list")) {
  const catId = getArg("list-cat");
  if (catId) {
    const items = listItemsByCategory(catId);
    console.log(`\n■ ${catId} の品目一覧:\n`);
    for (const item of items) {
      console.log(`  ${item.code}  ${item.name.padEnd(24)} ${item.unit.padEnd(4)} ¥${item.unitPrice.toLocaleString()}`);
    }
  } else {
    const cats = listCategories();
    console.log("\n■ カテゴリ一覧:\n");
    for (const cat of cats) {
      console.log(`  ${cat.id.padEnd(14)} ${cat.name} (${cat.itemCount}品目)`);
    }
    console.log("\n■ 全品目一覧:\n");
    const items = listAllItems();
    for (const item of items) {
      console.log(`  ${item.code}  ${item.name.padEnd(24)} ${item.unit.padEnd(4)} ¥${item.unitPrice.toLocaleString()}  [${item.categoryName}]`);
    }
  }
  process.exit(0);
}

// 見積生成
const property = getArg("property");
const client = getArg("client");
const format = getArg("format") ?? "text";
const mgmtRate = parseFloat(getArg("mgmt-rate") ?? "0.10");
const genRate = parseFloat(getArg("gen-rate") ?? "0.05");
const itemArgs = getAllArgs("item");

if (!property || !client || itemArgs.length === 0) {
  console.error("Usage: npx tsx src/estimate/cli.ts --property <物件名> --client <宛先> --item <コード:数量> [--item ...]");
  console.error("       npx tsx src/estimate/cli.ts --list");
  process.exit(1);
}

const items: EstimateInput[] = itemArgs.map((arg) => {
  const [code, qtyStr, priceStr] = arg.split(":");
  return {
    code,
    quantity: parseInt(qtyStr, 10),
    unitPriceOverride: priceStr ? parseInt(priceStr, 10) : undefined,
  };
});

const estimate = generateEstimate({
  propertyName: property,
  clientName: client,
  items,
  managementFeeRate: mgmtRate,
  generalExpenseRate: genRate,
});

switch (format) {
  case "csv":
    console.log(formatEstimateCSV(estimate));
    break;
  case "json":
    console.log(formatEstimateJSON(estimate));
    break;
  default:
    console.log(formatEstimateText(estimate));
}
