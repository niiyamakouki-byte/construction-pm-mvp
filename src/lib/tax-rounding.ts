/**
 * Tax rounding setting for GenbaHub estimates.
 * Provenance: bead 87di3, base 7d89cb5, author Codex.
 */

export const TAX_ROUNDING_STORAGE_KEY = "genbahub:estimate-tax-rounding";

export type TaxRoundingMode = "floor" | "round" | "ceil";

export const TAX_ROUNDING_LABELS: Record<TaxRoundingMode, string> = {
  floor: "切捨て",
  round: "四捨五入",
  ceil: "切上げ",
};

export function applyTaxRounding(value: number, mode: TaxRoundingMode): number {
  if (mode === "ceil") return Math.ceil(value);
  if (mode === "round") return Math.round(value);
  return Math.floor(value);
}

export function readTaxRoundingMode(): TaxRoundingMode {
  if (typeof window === "undefined" || typeof window.localStorage?.getItem !== "function") return "floor";
  const saved = window.localStorage.getItem(TAX_ROUNDING_STORAGE_KEY);
  return saved === "round" || saved === "ceil" ? saved : "floor";
}

export function writeTaxRoundingMode(mode: TaxRoundingMode): void {
  if (typeof window !== "undefined" && typeof window.localStorage?.setItem === "function") {
    window.localStorage.setItem(TAX_ROUNDING_STORAGE_KEY, mode);
  }
}
