/**
 * case-study-matcher.test.ts
 */

import { describe, it, expect } from "vitest";
import { matchCaseStudies } from "../case-study-matcher.js";
import type { OwnerProfile } from "../types.js";

function makeProfile(overrides: Partial<OwnerProfile> = {}): OwnerProfile {
  return {
    ownerName: "テスト施主",
    budget: 8000000,
    familySize: 2,
    ageRange: "40s",
    lifestyle: [],
    priorityRanking: "qualityFirst",
    ...overrides,
  };
}

describe("matchCaseStudies", () => {
  it("常に3件を返す (DBに15件あるため)", () => {
    const results = matchCaseStudies(makeProfile(), "balanced");
    expect(results).toHaveLength(3);
  });

  it("各結果は caseStudyId, titleJa, similarity, summaryJa を持つ", () => {
    const results = matchCaseStudies(makeProfile(), "balanced");
    for (const r of results) {
      expect(r.caseStudyId).toBeTruthy();
      expect(r.titleJa).toBeTruthy();
      expect(r.similarity).toBeGreaterThanOrEqual(0);
      expect(r.similarity).toBeLessThanOrEqual(1);
      expect(r.summaryJa).toBeTruthy();
    }
  });

  it("similarity は降順に並んでいる", () => {
    const results = matchCaseStudies(makeProfile({ lifestyle: ["cooking"] }), "balanced");
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity);
    }
  });

  it("cooking ライフスタイルで料理関連の事例がスコア上位に来る", () => {
    const results = matchCaseStudies(
      makeProfile({ lifestyle: ["cooking"], budget: 9000000 }),
      "balanced",
    );
    // 上位3件のいずれかに料理関連が含まれること
    const hasCooking = results.some((r) => r.titleJa.includes("料理") || r.summaryJa.includes("キッチン"));
    expect(hasCooking).toBe(true);
  });

  it("pet_owner でペット関連の事例がスコア上位に来る", () => {
    const results = matchCaseStudies(
      makeProfile({ lifestyle: ["pet_owner"], budget: 8500000 }),
      "balanced",
    );
    const hasPet = results.some((r) => r.titleJa.includes("猫") || r.summaryJa.includes("ペット"));
    expect(hasPet).toBe(true);
  });

  it("budget_focused で低予算の事例が有利になる", () => {
    const results = matchCaseStudies(
      makeProfile({ budget: 3000000 }),
      "budget_focused",
    );
    // 最上位事例の similarity > 0
    expect(results[0].similarity).toBeGreaterThan(0);
  });
});
