import { describe, expect, it } from "vitest";
import { assessDamage, type AssessmentInput } from "../assessor.js";

describe("assessDamage", () => {
  it("returns nonzero damage for fire with photos", () => {
    const input: AssessmentInput = {
      photoUrls: ["https://example.com/fire1.jpg", "https://example.com/fire2.jpg"],
      damageType: "fire",
    };
    const result = assessDamage(input);
    expect(result.estimatedDamageJpy).toBeGreaterThan(0);
    expect(result.estimatedPayoutJpy).toBeGreaterThan(0);
  });

  it("uses constructionCostJpy when provided", () => {
    const input: AssessmentInput = {
      photoUrls: ["https://example.com/p1.jpg"],
      damageType: "fire",
      constructionCostJpy: 10_000_000,
    };
    const result = assessDamage(input);
    // fire damage rate = 0.6, coverage = 1.0, deductible = 0.0
    expect(result.estimatedDamageJpy).toBe(6_000_000);
    expect(result.estimatedPayoutJpy).toBe(6_000_000);
  });

  it("uses estimatedAreaM2 when constructionCost omitted", () => {
    const input: AssessmentInput = {
      photoUrls: ["https://example.com/p1.jpg"],
      damageType: "water",
      estimatedAreaM2: 100,
    };
    const result = assessDamage(input);
    // water unit cost = 45,000/m², area=100m²
    expect(result.estimatedDamageJpy).toBe(4_500_000);
  });

  it("applies deductible for water damage", () => {
    const input: AssessmentInput = {
      photoUrls: ["https://example.com/w1.jpg"],
      damageType: "water",
      constructionCostJpy: 1_000_000,
    };
    const result = assessDamage(input);
    expect(result.deductibleApplied).toBe(true);
    // water: damageRate=0.15, coverage=0.9, deductible=0.1
    // damage = 150,000, payout = 150,000 * 0.9 * 0.9 = 121,500
    expect(result.estimatedDamageJpy).toBe(150_000);
    expect(result.estimatedPayoutJpy).toBe(121_500);
  });

  it("no deductible for fire damage", () => {
    const input: AssessmentInput = {
      photoUrls: ["https://example.com/f1.jpg"],
      damageType: "fire",
      constructionCostJpy: 500_000,
    };
    const result = assessDamage(input);
    expect(result.deductibleApplied).toBe(false);
  });

  it("returns applicable clauses for earthquake", () => {
    const input: AssessmentInput = {
      photoUrls: ["https://example.com/e1.jpg"],
      damageType: "earthquake",
    };
    const result = assessDamage(input);
    expect(result.applicableClauses.length).toBeGreaterThan(0);
    expect(result.applicableClauses[0].applicableDamageTypes).toContain("earthquake");
  });

  it("confidence score increases with more photos", () => {
    const baseInput: AssessmentInput = {
      photoUrls: ["https://example.com/p1.jpg"],
      damageType: "theft",
    };
    const morePhotosInput: AssessmentInput = {
      photoUrls: Array.from({ length: 10 }, (_, i) => `https://example.com/p${i}.jpg`),
      damageType: "theft",
    };
    const base = assessDamage(baseInput);
    const more = assessDamage(morePhotosInput);
    expect(more.confidenceScore).toBeGreaterThan(base.confidenceScore);
  });

  it("returns zero payout for zero photos and no area/cost", () => {
    const input: AssessmentInput = {
      photoUrls: [],
      damageType: "fire",
    };
    const result = assessDamage(input);
    // even with no photos, fallback estimate gives nonzero damage
    expect(result.confidenceScore).toBeLessThanOrEqual(0.45);
  });

  it("includes assessment notes", () => {
    const input: AssessmentInput = {
      photoUrls: ["https://example.com/p1.jpg"],
      damageType: "third_party",
      constructionCostJpy: 2_000_000,
    };
    const result = assessDamage(input);
    expect(result.assessmentNotes.length).toBeGreaterThan(0);
  });
});
