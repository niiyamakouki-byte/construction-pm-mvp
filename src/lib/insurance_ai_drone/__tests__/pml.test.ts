import { describe, expect, it } from "vitest";
import { calculatePml, type PmlInput } from "../pml.js";

function baseInput(overrides: Partial<PmlInput> = {}): PmlInput {
  return {
    structureType: "rc",
    seismicGrade: "standard_1981",
    buildingAgeYears: 20,
    damageHistoryCount: 0,
    retrofitCompleted: false,
    ...overrides,
  };
}

describe("calculatePml", () => {
  it("returns pml between 0 and 100", () => {
    const result = calculatePml(baseInput());
    expect(result.pmlPercent).toBeGreaterThan(0);
    expect(result.pmlPercent).toBeLessThanOrEqual(100);
  });

  it("pre_1981 seismic grade gives higher PML than enhanced_2000", () => {
    const old = calculatePml(baseInput({ seismicGrade: "pre_1981" }));
    const new_ = calculatePml(baseInput({ seismicGrade: "enhanced_2000" }));
    expect(old.pmlPercent).toBeGreaterThan(new_.pmlPercent);
  });

  it("wood structure has higher PML than RC", () => {
    const wood = calculatePml(baseInput({ structureType: "wood" }));
    const rc = calculatePml(baseInput({ structureType: "rc" }));
    expect(wood.pmlPercent).toBeGreaterThan(rc.pmlPercent);
  });

  it("older building has higher PML", () => {
    const old = calculatePml(baseInput({ buildingAgeYears: 40 }));
    const new_ = calculatePml(baseInput({ buildingAgeYears: 5 }));
    expect(old.pmlPercent).toBeGreaterThan(new_.pmlPercent);
  });

  it("retrofit reduces PML", () => {
    const noRetrofit = calculatePml(baseInput({ retrofitCompleted: false }));
    const withRetrofit = calculatePml(
      baseInput({ retrofitCompleted: true, retrofitYearsAgo: 3 })
    );
    expect(withRetrofit.pmlPercent).toBeLessThan(noRetrofit.pmlPercent);
  });

  it("damage history increases PML", () => {
    const noDamage = calculatePml(baseInput({ damageHistoryCount: 0 }));
    const withDamage = calculatePml(baseInput({ damageHistoryCount: 5 }));
    expect(withDamage.pmlPercent).toBeGreaterThan(noDamage.pmlPercent);
  });

  it("classifies very low risk correctly", () => {
    const result = calculatePml(
      baseInput({
        structureType: "src",
        seismicGrade: "enhanced_2000",
        buildingAgeYears: 3,
        retrofitCompleted: false,
      })
    );
    expect(["very_low", "low"]).toContain(result.riskLevel);
  });

  it("classifies high risk for pre-1981 wood structure", () => {
    const result = calculatePml(
      baseInput({
        structureType: "wood",
        seismicGrade: "pre_1981",
        buildingAgeYears: 50,
        damageHistoryCount: 3,
      })
    );
    expect(["high", "very_high"]).toContain(result.riskLevel);
  });

  it("breakdown fields are populated", () => {
    const result = calculatePml(baseInput());
    expect(result.breakdown.baseRate).toBeGreaterThan(0);
    expect(result.breakdown.structureFactor).toBeGreaterThan(0);
    expect(result.breakdown.ageMultiplier).toBeGreaterThan(0);
  });

  it("includes notes", () => {
    const result = calculatePml(baseInput());
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it("retrofit discount is 0 when not completed", () => {
    const result = calculatePml(baseInput({ retrofitCompleted: false }));
    expect(result.breakdown.retrofitDiscount).toBe(0);
  });
});
