/**
 * impact-analyzer unit tests.
 */

import { describe, it, expect } from "vitest";
import { analyzeImpact, isDangerousImpact } from "../impact-analyzer.js";
import type { ImpactAnalysisInput, EstimateLine, PhaseInfo } from "../impact-analyzer.js";

const baseLines: EstimateLine[] = [
  { id: "l1", trade: "大工", descriptionJa: "壁仕上げ", unitPriceJpy: 10000, quantity: 50, unit: "m2" },
];

const newLines: EstimateLine[] = [
  { id: "l2", trade: "大工", descriptionJa: "壁仕上げ (変更後)", unitPriceJpy: 12000, quantity: 50, unit: "m2" },
];

const phases: PhaseInfo[] = [
  { id: "p1", nameJa: "壁工事", trade: "大工", durationDays: 10 },
  { id: "p2", nameJa: "電気工事", trade: "電気", durationDays: 5 },
];

function makeInput(overrides: Partial<ImpactAnalysisInput> = {}): ImpactAnalysisInput {
  return {
    kind: "modification",
    originalLines: baseLines,
    newLines: newLines,
    phases: phases,
    targetPhaseIds: ["p1"],
    baseContractJpy: 1_000_000,
    ...overrides,
  };
}

describe("analyzeImpact", () => {
  it("金額差分を正しく計算する", () => {
    const result = analyzeImpact(makeInput());
    // 12000*50 - 10000*50 = 100000
    expect(result.costDeltaJpy).toBe(100_000);
  });

  it("コスト増加率を計算する (100000/1000000 = 10%)", () => {
    const result = analyzeImpact(makeInput());
    expect(result.costIncreaseRatioPct).toBe(10);
  });

  it("影響職種リストに大工が含まれる", () => {
    const result = analyzeImpact(makeInput());
    expect(result.affectedTrades).toContain("大工");
  });

  it("工期差分を計算する", () => {
    const result = analyzeImpact(makeInput());
    expect(typeof result.scheduleDeltaDays).toBe("number");
  });

  it("追加工事 (addition) で工期がデフォルト値になる (フェーズなし)", () => {
    const result = analyzeImpact(makeInput({ kind: "addition", targetPhaseIds: [] }));
    expect(result.scheduleDeltaDays).toBe(3); // SCHEDULE_DELTA_BY_KIND.addition
  });

  it("削除 (deletion) で工期差分が負になる (フェーズなし)", () => {
    const result = analyzeImpact(makeInput({ kind: "deletion", targetPhaseIds: [] }));
    expect(result.scheduleDeltaDays).toBe(-1);
  });

  it("baseContractJpy が 0 の場合 costIncreaseRatioPct は 0", () => {
    const result = analyzeImpact(makeInput({ baseContractJpy: 0 }));
    expect(result.costIncreaseRatioPct).toBe(0);
  });

  it("同額の場合 costDeltaJpy は 0", () => {
    const result = analyzeImpact(makeInput({
      newLines: baseLines,
    }));
    expect(result.costDeltaJpy).toBe(0);
  });

  it("減額の場合 costDeltaJpy が負になる", () => {
    const cheaperLines: EstimateLine[] = [
      { id: "l3", trade: "大工", descriptionJa: "壁仕上げ (廉価版)", unitPriceJpy: 8000, quantity: 50, unit: "m2" },
    ];
    const result = analyzeImpact(makeInput({ newLines: cheaperLines }));
    expect(result.costDeltaJpy).toBeLessThan(0);
  });

  it("フェーズの職種も affectedTrades に含まれる", () => {
    const result = analyzeImpact(makeInput({ targetPhaseIds: ["p2"] }));
    expect(result.affectedTrades).toContain("電気");
  });

  it("dependencyChain は空配列 (dependency-resolverに委譲)", () => {
    const result = analyzeImpact(makeInput());
    expect(result.dependencyChain).toEqual([]);
  });
});

describe("isDangerousImpact", () => {
  it("costIncreaseRatioPct >= 10 で true", () => {
    const result = analyzeImpact(makeInput());
    expect(isDangerousImpact(result)).toBe(true); // 10%
  });

  it("costIncreaseRatioPct < 10 で false", () => {
    const result = analyzeImpact(makeInput({ baseContractJpy: 10_000_000 }));
    // 100000/10000000 = 1%
    expect(isDangerousImpact(result)).toBe(false);
  });

  it("ちょうど 10% の場合 true", () => {
    expect(isDangerousImpact({
      costDeltaJpy: 100_000,
      scheduleDeltaDays: 1,
      affectedTrades: [],
      dependencyChain: [],
      costIncreaseRatioPct: 10,
    })).toBe(true);
  });

  it("9.9% の場合 false", () => {
    expect(isDangerousImpact({
      costDeltaJpy: 99_000,
      scheduleDeltaDays: 1,
      affectedTrades: [],
      dependencyChain: [],
      costIncreaseRatioPct: 9.9,
    })).toBe(false);
  });
});
