/**
 * Discord向け見積フォーマッター
 *
 * 自然言語テキスト → NLパーサー → 見積生成 → Discord Markdown出力
 *
 * 使用例:
 *   const result = discordEstimate("6畳の壁紙張替え");
 *   // → Discordに貼れるMarkdownテーブル文字列
 */

import { parseNaturalLanguage } from "./nl-estimate-parser";
import { generateEstimate } from "./estimate-generator";
import type { CostMaster, Estimate, EstimateInput } from "./types";
import type { ParseResult } from "./nl-estimate-parser";
import { calculateConfidence, scoreToStars } from "../lib/confidence-scorer";
import { detectAnomalies } from "../lib/anomaly-detector";
import costMasterData from "./cost-master.json";

/** Discord出力結果 */
export type DiscordEstimateResult = {
  /** Discord用Markdown文字列 */
  message: string;
  /** 生成された見積オブジェクト（パース失敗時はnull） */
  estimate: Estimate | null;
  /** パース結果 (デバッグ用) */
  parseResult: ParseResult;
};

type WorkTimingAdjustment = {
  assumptionLabel: string;
  comparisonLabel: string;
  comparisonDeltaYen: number;
};

const DAY_NIGHT_DELTA_YEN = 140000;
const PAINT_PRICE_INFLATION_FACTOR = 1.22;
const HEAVY_PREP_FACTOR = 1.12;
const STEEL_AREA_RATIO = 0.35;
const LABOR_DAY_RATE_YEN = 35000;
const LABOR_COST_FACTOR = 1.1;
const PAINTING_CODES = new Set(["IN-007", "IN-020", "RN-014", "RN-015", "PL2-012"]);
const EXTERIOR_PAINTING_CODES = new Set(["RN-014", "RN-015"]);
const costMaster: CostMaster = costMasterData as CostMaster;

type PricingAdjustment = {
  items: EstimateInput[];
  managementFeeRate: number;
  generalExpenseRate: number;
  notes: string[];
  assumptionLines: string[];
};

function detectWorkTimingAdjustment(text: string): WorkTimingAdjustment | null {
  const normalized = text.replace(/\s+/g, "");
  const isNightWork = /(夜間|深夜|閉店後|営業終了後|営業時間外)/.test(normalized);
  const isDayWork = /(日中|昼間|営業時間内)/.test(normalized);

  if (isNightWork) {
    return {
      assumptionLabel: "営業終了後の夜間工事想定",
      comparisonLabel: "日中施工に切替時の目安調整",
      comparisonDeltaYen: -DAY_NIGHT_DELTA_YEN,
    };
  }

  if (isDayWork) {
    return {
      assumptionLabel: "日中工事想定",
      comparisonLabel: "夜間施工に切替時の目安調整",
      comparisonDeltaYen: DAY_NIGHT_DELTA_YEN,
    };
  }

  return null;
}

function sanitizeUnmatched(unmatched: string[]): string[] {
  return unmatched.filter((phrase) => {
    const normalized = phrase.replace(/\s+/g, "");
    return normalized.length > 0 && !/^(夜間|深夜|閉店後|営業終了後|営業時間外|日中|昼間|営業時間内)$/.test(normalized);
  });
}

function detectHighScrutinyPricing(text: string): boolean {
  return /(高い精査|高め精査|精査|値上がり|副資材|塗料|研磨|ケレン|錆止め|さび止め|鉄部|手間|丁寧|工数|人件費|日当|原価)/.test(text);
}

function detectSteelScope(text: string): boolean {
  return /(鉄部|手すり|門扉|階段|シャッター|鉄骨|鋼製|架台)/.test(text);
}

function detectLaborCostPressure(text: string): boolean {
  return /(工数|人件費|日当|人工|原価|職人)/.test(text);
}

function findUnitPrice(code: string): number {
  for (const category of costMaster.categories) {
    const item = category.items.find((candidate) => candidate.code === code);
    if (item) return item.unitPrice;
  }
  throw new Error(`品目コード ${code} が見つかりません`);
}

