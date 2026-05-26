/**
 * Cost-loss detector — shared types.
 *
 * All monetary values are in JPY (円).
 */

// ── Enums ──────────────────────────────────────────────────────────────────

export const LossKind = {
  material_surplus: "material_surplus",
  material_shortage_emergency: "material_shortage_emergency",
  labor_overrun: "labor_overrun",
  out_of_scope_order: "out_of_scope_order",
  price_creep: "price_creep",
  wastage_high: "wastage_high",
} as const;

export type LossKind = (typeof LossKind)[keyof typeof LossKind];

export type Severity = "info" | "warning" | "critical";

// ── Core domain objects ────────────────────────────────────────────────────

export type LossSignal = {
  id: string;
  projectId: string;
  kind: LossKind;
  severity: Severity;
  detectedAt: string;
  /** IDs of the orders/labor records that triggered this signal */
  evidenceRefs: string[];
  /** Estimated loss in JPY */
  lossYen: number;
  message: string;
  suggestedAction: string;
};

export type OrderRecord = {
  id: string;
  projectId: string;
  vendorId: string;
  itemCode: string;
  qty: number;
  unit: string;
  unitPriceYen: number;
  /** Planned quantity from estimate */
  plannedQty?: number;
  /** Planned unit price from estimate */
  plannedUnitPriceYen?: number;
  /** Whether this order was in the original scope */
  scope: "in_scope" | "extra";
  orderedAt: string;
  /** Quantity confirmed as actually used (for wastage calculation) */
  usedQty?: number;
};

export type LaborRecord = {
  id: string;
  projectId: string;
  workerId: string;
  hoursActual: number;
  hoursPlanned: number;
  taskId: string;
  recordedAt: string;
};

export type LossSummary = {
  projectId: string;
  totalLossYen: number;
  signals: LossSignal[];
  byKind: Record<LossKind, number>;
  generatedAt: string;
};
