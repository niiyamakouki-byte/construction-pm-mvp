/**
 * case-matcher unit tests.
 */

import { describe, it, expect } from "vitest";
import { matchCases } from "../case-matcher.js";
import type { CaseStudy, ProposalGenerationInput } from "../types.js";

function makeCase(overrides: Partial<CaseStudy> = {}): CaseStudy {
  return {
    id: "case-test",
    projectName: "テスト案件",
    workCategory: "kitchen",
    workScale: "medium",
    scaleJa: "中規模",
    completedYearMonth: "2025-06",
    anonymizedClient: "世田谷区T様邸",
    summaryJa: "概要",
    achievementJa: "実績",
    ...overrides,
  };
}

function makeInput(overrides: Partial<ProposalGenerationInput> = {}): ProposalGenerationInput {
  return {
    customerName: "テスト顧客",
    workCategory: "kitchen",
    workScale: "medium",
    locationCity: "世田谷区",
    ...overrides,
  };
}

describe("matchCases", () => {
  it("空配列の場合は空配列を返す", () => {
    expect(matchCases(makeInput(), [])).toEqual([]);
  });

  it("top3件を返す", () => {
    const cases: CaseStudy[] = Array.from({ length: 10 }, (_, i) =>
      makeCase({ id: `case-${i}` }),
    );
    const result = matchCases(makeInput(), cases);
    expect(result).toHaveLength(3);
  });

  it("workCategory 完全一致がスコア上位になる", () => {
    const targetCat = makeCase({ id: "kitchen-1", workCategory: "kitchen" });
    const otherCat = makeCase({ id: "bath-1", workCategory: "bath" });
    const result = matchCases(makeInput({ workCategory: "kitchen" }), [otherCat, targetCat]);
    expect(result[0].workCategory).toBe("kitchen");
  });

  it("workScale 一致でスコアが上がる", () => {
    const matchScale = makeCase({ id: "m1", workScale: "medium" });
    const mismatchScale = makeCase({ id: "m2", workScale: "small" });
    // Both same category, but scale differs
    const result = matchCases(makeInput({ workScale: "medium" }), [mismatchScale, matchScale]);
    expect(result[0].workScale).toBe("medium");
  });

  it("全件が1件以下の場合はそのまま返す", () => {
    const singleCase = makeCase();
    const result = matchCases(makeInput(), [singleCase]);
    expect(result).toHaveLength(1);
  });

  it("直近3年内の案件にボーナスが付く", () => {
    const recent = makeCase({ id: "recent", completedYearMonth: "2025-01" });
    const old = makeCase({ id: "old", completedYearMonth: "2020-01" });
    const result = matchCases(makeInput(), [old, recent]);
    // recent should outrank old even with same category/scale
    expect(result[0].id).toBe("recent");
  });
});
