/** bead 87di3 tax-rounding verification. Base 7d89cb5. Author: Codex. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  TAX_ROUNDING_STORAGE_KEY,
  applyTaxRounding,
  readTaxRoundingMode,
  writeTaxRoundingMode,
} from "./tax-rounding.js";

describe("tax rounding", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
  });

  it.each([
    ["floor", 100] as const,
    ["round", 101] as const,
    ["ceil", 101] as const,
  ])("calculates %s correctly", (mode, expected) => {
    expect(applyTaxRounding(100.6, mode)).toBe(expected);
  });

  it("defaults to floor and persists a selected mode", () => {
    expect(readTaxRoundingMode()).toBe("floor");
    writeTaxRoundingMode("ceil");
    expect(localStorage.getItem(TAX_ROUNDING_STORAGE_KEY)).toBe("ceil");
    expect(readTaxRoundingMode()).toBe("ceil");
  });
});
