/**
 * PhotoPinMeasure — ties a drawing pin to a measurement (distance or area).
 * Sprint 3-6: Photo pin → measure → estimate auto-link.
 */

export type MeasureKind = "distance" | "area";

export type PhotoPinMeasure = {
  id: string;
  /** References a DrawingPin id */
  pinId: string;
  photoId: string;
  drawingId: string;
  kind: MeasureKind;
  /** Distance in metres (kind === "distance") or area in ㎡ (kind === "area") */
  value: number;
  unit: "m" | "㎡";
  /** Optional scale used for calibration (px/mm). 0 = uncalibrated */
  scalePxPerMm: number;
  note: string;
  createdAt: string; // ISO datetime
};

// In-memory store keyed by drawingId (matches drawing-photo-link.ts pattern)
const store = new Map<string, PhotoPinMeasure[]>();

export function _resetForTest(): void {
  store.clear();
}

function load(drawingId: string): PhotoPinMeasure[] {
  return store.get(drawingId) ?? [];
}

function save(drawingId: string, items: PhotoPinMeasure[]): void {
  store.set(drawingId, items);
}

/**
 * Attach a measurement to a pin+photo in a drawing.
 */
export function createPhotoPinMeasure(
  pinId: string,
  photoId: string,
  drawingId: string,
  kind: MeasureKind,
  value: number,
  scalePxPerMm = 0,
  note = "",
): PhotoPinMeasure {
  const unit: "m" | "㎡" = kind === "area" ? "㎡" : "m";
  const record: PhotoPinMeasure = {
    id: crypto.randomUUID(),
    pinId,
    photoId,
    drawingId,
    kind,
    value,
    unit,
    scalePxPerMm,
    note,
    createdAt: new Date().toISOString(),
  };
  const existing = load(drawingId);
  save(drawingId, [...existing, record]);
  return record;
}

/**
 * Return all measurements attached to a specific pin.
 */
export function getMeasuresForPin(pinId: string, drawingId: string): PhotoPinMeasure[] {
  return load(drawingId).filter((m) => m.pinId === pinId);
}

/**
 * Return all measurements for a drawing.
 */
export function getMeasuresForDrawing(drawingId: string): PhotoPinMeasure[] {
  return load(drawingId);
}

/**
 * Update the value (and optionally note) of an existing measurement.
 * Returns updated record or null if not found.
 */
export function updatePhotoPinMeasure(
  drawingId: string,
  id: string,
  patch: { value?: number; note?: string },
): PhotoPinMeasure | null {
  const items = load(drawingId);
  let updated: PhotoPinMeasure | null = null;
  const next = items.map((m) => {
    if (m.id !== id) return m;
    updated = { ...m, ...patch };
    return updated;
  });
  if (!updated) return null;
  save(drawingId, next);
  return updated;
}

/**
 * Remove a measurement by id. Returns true if removed.
 */
export function deletePhotoPinMeasure(drawingId: string, id: string): boolean {
  const before = load(drawingId);
  const after = before.filter((m) => m.id !== id);
  if (after.length === before.length) return false;
  save(drawingId, after);
  return true;
}
