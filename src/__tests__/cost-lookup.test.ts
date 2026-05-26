/**
 * cost-lookup テスト — 松竹梅レンジ計算 (Sprint 9-A)
 */
import { describe, it, expect } from "vitest";
import { lookupEstimate, summarizeRange } from "../lib/estimate-assistant/cost-lookup.js";
import type { CostMaster } from "../lib/estimate-assistant/cost-lookup.js";
import type { EstimateIntent } from "../lib/estimate-assistant/intent-parser.js";

// ── ミニマルcost-masterフィクスチャ ──────────────────────────────────────────

const mockCostMaster: CostMaster = {
  version: "test",
  updatedAt: "2026-01-01",
  currency: "JPY",
  taxRate: 0.1,
  categories: [
    {
      id: "interior",
      name: "内装・仕上げ",
      items: [
        { code: "IN-005", name: "クロス張り（量産品）", unit: "㎡", unitPrice: 1200 },
        { code: "IN-010", name: "フローリング（合板）", unit: "㎡", unitPrice: 6000 },
        { code: "IN-015", name: "クロス張り（輸入品）", unit: "㎡", unitPrice: 3500 },
      ],
    },
    {
      id: "demolition",
      name: "解体・撤去",
      items: [
        { code: "DM-001", name: "内装解体（木造）", unit: "㎡", unitPrice: 3500 },
        { code: "DM-008", name: "産廃処分費（混合）", unit: "㎥", unitPrice: 18000 },
      ],
    },
    {
      id: "painting",
      name: "塗装工事",
      items: [
        { code: "PA-001", name: "外壁塗装（シリコン）", unit: "㎡", unitPrice: 2800 },
        { code: "PA-002", name: "外壁塗装（フッ素）", unit: "㎡", unitPrice: 4200 },
      ],
    },
    {
      id: "wagshitsu",
      name: "和室工事",
      items: [
        { code: "WG-001", name: "畳表替え", unit: "畳", unitPrice: 8000 },
        { code: "WG-002", name: "畳新調", unit: "畳", unitPrice: 15000 },
      ],
    },
  ],
};

// ── 基本動作 ─────────────────────────────────────────────────────────────────

describe("lookupEstimate — 基本", () => {
  it("LDK + 20畳でレンジを返す", () => {
    const intent: EstimateIntent = {
      roomType: "LDK",
      area: { value: 20, unit: "畳" },
      tasks: [],
      rawText: "LDK 20畳",
    };
    const result = lookupEstimate(intent, mockCostMaster);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.totalMid).toBeGreaterThan(0);
    expect(result.taxIncludedMid).toBeGreaterThan(result.totalMid);
  });

  it("taxIncludedMid は totalMid × 1.1", () => {
    const intent: EstimateIntent = {
      roomType: "LDK",
      area: { value: 10, unit: "㎡" },
      tasks: [],
      rawText: "LDK 10㎡",
    };
    const result = lookupEstimate(intent, mockCostMaster);
    expect(result.taxIncludedMid).toBe(Math.round(result.totalMid * 1.1));
    expect(result.taxIncludedLow).toBe(Math.round(result.totalLow * 1.1));
    expect(result.taxIncludedHigh).toBe(Math.round(result.totalHigh * 1.1));
  });

  it("lowレンジ < midレンジ < highレンジ", () => {
    const intent: EstimateIntent = {
      roomType: "LDK",
      area: { value: 15, unit: "㎡" },
      tasks: [],
      rawText: "LDK 15㎡",
    };
    const result = lookupEstimate(intent, mockCostMaster);
    expect(result.taxIncludedLow).toBeLessThan(result.taxIncludedMid);
    expect(result.taxIncludedMid).toBeLessThan(result.taxIncludedHigh);
  });
});

// ── 松竹梅レンジ係数 ─────────────────────────────────────────────────────────

describe("lookupEstimate — レンジ係数", () => {
  it("midに対してlowは約0.85倍", () => {
    const intent: EstimateIntent = {
      roomType: "LDK",
      area: { value: 10, unit: "㎡" },
      tasks: [],
      rawText: "test",
    };
    const result = lookupEstimate(intent, mockCostMaster);
    // 1品目の場合、subtotalLow / subtotalMid ≈ 0.85
    if (result.items.length > 0) {
      const item = result.items[0];
      expect(item.unitPriceLow).toBe(Math.round(item.unitPriceMid * 0.85));
      expect(item.unitPriceHigh).toBe(Math.round(item.unitPriceMid * 1.2));
    }
  });

  it("各品目のsubtotal = unitPrice × qty", () => {
    const intent: EstimateIntent = {
      roomType: "LDK",
      area: { value: 10, unit: "㎡" },
      tasks: [],
      rawText: "test",
    };
    const result = lookupEstimate(intent, mockCostMaster);
    for (const item of result.items) {
      expect(item.subtotalMid).toBe(Math.round(item.unitPriceMid * item.qty));
      expect(item.subtotalLow).toBe(Math.round(item.unitPriceLow * item.qty));
      expect(item.subtotalHigh).toBe(Math.round(item.unitPriceHigh * item.qty));
    }
  });
});

