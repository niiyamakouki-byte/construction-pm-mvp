/**
 * profit-calculator カオステスト — 異常入力・境界値の網羅
 */
import { describe, it, expect } from "vitest";
import {
  LEGAL_WELFARE_RATE,
  calcLegalWelfare,
  calcTotalCost,
  calculateFromMargin,
  calculateFromPrice,
} from "./profit-calculator.js";
import type { CostItem } from "./profit-calculator.js";

const laborOnlyItems: CostItem[] = [
  { code: "L", name: "労務費", unitPrice: 200000, quantity: 1, isLaborCost: true },
];

const zeroItems: CostItem[] = [
  { code: "Z", name: "ゼロコスト", unitPrice: 0, quantity: 1, isLaborCost: false },
];

describe("profit-calculator: カオステスト", () => {

  // ── 粗利率の境界値 ────────────────────────────────────────────────────────

  it("粗利率0%はエラーを投げる", () => {
    expect(() => calculateFromMargin(laborOnlyItems, 0)).toThrow();
  });

  it("粗利率100%はエラーを投げる", () => {
    expect(() => calculateFromMargin(laborOnlyItems, 100)).toThrow();
  });

  it("粗利率負の値はエラーを投げる", () => {
    expect(() => calculateFromMargin(laborOnlyItems, -5)).toThrow();
  });

  it("粗利率100超はエラーを投げる", () => {
    expect(() => calculateFromMargin(laborOnlyItems, 101)).toThrow();
  });

  it("粗利率0.001%（極小）は正常に計算される", () => {
    const result = calculateFromMargin(laborOnlyItems, 0.001);
    expect(result.estimatePrice).toBeGreaterThan(0);
    expect(result.marginPercent).toBeCloseTo(0.001, 2);
  });

  it("粗利率99.999%（極大）は正常に計算される（見積金額が巨大になる）", () => {
    const result = calculateFromMargin(laborOnlyItems, 99.999);
    expect(result.estimatePrice).toBeGreaterThan(1_000_000_000);
  });

  // ── コスト0円 ─────────────────────────────────────────────────────────────

  it("コスト0円の場合calcTotalCostは0を返す", () => {
    expect(calcTotalCost(zeroItems, false)).toBe(0);
  });

  it("コスト0円から粗利率30%で逆算するとestimatePrice=0になる", () => {
    const result = calculateFromMargin(zeroItems, 30, false);
    expect(result.totalCost).toBe(0);
    expect(result.estimatePrice).toBe(0);
    expect(result.grossProfit).toBe(0);
  });

  it("コスト0円からcalcLegalWelfareは0を返す（労務費なし）", () => {
    expect(calcLegalWelfare(zeroItems)).toBe(0);
  });

  // ── 法定福利率の境界値 ────────────────────────────────────────────────────

  it("LEGAL_WELFARE_RATEは0.1535である", () => {
    expect(LEGAL_WELFARE_RATE).toBe(0.1535);
  });

  it("労務費1円の法定福利費はMath.round(1 * 0.1535) = 0になる", () => {
    const oneYenLabor: CostItem[] = [
      { code: "T", name: "労務費", unitPrice: 1, quantity: 1, isLaborCost: true },
    ];
    expect(calcLegalWelfare(oneYenLabor)).toBe(Math.round(1 * LEGAL_WELFARE_RATE));
  });

  it("労務費1億円の法定福利費は正確に計算される", () => {
    const bigLabor: CostItem[] = [
      { code: "T", name: "労務費", unitPrice: 100_000_000, quantity: 1, isLaborCost: true },
    ];
    expect(calcLegalWelfare(bigLabor)).toBe(Math.round(100_000_000 * LEGAL_WELFARE_RATE));
  });

  // ── calculateFromPriceの境界値 ────────────────────────────────────────────

  it("目標金額がコストより低い場合は粗利がマイナスになる", () => {
    const result = calculateFromPrice(laborOnlyItems, 100000); // コスト200000 > 目標100000
    expect(result.grossProfit).toBeLessThan(0);
    expect(result.marginPercent).toBeLessThan(0);
  });

  it("目標金額がコストと同じ場合は粗利0・粗利率0%になる", () => {
    const result = calculateFromPrice(laborOnlyItems, 200000);
    expect(result.grossProfit).toBe(0);
    expect(result.marginPercent).toBe(0);
  });
});