function buildPricingAdjustment(parseResult: ParseResult): PricingAdjustment {
  const baseItems: EstimateInput[] = parseResult.items.map(({ code, quantity }) => ({
    code,
    quantity,
  }));

  if (!detectHighScrutinyPricing(parseResult.originalText)) {
    return {
      items: baseItems,
      managementFeeRate: 0.1,
      generalExpenseRate: 0.05,
      notes: [],
      assumptionLines: [],
    };
  }

  const paintBaseQty = Math.max(
    0,
    ...parseResult.items
      .filter((item) => PAINTING_CODES.has(item.code))
      .map((item) => item.quantity),
  );

  const items: EstimateInput[] = baseItems.map((item) => {
    let factor = 1;
    if (PAINTING_CODES.has(item.code)) {
      factor = item.code === "RN-015"
        ? PAINT_PRICE_INFLATION_FACTOR
        : PAINT_PRICE_INFLATION_FACTOR * HEAVY_PREP_FACTOR;
    }
    if (detectLaborCostPressure(parseResult.originalText)) {
      factor *= LABOR_COST_FACTOR;
    }
    if (factor === 1) return item;
    return {
      ...item,
      unitPriceOverride: Math.round(findUnitPrice(item.code) * factor / 10) * 10,
    };
  });

  const notes = [
    "高め精査: 塗料・副資材の直近値上がりと手間増を反映",
    "高め精査: 現場管理費12%・一般管理費8%で仮計上",
  ];
  const assumptionLines = [
    "前提: 塗料・副資材の値上がりを見込み、塗装系単価を上振れ補正",
    "前提: 手間重視の下地調整を想定し、管理費率も標準より上げて仮計上",
  ];

  if (detectLaborCostPressure(parseResult.originalText)) {
    notes.push(`高め精査: 原価側の職人日当を ${formatYen(LABOR_DAY_RATE_YEN)} 想定で材工単価へ反映`);
    assumptionLines.push(`前提: 工数は原価側の職人日当 ${formatYen(LABOR_DAY_RATE_YEN)} 想定で材工単価を約${Math.round((LABOR_COST_FACTOR - 1) * 100)}%上振れ`);
  }

  if (paintBaseQty > 0 && detectSteelScope(parseResult.originalText)) {
    const steelQty = Math.max(1, Math.ceil(paintBaseQty * STEEL_AREA_RATIO));
    items.push({ code: "RN-031", quantity: steelQty });
    items.push({ code: "RN-032", quantity: steelQty });
    notes.push(`高め精査: 鉄部は塗装対象の${Math.round(STEEL_AREA_RATIO * 100)}%相当でケレン・錆止めを追加`);
    assumptionLines.push(`前提: 鉄部は塗装対象面積の${Math.round(STEEL_AREA_RATIO * 100)}%相当でケレン・錆止めを別計上`);
  }

  const hasExteriorPainting = items.some((item) => EXTERIOR_PAINTING_CODES.has(item.code));
  if (hasExteriorPainting && !items.some((item) => item.code === "RN-016")) {
    items.push({ code: "RN-016", quantity: paintBaseQty || 1 });
    items.push({ code: "SC-006", quantity: 1 });
    items.push({ code: "SC-007", quantity: 1 });
    notes.push("高め精査: 外部塗装の足場・組立解体・運搬を追加");
    assumptionLines.push("前提: 外部塗装は足場別途扱いのため、足場・組立解体・運搬を追加");
  }

  return {
    items,
    managementFeeRate: 0.12,
    generalExpenseRate: 0.08,
    notes,
    assumptionLines,
  };
}

/** 金額を3桁カンマ区切りで表示 */
function formatYen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

/**
 * パース結果のサマリー行を生成（面積検出情報など）
 */
function formatDetectionLine(result: ParseResult): string {
  if (result.detectedTatami) {
    const sqm = (result.detectedTatami * 1.62).toFixed(1);
    return `${result.detectedTatami}畳 (${sqm}m\u00B2)`;
  }
  if (result.detectedArea) {
    return `${result.detectedArea.sqm.toFixed(1)}m\u00B2`;
  }
  return "面積指定なし (デフォルト10m\u00B2)";
}

