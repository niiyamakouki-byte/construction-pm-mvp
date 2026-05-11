/**
 * 平兵衛くん蒸留 — 図面拾い出しロジック層
 * Trace-to-takeoff quantity calculation engine for construction drawings.
 * Pure logic only; no UI or Canvas dependencies.
 */

import { createRepository } from "./repository/index.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type TakeoffPoint = { x: number; y: number };

export type TakeoffShape = {
  id: string;
  type: "polygon" | "polyline" | "rectangle" | "circle";
  points: TakeoffPoint[];
  radius?: number;
};

export type TakeoffMeasurement = {
  id: string;
  shapeId: string;
  measureType: "area" | "length" | "perimeter" | "count";
  rawValue: number;
  scaledValue: number;
  unit: "mm" | "m" | "㎡";
};

/** paperScale e.g. "1:50" means 1 unit on paper = 50 units in real world */
export type DrawingScale = {
  pixelsPerMeter: number;
  paperScale: string;
};

export type TakeoffItem = {
  id: string;
  measurement: TakeoffMeasurement;
  materialCode?: string;
  materialName: string;
  unit: string;
  quantity: number;
  wasteFactor: number;
  totalQuantity: number;
  note?: string;
};

export type TakeoffSession = {
  id: string;
  projectId: string;
  drawingId: string;
  scale: DrawingScale;
  items: TakeoffItem[];
  createdAt: Date;
  updatedAt: Date;
};

export type TakeoffSummary = {
  totalItems: number;
  byCategory: Record<
    string,
    { count: number; totalArea?: number; totalLength?: number }
  >;
  estimatedCost?: number;
};

export type CostMasterEntry = {
  code: string;
  name: string;
  unit: string;
  unitPrice: number;
};

// ── Geometry calculations (pixel space) ────────────────────────────────────

/**
 * Calculate area of a shape in pixels².
 * - polygon/rectangle: Shoelace (Gauss) formula
 * - circle: π·r²
 */
export function calculateArea(shape: TakeoffShape): number {
  switch (shape.type) {
    case "circle": {
      const r = shape.radius ?? 0;
      return Math.PI * r * r;
    }
    case "polygon":
    case "rectangle": {
      const pts = shape.points;
      if (pts.length < 3) return 0;
      let sum = 0;
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const curr = pts[i]!;
        const next = pts[(i + 1) % n]!;
        sum += curr.x * next.y - next.x * curr.y;
      }
      return Math.abs(sum) / 2;
    }
    case "polyline":
      return 0;
  }
}

/**
 * Calculate perimeter in pixels.
 * - polygon/rectangle: sum of all edge lengths (closed)
 * - circle: 2·π·r
 * - polyline: open chain length
 */
export function calculatePerimeter(shape: TakeoffShape): number {
  switch (shape.type) {
    case "circle": {
      const r = shape.radius ?? 0;
      return 2 * Math.PI * r;
    }
    case "polygon":
    case "rectangle": {
      const pts = shape.points;
      if (pts.length < 2) return 0;
      let total = 0;
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const curr = pts[i]!;
        const next = pts[(i + 1) % n]!;
        const dx = next.x - curr.x;
        const dy = next.y - curr.y;
        total += Math.sqrt(dx * dx + dy * dy);
      }
      return total;
    }
    case "polyline":
      return calculateLength(shape);
  }
}

/**
 * Calculate open-chain length in pixels for a polyline.
 */
