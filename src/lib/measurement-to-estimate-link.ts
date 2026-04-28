/**
 * MeasurementToEstimateLink — suggest cost-master items from a measurement.
 * Sprint 3-6: Photo pin → measure → estimate auto-link.
 *
 * Pure logic, no I/O. Accepts a flat cost-master item list and a measurement
 * kind + unit, returns ranked suggestions.
 */

import type { MeasureKind } from "./photo-pin-measure.js";

export type CostMasterEntry = {
  code: string;
  name: string;
  unit: string;
  unitPrice: number;
  categoryId?: string;
  categoryName?: string;
};

export type EstimateSuggestion = {
  rank: number;
  code: string;
  name: string;
  unit: string;
  unitPrice: number;
  /** Estimated quantity = measurement value (no waste added) */
  quantity: number;
  /** Estimated amount = quantity × unitPrice */
  amount: number;
};

/**
 * Keyword-based affinity table: Japanese material keywords → cost-master units.
 * Used to prioritise items whose unit matches the measurement kind.
 */
const AREA_UNITS = new Set(["㎡", "m²"]);
const LENGTH_UNITS = new Set(["m", "ml"]);

/**
 * Suggest cost-master items for a measurement.
 *
 * @param measureKind  "area" or "distance"
 * @param value        measured value (㎡ for area, m for distance)
 * @param items        flat list of cost-master entries to search
 * @param hint         optional Japanese keyword to narrow search (e.g. "クロス", "フローリング")
 * @param maxResults   max suggestions to return (default 5)
 */
export function suggestEstimateItems(
  measureKind: MeasureKind,
  value: number,
  items: CostMasterEntry[],
  hint = "",
  maxResults = 5,
): EstimateSuggestion[] {
  const targetUnits = measureKind === "area" ? AREA_UNITS : LENGTH_UNITS;

  // Filter to items whose unit matches the measure kind
  const unitMatched = items.filter((i) => targetUnits.has(i.unit));

  // Score each item: hint keyword match boosts score
  const scored = unitMatched.map((item) => {
    let score = 0;
    if (hint) {
      const lowerHint = hint.toLowerCase();
      if (item.name.toLowerCase().includes(lowerHint)) score += 10;
      if (item.code.toLowerCase().includes(lowerHint)) score += 5;
      if (item.categoryName?.toLowerCase().includes(lowerHint)) score += 3;
    }
    return { item, score };
  });

  // Sort: higher score first, then by code alphabetically for stability
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.item.code.localeCompare(b.item.code);
  });

  return scored.slice(0, maxResults).map(({ item }, idx) => ({
    rank: idx + 1,
    code: item.code,
    name: item.name,
    unit: item.unit,
    unitPrice: item.unitPrice,
    quantity: value,
    amount: Math.round(value * item.unitPrice),
  }));
}

/**
 * Return the single best suggestion, or null if no items match the unit.
 */
export function topSuggestion(
  measureKind: MeasureKind,
  value: number,
  items: CostMasterEntry[],
  hint = "",
): EstimateSuggestion | null {
  const results = suggestEstimateItems(measureKind, value, items, hint, 1);
  return results[0] ?? null;
}