/**
 * 見積をDiscord Markdown形式にフォーマット
 */
export function formatEstimateForDiscord(
  estimate: Estimate,
  parseResult: ParseResult,
  assumptionLines: string[] = [],
): string {
  const lines: string[] = [];
  const workTiming = detectWorkTimingAdjustment(parseResult.originalText);

  // ヘッダー
  lines.push(`## \uD83D\uDCCB 概算見積`);
  lines.push(`> ${parseResult.originalText}`);
  lines.push(`> 検出: ${formatDetectionLine(parseResult)}`);
  if (workTiming) {
    lines.push(`> 条件: ${workTiming.assumptionLabel}`);
  }
  for (const assumption of assumptionLines) {
    lines.push(`> ${assumption}`);
  }
  lines.push("");

  // 確信度スコア計算用のオプション
  const hasExplicitArea = !!(parseResult.detectedTatami || parseResult.detectedArea);
  const detectedAreaSqm = parseResult.detectedArea?.sqm ?? null;
  const hasUnmatched = parseResult.unmatched.length > 0;

  // ParsedEstimateItem の code → confidence マップ
  const confidenceMap = new Map<string, string>();
  for (const item of parseResult.items) {
    const score = calculateConfidence(item, { hasExplicitArea, detectedAreaSqm, hasUnmatched });
    confidenceMap.set(item.code, scoreToStars(score));
  }

  // 異常検出
  const alerts = detectAnomalies(parseResult.items, {
    totalAmount: estimate.total,
    areaSqm: detectedAreaSqm ?? undefined,
  });

  // 明細テーブル
  lines.push("| 品目 | 数量 | 単価 | 金額 | 確信度 |");
  lines.push("|:-----|-----:|-----:|-----:|:------:|");

  for (const section of estimate.sections) {
    // セクションヘッダー行
    lines.push(`| **${section.categoryName}** | | | | |`);
    for (const line of section.lines) {
      // セクション内品目に対応するコードを items から逆引き
      const matchedItem = parseResult.items.find((i) => i.itemName === line.name);
      const stars = matchedItem ? (confidenceMap.get(matchedItem.code) ?? "★★★☆☆") : "★★★☆☆";
      lines.push(
        `| ${line.name} | ${line.quantity}${line.unit} | ${formatYen(line.unitPrice)} | ${formatYen(line.amount)} | ${stars} |`,
      );
    }
  }

  lines.push("");

  // 集計
  lines.push("```");
  lines.push(`直接工事費         ${formatYen(estimate.directCost)}`);
  lines.push(`現場管理費(${(estimate.managementFeeRate * 100).toFixed(0)}%)    ${formatYen(estimate.managementFee)}`);
  lines.push(`一般管理費(${(estimate.generalExpenseRate * 100).toFixed(0)}%)     ${formatYen(estimate.generalExpense)}`);
  lines.push(`─────────────────────────`);
  lines.push(`税抜合計           ${formatYen(estimate.subtotal)}`);
  lines.push(`消費税(${(estimate.taxRate * 100).toFixed(0)}%)        ${formatYen(estimate.tax)}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`税込合計           ${formatYen(estimate.total)}`);
  lines.push("```");

  if (workTiming) {
    const deltaPrefix = workTiming.comparisonDeltaYen > 0 ? "+" : "-";
    lines.push("");
    lines.push(`> ${workTiming.comparisonLabel}: ${deltaPrefix}${formatYen(Math.abs(workTiming.comparisonDeltaYen)).slice(1)} 程度`);
  }

  // 未マッチ警告
  if (parseResult.unmatched.length > 0) {
    lines.push("");
    lines.push(
      `> \u26A0\uFE0F 未対応: ${parseResult.unmatched.map((u) => `「${u}」`).join("、")}`,
    );
  }

  // 異常検出アラート
  if (alerts.length > 0) {
    lines.push("");
    for (const alert of alerts) {
      lines.push(`> \u26A0\uFE0F ${alert.message}`);
    }
  }

  // フッター
  lines.push("");
  lines.push("-# \uD83C\uDFD7\uFE0F ラポルタ概算見積AI | 正式見積は別途ご依頼ください");

  return lines.join("\n");
}

/** Discord Botへの返答ペイロード */
export type DiscordReplyPayload = {
  /** 返答Markdown文字列 */
  content: string;
  /** 見積が生成された場合は見積データ、失敗時はnull */
  estimate: DiscordEstimateResult["estimate"] | null;
  /** 処理成功フラグ */
  ok: boolean;
};

/**
 * Discord Botがメッセージを受け取って見積を処理するハンドラー
 *
 * トリガーパターン:
 *   「見積」「見積もり」「estimate」「いくら」「費用」「工事」などを含むメッセージ
 *
 * @param message - Discordから届いた生テキスト
 * @returns 返答ペイロード（content をそのままDiscordに送れる）
 */
export function handleDiscordEstimateMessage(message: string): DiscordReplyPayload {
  const trimmed = message.trim();

  if (!trimmed) {
    return {
      content: "メッセージが空です。例: 「6畳の壁紙張替え」「20m²のタイルカーペット張替えとLED照明10台」",
      estimate: null,
      ok: false,
    };
  }

  const result = discordEstimate(trimmed);

  return {
    content: result.message,
    estimate: result.estimate ?? null,
    ok: result.estimate != null,
  };
}

/**
 * Discordメッセージが見積依頼かどうか判定
 *
 * @param message - Discordから届いた生テキスト
 * @returns 見積依頼と判定した場合はtrue
 */
export function isEstimateRequest(message: string): boolean {
  const lower = message.toLowerCase();
  const triggers = [
    "見積", "見積もり", "みつもり",
    "estimate", "いくら", "費用", "値段", "価格",
    "工事", "張替", "はりかえ", "リノベ", "解体",
    "壁紙", "フローリング", "タイル", "照明", "エアコン",
    "内装", "塗装",
  ];
  return triggers.some((t) => lower.includes(t) || message.includes(t));
}

/**
 * 自然言語テキストからDiscord用見積メッセージを一発生成
 *
 * @param text - "6畳の壁紙張替え" 等の自然言語テキスト
 * @param propertyName - 物件名 (省略時はテキストから生成)
 * @returns Discord用Markdown文字列と見積データ
 */
export function discordEstimate(
  text: string,
  propertyName?: string,
): DiscordEstimateResult {
  // 1. NLパース
  const parseResult = parseNaturalLanguage(text, {
    includeProtection: false,
    includeCleaning: false,
  });
  parseResult.unmatched = sanitizeUnmatched(parseResult.unmatched);
  const workTiming = detectWorkTimingAdjustment(text);

  // パースで品目が0件の場合
  if (parseResult.items.length === 0) {
    return {
      message: `## \uD83D\uDCCB 概算見積\n> ${text}\n\n\u274C 工事内容を特定できませんでした。\n例: 「6畳の壁紙張替え」「20m\u00B2のタイルカーペット張替えとLED照明10台」\n\n-# \uD83C\uDFD7\uFE0F ラポルタ概算見積AI`,
      estimate: null,
      parseResult,
    };
  }

  // 2. 高め精査条件があれば単価・諸経費・追加工程を補正
  const pricing = buildPricingAdjustment(parseResult);

  // 3. 見積生成
  const estimate = generateEstimate({
    propertyName: propertyName ?? `概算: ${text.slice(0, 30)}`,
    clientName: "Discord見積",
    items: pricing.items,
    managementFeeRate: pricing.managementFeeRate,
    generalExpenseRate: pricing.generalExpenseRate,
    notes: workTiming
      ? [
          `${workTiming.assumptionLabel}`,
          `${workTiming.comparisonLabel}: ${workTiming.comparisonDeltaYen > 0 ? "+" : "-"}${formatYen(Math.abs(workTiming.comparisonDeltaYen)).slice(1)} 程度`,
          ...pricing.notes,
        ]
      : pricing.notes,
  });

  // 4. Discord Markdown にフォーマット
  const message = formatEstimateForDiscord(estimate, parseResult, pricing.assumptionLines);

  return { message, estimate, parseResult };
}
