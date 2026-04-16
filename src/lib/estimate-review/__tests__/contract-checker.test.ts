import { describe, expect, it } from "vitest";
import {
  checkContractClauses,
  type ContractClause,
  type EstimateForCheck,
} from "../contract-checker.js";

function makeClause(overrides: Partial<ContractClause> = {}): ContractClause {
  return {
    defectWarrantyMonths: 24,
    delayPenaltyRatePct: 0.05,
    changeOrderClause: true,
    paymentTermDays: 30,
    ...overrides,
  };
}

function makeEstimate(overrides: Partial<EstimateForCheck> = {}): EstimateForCheck {
  return {
    totalAmount: 10_000_000,
    paymentTermDays: 30,
    ...overrides,
  };
}

describe("checkContractClauses", () => {
  it("returns allOk=true for a clean contract", () => {
    const result = checkContractClauses(makeClause(), makeEstimate());
    expect(result.allOk).toBe(true);
    expect(result.defectWarranty.ok).toBe(true);
    expect(result.delayPenalty.ok).toBe(true);
    expect(result.changeOrder.ok).toBe(true);
    expect(result.paymentTerm.ok).toBe(true);
  });

  it("flags defect warranty shorter than 12 months", () => {
    const result = checkContractClauses(
      makeClause({ defectWarrantyMonths: 6 }),
      makeEstimate(),
    );
    expect(result.defectWarranty.ok).toBe(false);
    expect(result.allOk).toBe(false);
  });

  it("flags missing change order clause", () => {
    const result = checkContractClauses(
      makeClause({ changeOrderClause: false }),
      makeEstimate(),
    );
    expect(result.changeOrder.ok).toBe(false);
    expect(result.allOk).toBe(false);
  });

  it("flags payment term mismatch between estimate and contract", () => {
    const result = checkContractClauses(
      makeClause({ paymentTermDays: 30 }),
      makeEstimate({ paymentTermDays: 45 }),
    );
    expect(result.paymentTerm.ok).toBe(false);
    expect(result.paymentTerm.message).toContain("不一致");
    expect(result.allOk).toBe(false);
  });
});