// ── 工種からカテゴリ検索 ─────────────────────────────────────────────────────

describe("lookupEstimate — 工種指定", () => {
  it("塗装工種でpainting カテゴリからアイテムを取得", () => {
    const intent: EstimateIntent = {
      roomType: "外壁",
      area: { value: 50, unit: "㎡" },
      tasks: ["塗装"],
      rawText: "外壁 50㎡ 塗装",
    };
    const result = lookupEstimate(intent, mockCostMaster);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.totalMid).toBeGreaterThan(0);
  });

  it("解体工種でdemolitionカテゴリを参照", () => {
    const intent: EstimateIntent = {
      area: { value: 20, unit: "㎡" },
      tasks: ["解体"],
      rawText: "解体 20㎡",
    };
    const result = lookupEstimate(intent, mockCostMaster);
    expect(result.items.length).toBeGreaterThan(0);
  });
});

// ── フォールバック ────────────────────────────────────────────────────────────

describe("lookupEstimate — フォールバック", () => {
  it("部屋種類も工種も不明でもレンジを返す", () => {
    const intent: EstimateIntent = {
      area: { value: 10, unit: "㎡" },
      tasks: [],
      rawText: "リフォームしたい",
    };
    const result = lookupEstimate(intent, mockCostMaster);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.totalMid).toBeGreaterThan(0);
  });

  it("面積不明でもフォールバック値でレンジを返す", () => {
    const intent: EstimateIntent = {
      roomType: "LDK",
      tasks: [],
      rawText: "LDK",
    };
    const result = lookupEstimate(intent, mockCostMaster);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.taxIncludedMid).toBeGreaterThan(0);
  });

  it("空intentでもエラーにならない", () => {
    const intent: EstimateIntent = { tasks: [], rawText: "" };
    expect(() => lookupEstimate(intent, mockCostMaster)).not.toThrow();
  });

  it("不明カテゴリ参照でもフォールバックを返す", () => {
    const intent: EstimateIntent = {
      roomType: "玄関",
      area: { value: 5, unit: "㎡" },
      tasks: [],
      rawText: "玄関",
    };
    // mockCostMasterにfixtures/stone_tileカテゴリがない→フォールバック
    const result = lookupEstimate(intent, mockCostMaster);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.totalMid).toBeGreaterThan(0);
  });
});

// ── 税込計算 ─────────────────────────────────────────────────────────────────

describe("lookupEstimate — 税込", () => {
  it("taxIncluded は税抜合計の1.1倍（整数）", () => {
    const intent: EstimateIntent = {
      roomType: "LDK",
      area: { value: 20, unit: "㎡" },
      tasks: [],
      rawText: "LDK 20㎡",
    };
    const result = lookupEstimate(intent, mockCostMaster);
    expect(result.taxIncludedLow).toBe(Math.round(result.totalLow * 1.1));
    expect(result.taxIncludedMid).toBe(Math.round(result.totalMid * 1.1));
    expect(result.taxIncludedHigh).toBe(Math.round(result.totalHigh * 1.1));
  });

  it("totalMid は全品目subtotalMidの合計", () => {
    const intent: EstimateIntent = {
      roomType: "LDK",
      area: { value: 10, unit: "㎡" },
      tasks: [],
      rawText: "LDK 10㎡",
    };
    const result = lookupEstimate(intent, mockCostMaster);
    const expected = result.items.reduce((s, i) => s + i.subtotalMid, 0);
    expect(result.totalMid).toBe(expected);
  });
});

// ── summarizeRange ────────────────────────────────────────────────────────────

describe("summarizeRange", () => {
  it("低中高の金額が含まれる", () => {
    const intent: EstimateIntent = {
      roomType: "LDK",
      area: { value: 10, unit: "㎡" },
      tasks: [],
      rawText: "test",
    };
    const range = lookupEstimate(intent, mockCostMaster);
    const summary = summarizeRange(range);
    expect(summary).toContain("標準で");
    expect(summary).toContain("ハイグレードだと");
    expect(summary).toContain("エコノミーだと");
  });

  it("サマリに世田谷区注記が含まれる", () => {
    const intent: EstimateIntent = {
      area: { value: 10, unit: "㎡" },
      tasks: [],
      rawText: "test",
    };
    const range = lookupEstimate(intent, mockCostMaster);
    const summary = summarizeRange(range);
    expect(summary).toContain("世田谷区標準価格");
    expect(summary).toContain("±20%変動");
  });

  it("税込表記が含まれる", () => {
    const intent: EstimateIntent = {
      area: { value: 10, unit: "㎡" },
      tasks: [],
      rawText: "test",
    };
    const range = lookupEstimate(intent, mockCostMaster);
    const summary = summarizeRange(range);
    expect(summary).toContain("税込");
  });
});
