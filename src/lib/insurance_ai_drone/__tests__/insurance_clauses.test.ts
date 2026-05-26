import { describe, expect, it } from "vitest";
import {
  INSURANCE_CLAUSES,
  getClausesForDamageType,
  getPrimaryCoverageRatio,
  getPrimaryDeductibleRate,
} from "../rules/insurance_clauses.js";

describe("INSURANCE_CLAUSES", () => {
  it("has at least 5 clauses", () => {
    expect(INSURANCE_CLAUSES.length).toBeGreaterThanOrEqual(5);
  });

  it("all clauses have articleNumber and title", () => {
    for (const clause of INSURANCE_CLAUSES) {
      expect(clause.articleNumber).toBeTruthy();
      expect(clause.title).toBeTruthy();
    }
  });

  it("all coverage ratios are between 0 and 1", () => {
    for (const clause of INSURANCE_CLAUSES) {
      expect(clause.coverageRatio).toBeGreaterThanOrEqual(0);
      expect(clause.coverageRatio).toBeLessThanOrEqual(1);
    }
  });
});

describe("getClausesForDamageType", () => {
  it("returns fire clauses", () => {
    const clauses = getClausesForDamageType("fire");
    expect(clauses.length).toBeGreaterThan(0);
    for (const c of clauses) {
      expect(c.applicableDamageTypes).toContain("fire");
    }
  });

  it("returns earthquake clauses", () => {
    const clauses = getClausesForDamageType("earthquake");
    expect(clauses.length).toBeGreaterThan(0);
  });

  it("returns third_party clauses", () => {
    const clauses = getClausesForDamageType("third_party");
    expect(clauses.length).toBeGreaterThan(0);
  });
});

describe("getPrimaryCoverageRatio", () => {
  it("fire coverage is 1.0 (no deductible)", () => {
    expect(getPrimaryCoverageRatio("fire")).toBe(1.0);
  });

  it("earthquake coverage is less than fire coverage", () => {
    const earthquake = getPrimaryCoverageRatio("earthquake");
    const fire = getPrimaryCoverageRatio("fire");
    expect(earthquake).toBeLessThan(fire);
  });
});

describe("getPrimaryDeductibleRate", () => {
  it("fire has zero deductible", () => {
    expect(getPrimaryDeductibleRate("fire")).toBe(0);
  });

  it("water has nonzero deductible", () => {
    expect(getPrimaryDeductibleRate("water")).toBeGreaterThan(0);
  });

  it("earthquake has highest deductible", () => {
    const earthquake = getPrimaryDeductibleRate("earthquake");
    const water = getPrimaryDeductibleRate("water");
    expect(earthquake).toBeGreaterThan(water);
  });
});