export function calculateLength(shape: TakeoffShape): number {
  const pts = shape.points;
  if (pts.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const curr = pts[i]!;
    const next = pts[i + 1]!;
    const dx = next.x - curr.x;
    const dy = next.y - curr.y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

// ── Scale conversion ─────────────────────────────────────────────────────────

/**
 * Convert a pixel measurement to real-world units using the drawing scale.
 *
 * @param pixelValue   Raw value in pixel units (px² for area, px for length)
 * @param scale        DrawingScale with pixelsPerMeter
 * @param measureType  Determines conversion formula
 * @returns Scaled real-world value (㎡ for area, m for length/perimeter)
 */
export function applyScale(
  pixelValue: number,
  scale: DrawingScale,
  measureType: TakeoffMeasurement["measureType"],
): number {
  const ppm = scale.pixelsPerMeter;
  if (ppm <= 0) return 0;
  switch (measureType) {
    case "area":
      // px² → m²
      return pixelValue / (ppm * ppm);
    case "length":
    case "perimeter":
      // px → m
      return pixelValue / ppm;
    case "count":
      return pixelValue;
  }
}

/**
 * Calculate DrawingScale from a calibration reference.
 *
 * @param knownLengthPixels  Pixel distance of a known segment on the drawing
 * @param knownLengthMeters  Real-world length of that segment in meters
 */
export function setDrawingScale(
  knownLengthPixels: number,
  knownLengthMeters: number,
): DrawingScale {
  if (knownLengthPixels <= 0 || knownLengthMeters <= 0) {
    return { pixelsPerMeter: 0, paperScale: "1:1" };
  }
  const pixelsPerMeter = knownLengthPixels / knownLengthMeters;
  // Derive a round-number paper scale ratio (px/m → 1:N where N = 1/scale_m_per_px * paper_mm_per_m)
  // We express it as the inverse relationship for display purposes.
  const ratio = Math.round(1000 / (knownLengthMeters / (knownLengthPixels / 96)));
  const paperScale = `1:${ratio}`;
  return { pixelsPerMeter, paperScale };
}

// ── Waste factors ────────────────────────────────────────────────────────────

const WASTE_FACTORS: Record<string, number> = {
  クロス: 0.1,
  壁紙: 0.1,
  タイルカーペット: 0.05,
  フローリング: 0.08,
  塗装: 0.15,
  PB: 0.05,
  石膏ボード: 0.05,
  LGS: 0.03,
  軽量鉄骨: 0.03,
  タイル: 0.1,
  フロアタイル: 0.07,
  カーペット: 0.1,
  モルタル: 0.1,
  コンクリート: 0.05,
  木材: 0.1,
  サッシ: 0.0,
  ドア: 0.0,
  その他: 0.05,
};

/**
 * Return standard waste factor for a material category.
 * Falls back to 0.05 (5%) for unknown categories.
 */
export function getDefaultWasteFactor(materialCategory: string): number {
  return WASTE_FACTORS[materialCategory] ?? 0.05;
}

// ── TakeoffItem construction ─────────────────────────────────────────────────

let _itemCounter = 0;

function nextId(prefix: string): string {
  return `${prefix}-${++_itemCounter}-${Date.now()}`;
}

/**
 * Create a TakeoffItem from a measurement, applying waste factor.
 *
 * @param measurement   The raw + scaled measurement
 * @param materialName  Display name of the material
 * @param unit          Unit string (e.g. "㎡", "m", "本")
 * @param wasteFactor   Override waste factor; defaults to category lookup
 */
export function createTakeoffItem(
  measurement: TakeoffMeasurement,
  materialName: string,
  unit: string,
  wasteFactor?: number,
  materialCode?: string,
  note?: string,
): TakeoffItem {
  const wf = wasteFactor ?? getDefaultWasteFactor(materialName);
  const quantity = measurement.scaledValue;
  const totalQuantity = quantity * (1 + wf);
  return {
    id: nextId("item"),
    measurement,
    materialCode,
    materialName,
    unit,
    quantity,
    wasteFactor: wf,
    totalQuantity,
    note,
  };
}

// ── Summary ──────────────────────────────────────────────────────────────────

/**
 * Generate a summary of a TakeoffSession grouped by material name.
 */
export function summarizeTakeoff(session: TakeoffSession): TakeoffSummary {
  const byCategory: TakeoffSummary["byCategory"] = {};

  for (const item of session.items) {
    const cat = item.materialName;
    if (!byCategory[cat]) {
      byCategory[cat] = { count: 0 };
    }
    const entry = byCategory[cat]!;
    entry.count += 1;
    const mt = item.measurement.measureType;
    if (mt === "area") {
      entry.totalArea = (entry.totalArea ?? 0) + item.totalQuantity;
    } else if (mt === "length" || mt === "perimeter") {
      entry.totalLength = (entry.totalLength ?? 0) + item.totalQuantity;
    }
  }

  return {
    totalItems: session.items.length,
    byCategory,
  };
}

// ── CSV export ───────────────────────────────────────────────────────────────

/**
 * Export session to CSV string.
 * Columns: 品目, 数量, 単位, ロス率, 合計数量, 備考
 */
export function exportTakeoffCSV(session: TakeoffSession): string {
  const header = "品目,数量,単位,ロス率,合計数量,備考";
  const rows = session.items.map((item) => {
    const qty = item.quantity.toFixed(3);
    const total = item.totalQuantity.toFixed(3);
    const loss = (item.wasteFactor * 100).toFixed(1);
    const note = item.note ?? "";
    // Escape fields containing commas or quotes
    const fields = [item.materialName, qty, item.unit, `${loss}%`, total, note].map(
      (f) => (f.includes(",") || f.includes('"') ? `"${f.replace(/"/g, '""')}"` : f),
    );
    return fields.join(",");
  });
  return [header, ...rows].join("\n");
}

// ── Merge sessions ───────────────────────────────────────────────────────────

/**
 * Merge multiple TakeoffSessions (from different drawings) into one summary.
 * Returns a synthetic session containing all items.
 */
export function mergeTakeoffSessions(sessions: TakeoffSession[]): TakeoffSession {
  const allItems = sessions.flatMap((s) => s.items);
  const first = sessions[0];
  const now = new Date();
  return {
    id: nextId("merged"),
    projectId: first?.projectId ?? "",
    drawingId: "merged",
    scale: first?.scale ?? { pixelsPerMeter: 1, paperScale: "1:1" },
    items: allItems,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Cost estimation ──────────────────────────────────────────────────────────

/**
 * Cross-reference session items with a cost master to estimate total cost.
 *
 * @param session     TakeoffSession with items
 * @param costMaster  Array of {code, name, unit, unitPrice}
 * @returns Total estimated cost in yen (unmatched items contribute 0)
 */
export function calculateCostEstimate(
  session: TakeoffSession,
  costMaster: CostMasterEntry[],
): number {
  const byCode = new Map(costMaster.map((e) => [e.code, e]));
  const byName = new Map(costMaster.map((e) => [e.name, e]));

  let total = 0;
  for (const item of session.items) {
    const entry =
      (item.materialCode ? byCode.get(item.materialCode) : undefined) ??
      byName.get(item.materialName);
    if (entry) {
      total += item.totalQuantity * entry.unitPrice;
    }
  }
  return total;
}

// Repository-pattern accessor (for gradual migration to Supabase)
export const takeoffSessionRepository = createRepository<TakeoffSession>('takeoff_sessions');

// ── Sprint 64: スナップ + AI補完 ──────────────────────────────────────────────

/**
 * Snap a candidate point to the nearest existing point if it is within the
 * snap radius.  Returns the snapped point (or the original if nothing is near).
 *
 * @param candidate   The raw clicked pixel position
 * @param existing    Previously placed points in the current trace
 * @param snapRadius  Maximum pixel distance to trigger snapping (default 12 px)
 */
export function snapToExistingPoint(
  candidate: TakeoffPoint,
  existing: TakeoffPoint[],
  snapRadius = 12,
): TakeoffPoint {
  let nearest: TakeoffPoint | null = null;
  let nearestDist = Infinity;
  for (const pt of existing) {
    const dx = candidate.x - pt.x;
    const dy = candidate.y - pt.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < snapRadius && d < nearestDist) {
      nearest = pt;
      nearestDist = d;
    }
  }
  return nearest ?? candidate;
}

/**
 * Snap a candidate point to the nearest axis-aligned extension of any segment
 * defined by the existing points list.  This approximates "wall-line snapping"
 * — if the cursor is within `snapRadius` px of a horizontal or vertical
 * projection of an existing segment, the point is projected onto that line.
 *
 * Returns the (possibly snapped) point.
 */
export function snapToAxisLine(
  candidate: TakeoffPoint,
  existing: TakeoffPoint[],
  snapRadius = 10,
): TakeoffPoint {
  if (existing.length === 0) return candidate;
  let bestDist = snapRadius;
  let best: TakeoffPoint = candidate;
  for (const pt of existing) {
    // Horizontal snap: candidate.y close to pt.y
    const dy = Math.abs(candidate.y - pt.y);
    if (dy < bestDist) {
      bestDist = dy;
      best = { x: candidate.x, y: pt.y };
    }
    // Vertical snap: candidate.x close to pt.x
    const dx = Math.abs(candidate.x - pt.x);
    if (dx < bestDist) {
      bestDist = dx;
      best = { x: pt.x, y: candidate.y };
    }
  }
  return best;
}

/**
 * Determine whether a candidate point is close enough to the first point of an
 * open polygon to trigger auto-close.
 *
 * @param candidate  Newly clicked point
 * @param first      First point of the current trace
 * @param threshold  Pixel distance to trigger close (default 16 px)
 */
export function isNearFirstPoint(
  candidate: TakeoffPoint,
  first: TakeoffPoint,
  threshold = 16,
): boolean {
  const dx = candidate.x - first.x;
  const dy = candidate.y - first.y;
  return Math.sqrt(dx * dx + dy * dy) < threshold;
}

/**
 * Predict the most likely next point in an open polyline based on the
 * direction and step size of the most recent segment.  If fewer than two
 * points exist, returns null.
 *
 * Algorithm: simple linear extrapolation from the last two points.
 * Pure numerical, no LLM required.
 *
 * @param points  Current list of traced points (≥ 2 required)
 * @returns Predicted next point, or null if not enough data
 */
export function predictNextPoint(
  points: TakeoffPoint[],
): TakeoffPoint | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1]!;
  const prev = points[points.length - 2]!;
  const dx = last.x - prev.x;
  const dy = last.y - prev.y;
  return { x: last.x + dx, y: last.y + dy };
}

/**
 * Snap and predict pipeline: apply axis-line snap, then point snap, then
 * optionally return a ghost prediction for the next point.
 *
 * Returns `{ snapped, prediction }` where prediction may be null.
 */
export function processPickupPoint(
  candidate: TakeoffPoint,
  existing: TakeoffPoint[],
  snapRadius = 12,
  axisSnapRadius = 10,
): { snapped: TakeoffPoint; prediction: TakeoffPoint | null } {
  const axisSnapped = snapToAxisLine(candidate, existing, axisSnapRadius);
  const snapped = snapToExistingPoint(axisSnapped, existing, snapRadius);
  const allPoints = [...existing, snapped];
  const prediction = predictNextPoint(allPoints);
  return { snapped, prediction };
}
