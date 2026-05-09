/**
 * plan-generator.test.ts
 */

import { describe, it, expect } from "vitest";
import { generateThreePlans } from "../plan-generator.js";
import type { OwnerProfile } from "../types.js";

function makeProfile(overrides: Partial<OwnerProfile> = {}): OwnerProfile {
  return {
    ownerName: "テスト施主",
    budget: 10000000,
    familySize: 3,
    ageRange: "40s",
    lifestyle: [],
    priorityRanking: "qualityFirst",
    ...overrides,
  };
}

describe("generateThreePlans", () => {
  it("常に3案を返す", () => {
    const plans = generateThreePlans(makeProfile(), 10000000);
    expect(plans).toHaveLength(3);
  });

  it("plan[0] の費用は budgetTarget × 0.85", () => {
    const budget = 10000000;
    const plans = generateThreePlans(makeProfile(), budget);
    expect(plans[0].estimatedCost).toBe(Math.round(budget * 0.85));
  });

  it("plan[1] の費用は budgetTarget × 1.0", () => {
    const budget = 10000000;
    const plans = generateThreePlans(makeProfile(), budget);
    expect(plans[1].estimatedCost).toBe(budget);
  });

  it("plan[2] の費用は budgetTarget × 1.2", () => {
    const budget = 10000000;
    const plans = generateThreePlans(makeProfile(), budget);
    expect(plans[2].estimatedCost).toBe(Math.round(budget * 1.2));
  });

  it("各プランは一意のIDを持つ", () => {
    const plans = generateThreePlans(makeProfile(), 10000000);
    const ids = plans.map((p) => p.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("全プランは draft ステータスで生成される", () => {
    const plans = generateThreePlans(makeProfile(), 10000000);
    for (const plan of plans) {
      expect(plan.status).toBe("draft");
    }
  });

  it("pet_owner で耐傷フローリングが含まれる", () => {
    const plans = generateThreePlans(makeProfile({ lifestyle: ["pet_owner"] }), 10000000);
    const hasPetFloor = plans.some((p) =>
      p.materialHighlights.some((mh) => mh.location.includes("ペット")),
    );
    expect(hasPetFloor).toBe(true);
  });

  it("elderly_care でノンスリップ材が含まれる", () => {
    const plans = generateThreePlans(
      makeProfile({ lifestyle: ["elderly_care"], ageRange: "60s+" }),
      10000000,
    );
    const hasNonSlip = plans.some((p) =>
      p.materialHighlights.some((mh) => mh.materialName.includes("ノンスリップ")),
    );
    expect(hasNonSlip).toBe(true);
  });

  it("designFirst で balanced プランが design_focused になる", () => {
    const plans = generateThreePlans(
      makeProfile({ priorityRanking: "designFirst" }),
      10000000,
    );
    expect(plans[1].kind).toBe("design_focused");
  });

  it("各プランは rationaleJa が空でない", () => {
    const plans = generateThreePlans(makeProfile({ lifestyle: ["cooking"] }), 10000000);
    for (const plan of plans) {
      expect(plan.rationaleJa.length).toBeGreaterThan(0);
    }
  });

  it("各プランは maintenanceForecast を持つ", () => {
    const plans = generateThreePlans(makeProfile(), 10000000);
    for (const plan of plans) {
      expect(plan.maintenanceForecast.length).toBeGreaterThan(0);
    }
  });
});
