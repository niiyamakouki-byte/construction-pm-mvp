/**
 * Loss aggregator — runs all detectors and rolls up results.
 */

import type { LossSignal, LossSummary, OrderRecord, LaborRecord } from "./types.js";
import { LossKind } from "./types.js";
import {
  detectMaterialSurplus,
  detectShortageEmergency,
  detectLaborOverrun,
  detectOutOfScopeOrder,
  detectPriceCreep,
  detectWastageHigh,
} from "./detector-rules.js";

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Run all 6 detectors and return the combined signal list.
 */
export function runAllDetectors(
  orders: OrderRecord[],
  labor: LaborRecord[],
): LossSignal[] {
  return [
    ...detectMaterialSurplus(orders),
    ...detectShortageEmergency(orders),
    ...detectLaborOverrun(labor),
    ...detectOutOfScopeOrder(orders),
    ...detectPriceCreep(orders),
    ...detectWastageHigh(orders),
  ];
}

/**
 * Aggregate signals into a LossSummary for a single project.
 * Signals must all share the same projectId (or be filtered before calling).
 */
export function aggregateLoss(signals: LossSignal[]): LossSummary {
  const projectId = signals[0]?.projectId ?? "";

  const totalLossYen = signals.reduce((s, sig) => s + sig.lossYen, 0);

  const byKind = Object.fromEntries(
    Object.values(LossKind).map((k) => [k, 0]),
  ) as Record<LossKind, number>;

  for (const sig of signals) {
    byKind[sig.kind] += sig.lossYen;
  }

  return {
    projectId,
    totalLossYen,
    signals,
    byKind,
    generatedAt: new Date().toISOString(),
  };
}
