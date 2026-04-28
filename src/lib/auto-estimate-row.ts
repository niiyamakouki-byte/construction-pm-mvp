/**
 * AutoEstimateRow — convert an approved EstimateSuggestion into an EstimateLine.
 * Sprint 3-6: Photo pin → measure → estimate auto-link.
 *
 * Pure function, no I/O. Callers pass the suggestion + optional overrides.
 */

import type { EstimateLine } from "../estimate/types.js";
import type { EstimateSuggestion } from "./measurement-to-estimate-link.js";

export type AutoEstimateRowOptions = {
  /** Override quantity (defaults to suggestion.quantity) */
  quantity?: number;
  /** Override unit price (defaults to suggestion.unitPrice) */
  unitPriceOverride?: number;
  /** Extra note appended to the item note */
  note?: string;
};

/**
 * Accept a suggestion and return an EstimateLine ready to be appended to a
 * section's lines array.  Quantity and unitPrice can be overridden.
 */
export function acceptSuggestion(
  suggestion: EstimateSuggestion,
  options: AutoEstimateRowOptions = {},
): EstimateLine {
  const quantity = options.quantity ?? suggestion.quantity;
  const unitPrice = options.unitPriceOverride ?? suggestion.unitPrice;
  const amount = Math.round(quantity * unitPrice);
  const note = options.note ?? "";

  return {
    code: suggestion.code,
    name: suggestion.name,
    unit: suggestion.unit,
    quantity,
    unitPrice,
    amount,
    note,
  };
}

/**
 * Accept multiple suggestions at once, returning one EstimateLine per entry.
 * Useful when the user approves a batch from the suggestion list.
 */
export function acceptSuggestions(
  suggestions: EstimateSuggestion[],
  optionsList: AutoEstimateRowOptions[] = [],
): EstimateLine[] {
  return suggestions.map((s, i) => acceptSuggestion(s, optionsList[i] ?? {}));
}
