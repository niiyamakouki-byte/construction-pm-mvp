/**
 * Scale measurement logic for construction drawing viewer.
 */

export type Point = { x: number; y: number };

const STORAGE_KEY_PREFIX = "drawing_scale_";

/**
 * Calculate scale (px/mm) from two pixel points and a known real distance.
 */
export function calibrateScale(
  point1: Point,
  point2: Point,
  realDistanceMm: number
): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  const pixelDistance = Math.sqrt(dx * dx + dy * dy);
  if (pixelDistance === 0 || realDistanceMm <= 0) return 0;
  return pixelDistance / realDistanceMm;
}

/**
 * Measure real distance in mm between two pixel-space points using the scale.
 * Returns { valueMm, valueM, label } with auto-switched unit label.
 */
export function measureDistance(
  point1: Point,
  point2: Point,
  scale: number
): { valueMm: number; valueM: number; label: string } {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  const pixelDistance = Math.sqrt(dx * dx + dy * dy);
  const valueMm = scale > 0 ? pixelDistance / scale : 0;
  const valueM = valueMm / 1000;
  const label = valueMm >= 1000 ? `${valueM.toFixed(2)} m` : `${Math.round(valueMm)} mm`;
  return { valueMm, valueM, label };
}

/**
 * Measure area of a polygon (in ㎡) using the Shoelace formula.
 * Points are in pixel space. Scale is px/mm.
 */
export function measureArea(points: Point[], scale: number): number {
  if (points.length < 3 || scale <= 0) return 0;
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const curr = points[i]!;
    const next = points[(i + 1) % n]!;
    area += curr.x * next.y - next.x * curr.y;
  }
  const areaPx2 = Math.abs(area) / 2;
  // px² → mm² → m²
  const areaMm2 = areaPx2 / (scale * scale);
  return areaMm2 / 1_000_000;
}

export function loadScale(drawingId: string): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + drawingId);
    if (!raw) return null;
    const v = parseFloat(raw);
    return isNaN(v) || v <= 0 ? null : v;
  } catch {
    return null;
  }
}

export function saveScale(drawingId: string, scale: number): void {
  localStorage.setItem(STORAGE_KEY_PREFIX + drawingId, String(scale));
}
