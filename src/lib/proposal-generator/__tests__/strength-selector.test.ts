/**
 * strength-selector unit tests.
 */

import { describe, it, expect } from "vitest";
import { selectRelevantStrengths } from "../strength-selector.js";
import type { LaportaStrength, ProposalGenerationInput } from "../types.js";

function makeStrength(id: string, weight: number): LaportaStrength {
  return { id, titleJa: `強み${id}`, bodyJa: "説明", weight };
}

function makeInput(overrides: Partial<ProposalGenerationInput> = {}): ProposalGenerationInput {
  return {
    customerName: "テスト顧客",
    workCategory: "full_renovation",
    workScale: "medium",
    locationCity: "世田谷区",
    ...overrides,
  };
}

describe("selectRelevantStrengths", () => {
  it("空配列の場合は空配列を返す", () => {
    expect(selectRelevantStrengths(makeInput(), [])).toEqual([]);
  });

  it("常に3件を返す (8件入力時)", () => {
    const strengths = Array.from({ length: 8 }, (_, i) => makeStrength(`str-00${i + 1}`, 0.5));
    const result = selectRelevantStrengths(makeInput(), strengths);
    expect(result).toHaveLength(3);
  });

  it("2件しかない場合は2件を返す", () => {
    const strengths = [makeStrength("str-001", 0.8), makeStrength("str-002", 0.6)];
    const result = selectRelevantStrengths(makeInput(), strengths);
    expect(result).toHaveLength(2);
  });

  it("full_renovation では自社職人 (str-003) が選ばれやすい", () => {
    // str-003 has boost of 0.5 for full_renovation
    const strengths = [
      makeStrength("str-003", 0.85), // 0.85 + 0.5 = 1.35
      makeStrength("str-xxx", 1.2),  // 1.2 + 0 = 1.2 → lower
    ];
    const result = selectRelevantStrengths(makeInput({ workCategory: "full_renovation" }), strengths);
    expect(result[0].id).toBe("str-003");
  });

  it("exterior では材料コスト最適化 (str-007) が選ばれやすい", () => {
    const strengths = [
      makeStrength("str-007", 0.8), // 0.8 + 0.5 = 1.3
      makeStrength("str-zzz", 1.0), // 1.0 + 0 = 1.0
    ];
    const result = selectRelevantStrengths(makeInput({ workCategory: "exterior" }), strengths);
    expect(result[0].id).toBe("str-007");
  });
});
