import { describe, expect, it } from "vitest";
import {
  getRecommendedPlan,
  getAllPlans,
  formatPlanPrice,
  INSURANCE_PLANS,
  type TargetSegment,
} from "../pricing.js";

describe("INSURANCE_PLANS", () => {
  it("has exactly 3 plans", () => {
    expect(INSURANCE_PLANS).toHaveLength(3);
  });

  it("plan prices are 22000, 48000, 130000", () => {
    const prices = INSURANCE_PLANS.map((p) => p.monthlyPriceJpy).sort((a, b) => a - b);
    expect(prices).toEqual([22_000, 48_000, 130_000]);
  });

  it("enterprise plan has unlimited assessments", () => {
    const enterprise = INSURANCE_PLANS.find((p) => p.tier === "enterprise");
    expect(enterprise?.aiAssessmentsPerMonth).toBe(Infinity);
    expect(enterprise?.droneAssessmentsPerMonth).toBe(Infinity);
  });

  it("all plans have at least one feature", () => {
    for (const plan of INSURANCE_PLANS) {
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });
});

describe("getAllPlans", () => {
  it("returns 3 plans sorted by price ascending", () => {
    const plans = getAllPlans();
    expect(plans).toHaveLength(3);
    expect(plans[0].monthlyPriceJpy).toBeLessThanOrEqual(plans[1].monthlyPriceJpy);
    expect(plans[1].monthlyPriceJpy).toBeLessThanOrEqual(plans[2].monthlyPriceJpy);
  });
});

describe("formatPlanPrice", () => {
  it("formats starter plan price", () => {
    const starter = INSURANCE_PLANS.find((p) => p.tier === "starter")!;
    expect(formatPlanPrice(starter)).toBe("¥22,000/月");
  });

  it("formats enterprise plan price", () => {
    const enterprise = INSURANCE_PLANS.find((p) => p.tier === "enterprise")!;
    expect(formatPlanPrice(enterprise)).toBe("¥130,000/月");
  });
});

describe("getRecommendedPlan", () => {
  it("recommends starter for small general_contractor", () => {
    const rec = getRecommendedPlan("general_contractor", 5);
    expect(rec.plan.tier).toBe("starter");
    expect(rec.reason).toBeTruthy();
  });

  it("recommends professional for insurance_agent", () => {
    const rec = getRecommendedPlan("insurance_agent", 15);
    expect(rec.plan.tier).toBe("professional");
  });

  it("recommends enterprise for risk_manager", () => {
    const rec = getRecommendedPlan("risk_manager", 10);
    expect(rec.plan.tier).toBe("enterprise");
  });

  it("recommends enterprise for large project volume", () => {
    const rec = getRecommendedPlan("general_contractor", 100);
    expect(rec.plan.tier).toBe("enterprise");
  });

  it("always returns an alternative plan", () => {
    const segments: TargetSegment[] = [
      "general_contractor",
      "insurance_agent",
      "loss_adjuster",
      "risk_manager",
    ];
    for (const seg of segments) {
      const rec = getRecommendedPlan(seg, 10);
      expect(rec.alternativePlan).toBeDefined();
      expect(rec.alternativePlan?.tier).not.toBe(rec.plan.tier);
    }
  });

  it("large loss_adjuster gets enterprise", () => {
    const rec = getRecommendedPlan("loss_adjuster", 25);
    expect(rec.plan.tier).toBe("enterprise");
  });
});
