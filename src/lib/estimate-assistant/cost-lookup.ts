/**
 * AI見積アシスタント — コストマスター検索・レンジ計算
 *
 * cost-master.json の category × keyword フィルタから
 * 松竹梅レンジ（低/標準/高）を算出する。
 * 消費税10%込み。LLM不使用。
 */

import type { EstimateIntent, RoomType } from "./intent-parser.js";
import { convertToSqM } from "./intent-parser.js";

// ── cost-master 型定義 ────────────────────────────────────────────────────────

export type CostMasterItem = {
  code: string;
  name: string;
  unit: string;
  unitPrice: number;
  note?: string;
};

export type CostMasterCategory = {
  id: string;
  name: string;
  items: CostMasterItem[];
};

export type CostMaster = {
  version: string;
  updatedAt: string;
  currency: string;
  taxRate: number;
  categories: CostMasterCategory[];
};

// ── 出力型 ───────────────────────────────────────────────────────────────────

export type EstimateRangeItem = {
  name: string;
  unit: string;
  qty: number;
  unitPriceLow: number;
  unitPriceMid: number;
  unitPriceHigh: number;
  subtotalLow: number;
  subtotalMid: number;
  subtotalHigh: number;
};

export type EstimateRange = {
  items: EstimateRangeItem[];
  totalLow: number;
  totalMid: number;
  totalHigh: number;
  taxIncludedLow: number;
  taxIncludedMid: number;
  taxIncludedHigh: number;
};

// ── ルームタイプ → カテゴリ + キーワードマッピング ─────────────────────────

type CategoryMatch = {
  categoryIds: string[];
  keywords: string[];
};

const ROOM_TO_CATEGORY: Record<RoomType, CategoryMatch> = {
  LDK: {
    categoryIds: ["interior", "fixtures", "electrical", "woodwork"],
    keywords: ["クロス", "フローリング", "照明", "コンセント", "間仕切り"],
  },
  和室: {
    categoryIds: ["wagshitsu", "interior"],
    keywords: ["畳", "障子", "襖", "和室"],
  },
  寝室: {
    categoryIds: ["interior", "fixtures"],
    keywords: ["クロス", "フローリング", "建具"],
  },
  水回り: {
    categoryIds: ["plumbing", "interior", "stone_tile"],
    keywords: ["洗面", "キッチン", "給排水", "タイル"],
  },
  外壁: {
    categoryIds: ["exterior", "painting", "scaffolding"],
    keywords: ["外壁", "塗装", "防水"],
  },
  屋根: {
    categoryIds: ["exterior", "painting", "fire_prevention"],
    keywords: ["屋根", "防水", "塗装"],
  },
  玄関: {
    categoryIds: ["fixtures", "interior", "stone_tile"],
    keywords: ["玄関", "タイル", "建具"],
  },
  洗面: {
    categoryIds: ["plumbing", "interior"],
    keywords: ["洗面", "給排水"],
  },
  トイレ: {
    categoryIds: ["plumbing", "interior"],
    keywords: ["トイレ", "給排水", "クロス"],
  },
  浴室: {
    categoryIds: ["plumbing", "fire_prevention", "stone_tile"],
    keywords: ["浴室", "防水", "タイル"],
  },
  廊下: {
    categoryIds: ["interior"],
    keywords: ["クロス", "フローリング"],
  },
};

// 工種 → カテゴリ
const TASK_TO_CATEGORY: Record<string, string[]> = {
  塗装: ["painting"],
  クロス張替: ["interior", "ceiling_wall_specialty"],
  解体: ["demolition"],
  設備工事: ["electrical", "hvac", "plumbing"],
  床工事: ["interior", "tajima_flooring"],
  壁紙: ["interior", "ceiling_wall_specialty"],
  タイル工事: ["stone_tile"],
  給排水工事: ["plumbing"],
  電気工事: ["electrical"],
  防水工事: ["fire_prevention"],
  左官工事: ["plastering"],
  リノベーション: ["renovation", "interior", "demolition"],
};

// フォールバック: カテゴリ不明時に使うデフォルト単価
const FALLBACK_ITEM: Omit<EstimateRangeItem, "qty" | "subtotalLow" | "subtotalMid" | "subtotalHigh"> = {
  name: "内装工事一式（概算）",
  unit: "㎡",
  unitPriceLow: Math.round(8000 * 0.85),
  unitPriceMid: 8000,
  unitPriceHigh: Math.round(8000 * 1.2),
};

// ── メイン関数 ───────────────────────────────────────────────────────────────

const TAX_RATE = 0.1;
// 松竹梅レンジ倍率
const LOW_FACTOR = 0.85;
const HIGH_FACTOR = 1.2;

/**
 * EstimateIntent と cost-master から松竹梅レンジを計算する
 */
