import { describe, expect, it } from "vitest";
import {
  LEGAL_WELFARE_RATE,
  calcLegalWelfare,
  calcTotalCost,
  calculateFromMargin,
  calculateFromPrice,
  simulateMultiple,
} from "./profit-calculator";
import type { CostItem } from "./profit-calculator";

const items: CostItem[] = [
  { code: "A", name: "材料費", unitPrice: 100000, quantity: 1, isLaborCost: false },
  { code: "B", name: "労務費", unitPrice: 200000, quantity: 1, isLaborCost: true },
];

describe("calcLegalWelfare", () => {
  it("労務費×法定福利率を返す", () => {
    const result = calcLegalWelfare(items);
    expect(result).toBe(Math.round(200000 * LEGAL_WELFARE_RATE));
  });

  it("労務費がない場合は0を返す", () => {
    const noLabor: CostItem[] = [
      { code: "A", name: "材料費", unitPrice: 100000, quantity: 1 },
    ];
    expect(calcLegalWelfare(noLabor)).toBe(0);
  });
});

describe("calcTotalCost", () => {
  it("法定福利費なしで直接原価の合計を返す", () => {
    expect(calcTotalCost(items, false)).toBe(300000);
  });

  it("法定福利費ありで合計を返す", () => {
    const welfare = Math.round(200000 * LEGAL_WELFARE_RATE);
    expect(calcTotalCost(items, true)).toBe(300000 + welfare);
  });
});

describe("calculateFromMargin", () => {
  it("目標粗利率30%から見積金額を逆算する", () => {
    const result = calculateFromMargin(items, 30, false);
    expect(result.totalCost).toBe(300000);
    expect(result.estimatePrice).toBe(Math.round(300000 / 0.7));
    expect(result.grossProfit).toBe(result.estimatePrice - 300000);
    expect(result.marginPercent).toBeCloseTo(30, 1);
  });

  it("法定福利費込みで逆算する", () => {
    const welfare = Math.round(200000 * LEGAL_WELFARE_RATE);
    const totalCost = 300000 + welfare;
    const result = calculateFromMargin(items, 25, true);
    expect(result.totalCost).toBe(totalCost);
    expect(result.legalWelfare).toBe(welfare);
    expect(result.estimatePrice).toBe(Math.round(totalCost / 0.75));
  });

  it("0%以下・100%以上の粗利率でエラー", () => {
    expect(() => calculateFromMargin(items, 0)).toThrow();
    expect(() => calculateFromMargin(items, 100)).toThrow();
    expect(() => calculateFromMargin(items, -1)).toThrow();
  });
});

describe("calculateFromPrice", () => {
  it("目標金額から粗利率を逆算する", () => {
    const result = calculateFromPrice(items, 400000, false);
    expect(result.totalCost).toBe(300000);
    expect(result.estimatePrice).toBe(400000);
    expect(result.grossProfit).toBe(100000);
    expect(result.marginPercent).toBeCloseTo(25, 1);
  });

  it("0以下の金額でエラー", () => {
    expect(() => calculateFromPrice(items, 0)).toThrow();
    expect(() => calculateFromPrice(items, -100)).toThrow();
  });
});

describe("simulateMultiple", () => {
  it("松竹梅3パターンを計算する", () => {
    const results = simulateMultiple(items, [20, 25, 30], false);
    expect(results).toHaveLength(3);
    expect(results[0].label).toBe("梅");
    expect(results[1].label).toBe("竹");
    expect(results[2].label).toBe("松");
    expect(results[0].marginPercent).toBe(20);
    expect(results[1].marginPercent).toBe(25);
    expect(results[2].marginPercent).toBe(30);
    // 粗利率が上がるほど見積金額も上がる
    expect(results[0].estimatePrice).toBeLessThan(results[1].estimatePrice);
    expect(results[1].estimatePrice).toBeLessThan(results[2].estimatePrice);
  });
});
