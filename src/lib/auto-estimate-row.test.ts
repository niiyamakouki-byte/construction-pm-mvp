import { describe, it, expect } from "vitest";
import { acceptSuggestion, acceptSuggestions } from "./auto-estimate-row.js";
import type { EstimateSuggestion } from "./measurement-to-estimate-link.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSuggestion(overrides: Partial<EstimateSuggestion> = {}): EstimateSuggestion {
  return {
    rank: 1,
    code: "IN-009",
    name: "フローリング（複合）",
    unit: "㎡",
    unitPrice: 8000,
    quantity: 20,
    amount: 160000,
    ...overrides,
  };
}

// ── acceptSuggestion ──────────────────────────────────────────────────────────

describe("acceptSuggestion", () => {
  it("produces an EstimateLine with correct code and name", () => {
    const line = acceptSuggestion(makeSuggestion());
    expect(line.code).toBe("IN-009");
    expect(line.name).toBe("フローリング（複合）");
  });

  it("uses suggestion quantity by default", () => {
    const line = acceptSuggestion(makeSuggestion({ quantity: 15 }));
    expect(line.quantity).toBe(15);
  });

  it("overrides quantity when provided", () => {
    const line = acceptSuggestion(makeSuggestion({ quantity: 15 }), { quantity: 25 });
    expect(line.quantity).toBe(25);
  });

  it("uses suggestion unitPrice by default", () => {
    const line = acceptSuggestion(makeSuggestion());
    expect(line.unitPrice).toBe(8000);
  });

  it("overrides unitPrice when provided", () => {
    const line = acceptSuggestion(makeSuggestion(), { unitPriceOverride: 7500 });
    expect(line.unitPrice).toBe(7500);
  });

  it("computes amount = quantity × unitPrice (rounded)", () => {
    // 7.3 ㎡ × 8000 = 58400
    const line = acceptSuggestion(makeSuggestion({ quantity: 7.3 }));
    expect(line.amount).toBe(58400);
  });

  it("rounds fractional amounts", () => {
    // 1.5 × 3333 = 4999.5 → rounds to 5000
    const line = acceptSuggestion(makeSuggestion({ unitPrice: 3333, quantity: 1.5 }));
    expect(line.amount).toBe(Math.round(1.5 * 3333));
  });

  it("defaults note to empty string", () => {
    const line = acceptSuggestion(makeSuggestion());
    expect(line.note).toBe("");
  });

  it("passes note through when provided", () => {
    const line = acceptSuggestion(makeSuggestion(), { note: "1F リビング" });
    expect(line.note).toBe("1F リビング");
  });

  it("preserves unit from suggestion", () => {
    const line = acceptSuggestion(makeSuggestion({ unit: "m" }));
    expect(line.unit).toBe("m");
  });
});

// ── acceptSuggestions ─────────────────────────────────────────────────────────

describe("acceptSuggestions", () => {
  it("returns one EstimateLine per suggestion", () => {
    const s1 = makeSuggestion({ code: "IN-005", name: "クロス", quantity: 10, unitPrice: 1200, amount: 12000 });
    const s2 = makeSuggestion({ code: "IN-009", name: "フローリング", quantity: 20, unitPrice: 8000, amount: 160000 });
    const lines = acceptSuggestions([s1, s2]);
    expect(lines).toHaveLength(2);
    expect(lines[0]!.code).toBe("IN-005");
    expect(lines[1]!.code).toBe("IN-009");
  });

  it("applies per-item options", () => {
    const s = makeSuggestion();
    const lines = acceptSuggestions([s], [{ quantity: 99 }]);
    expect(lines[0]!.quantity).toBe(99);
  });

  it("handles empty suggestions list", () => {
    expect(acceptSuggestions([])).toEqual([]);
  });

  it("uses default options when optionsList is shorter than suggestions", () => {
    const s1 = makeSuggestion({ code: "IN-005", quantity: 10, unitPrice: 1200, amount: 12000 });
    const s2 = makeSuggestion({ code: "IN-009", quantity: 20, unitPrice: 8000, amount: 160000 });
    // optionsList has only one entry; s2 should fall back to defaults
    const lines = acceptSuggestions([s1, s2], [{ quantity: 5 }]);
    expect(lines[0]!.quantity).toBe(5);
    expect(lines[1]!.quantity).toBe(20); // default from suggestion
  });

  it("sums amounts correctly across lines", () => {
    const s1 = makeSuggestion({ code: "IN-005", quantity: 10, unitPrice: 1200, amount: 12000 });
    const s2 = makeSuggestion({ code: "IN-009", quantity: 5, unitPrice: 8000, amount: 40000 });
    const lines = acceptSuggestions([s1, s2]);
    const total = lines.reduce((sum, l) => sum + l.amount, 0);
    expect(total).toBe(52000);
  });
});