export function lookupEstimate(intent: EstimateIntent, costMaster: CostMaster): EstimateRange {
  const areaSqM = intent.area ? convertToSqM(intent.area.value, intent.area.unit) : undefined;

  // カテゴリIDセットを収集
  const categoryIds = new Set<string>();
  const keywordsToMatch: string[] = [];

  if (intent.roomType) {
    const mapping = ROOM_TO_CATEGORY[intent.roomType];
    mapping.categoryIds.forEach((id) => categoryIds.add(id));
    keywordsToMatch.push(...mapping.keywords);
  }

  for (const task of intent.tasks) {
    const cats = TASK_TO_CATEGORY[task];
    if (cats) cats.forEach((id) => categoryIds.add(id));
  }

  // 対象カテゴリからアイテム候補を収集
  const candidates: CostMasterItem[] = [];
  for (const cat of costMaster.categories) {
    if (!categoryIds.has(cat.id)) continue;
    for (const item of cat.items) {
      // キーワードフィルタ（ある場合）
      if (keywordsToMatch.length > 0) {
        const matches = keywordsToMatch.some(
          (kw) => item.name.includes(kw) || (item.note ?? "").includes(kw)
        );
        if (!matches) continue;
      }
      candidates.push(item);
    }
  }

  // 候補がない場合、カテゴリ全体から全アイテムを再収集（キーワードなし）
  if (candidates.length === 0 && categoryIds.size > 0) {
    for (const cat of costMaster.categories) {
      if (!categoryIds.has(cat.id)) continue;
      candidates.push(...cat.items);
    }
  }

  // それでもない場合はフォールバック
  const rangeItems: EstimateRangeItem[] = [];

  if (candidates.length === 0 || areaSqM === undefined) {
    // 面積不明 or カテゴリ不明: フォールバック1品目
    const qty = areaSqM ?? 10; // 面積不明は10㎡想定
    const fb = FALLBACK_ITEM;
    rangeItems.push({
      ...fb,
      qty,
      subtotalLow: Math.round(fb.unitPriceLow * qty),
      subtotalMid: Math.round(fb.unitPriceMid * qty),
      subtotalHigh: Math.round(fb.unitPriceHigh * qty),
    });
  } else {
    // 代表アイテムを最大3品目に絞る（最も一般的な品目）
    const selected = selectRepresentativeItems(candidates, intent, 3);
    for (const item of selected) {
      const qty = areaSqM;
      const mid = item.unitPrice;
      const low = Math.round(mid * LOW_FACTOR);
      const high = Math.round(mid * HIGH_FACTOR);
      rangeItems.push({
        name: item.name,
        unit: item.unit,
        qty,
        unitPriceLow: low,
        unitPriceMid: mid,
        unitPriceHigh: high,
        subtotalLow: Math.round(low * qty),
        subtotalMid: Math.round(mid * qty),
        subtotalHigh: Math.round(high * qty),
      });
    }
  }

  const totalLow = rangeItems.reduce((s, i) => s + i.subtotalLow, 0);
  const totalMid = rangeItems.reduce((s, i) => s + i.subtotalMid, 0);
  const totalHigh = rangeItems.reduce((s, i) => s + i.subtotalHigh, 0);

  return {
    items: rangeItems,
    totalLow,
    totalMid,
    totalHigh,
    taxIncludedLow: Math.round(totalLow * (1 + TAX_RATE)),
    taxIncludedMid: Math.round(totalMid * (1 + TAX_RATE)),
    taxIncludedHigh: Math.round(totalHigh * (1 + TAX_RATE)),
  };
}

// ── 内部ヘルパー ─────────────────────────────────────────────────────────────

/**
 * 候補リストから代表品目を選択する。
 * 単価が中間帯のもの(outlierを除く)を優先し、最大 maxCount 件返す。
 */
function selectRepresentativeItems(
  candidates: CostMasterItem[],
  intent: EstimateIntent,
  maxCount: number
): CostMasterItem[] {
  // ユニット「㎡」のものを優先
  const sqmItems = candidates.filter((i) => i.unit === "㎡");
  const target = sqmItems.length > 0 ? sqmItems : candidates;

  // 単価でソートして中央値帯を選択
  const sorted = [...target].sort((a, b) => a.unitPrice - b.unitPrice);

  if (sorted.length <= maxCount) return sorted;

  // gradeヒントがある場合に偏らせる
  if (intent.grade === "low") {
    return sorted.slice(0, maxCount);
  } else if (intent.grade === "high") {
    return sorted.slice(sorted.length - maxCount);
  }
  // midまたは未指定: 中央帯
  const mid = Math.floor(sorted.length / 2);
  const half = Math.floor(maxCount / 2);
  return sorted.slice(Math.max(0, mid - half), Math.min(sorted.length, mid - half + maxCount));
}

// ── フォーマットユーティリティ ───────────────────────────────────────────────

const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

/** 金額を日本円表記でフォーマット */
export function formatYen(value: number): string {
  return yen.format(value);
}

/** EstimateRange から施主向け自然言語サマリを生成する */
export function summarizeRange(range: EstimateRange): string {
  const low = formatYen(range.taxIncludedLow);
  const mid = formatYen(range.taxIncludedMid);
  const high = formatYen(range.taxIncludedHigh);
  return `標準で${mid}、ハイグレードだと${high}、エコノミーだと${low}です（税込）。\n📍 世田谷区標準価格。現地調査後に±20%変動します。`;
}
