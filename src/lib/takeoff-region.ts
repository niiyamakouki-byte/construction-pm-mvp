/**
 * takeoff-region — 複数縮尺 region サポート
 *
 * 1枚の PDF に 1/50 と 1/100 が混在するケースに対応。
 * 図面上の矩形 region ごとに個別の calibration scale を保持し、
 * 点がどの region に属するかを判定して正しい scale を返す。
 *
 * Pure logic, no DOM dependencies.
 */

import { calibrateScale, type Point } from "./drawing-measure.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type RegionRect = {
  /** Top-left pixel coordinate (relative to rendered image) */
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DrawingRegion = {
  id: string;
  /** Human-readable label, e.g. "1F平面図 1:50" */
  label: string;
  rect: RegionRect;
  /** px/mm — same unit as drawing-measure.ts calibrateScale output */
  scale: number | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

let _regionSeq = 0;

function genRegionId(): string {
  return `region-${Date.now()}-${++_regionSeq}`;
}

// ── Region CRUD ───────────────────────────────────────────────────────────────

/**
 * Create a new region without a scale (requires calibration).
 */
export function createRegion(
  rect: RegionRect,
  label?: string,
): DrawingRegion {
  return {
    id: genRegionId(),
    label: label ?? `Region ${_regionSeq}`,
    rect,
    scale: null,
  };
}

/**
 * Calibrate a region's scale from two pixel points and a known real distance.
 * Returns updated region (immutable).
 */
export function calibrateRegion(
  region: DrawingRegion,
  point1: Point,
  point2: Point,
  realDistanceMm: number,
): DrawingRegion {
  const scale = calibrateScale(point1, point2, realDistanceMm);
  return { ...region, scale };
}

/**
 * Update a region's label (immutable).
 */
export function updateRegionLabel(
  region: DrawingRegion,
  label: string,
): DrawingRegion {
  return { ...region, label };
}

// ── Region list management ────────────────────────────────────────────────────

/**
 * Add a region to the list (immutable).
 */
export function addRegion(
  regions: DrawingRegion[],
  region: DrawingRegion,
): DrawingRegion[] {
  return [...regions, region];
}

/**
 * Remove a region by id (immutable).
 */
export function removeRegion(
  regions: DrawingRegion[],
  regionId: string,
): DrawingRegion[] {
  return regions.filter((r) => r.id !== regionId);
}

/**
 * Update a region in the list (immutable).
 */
export function replaceRegion(
  regions: DrawingRegion[],
  updated: DrawingRegion,
): DrawingRegion[] {
  return regions.map((r) => (r.id === updated.id ? updated : r));
}

// ── Scale lookup ──────────────────────────────────────────────────────────────

/**
 * Determine if a point is inside a region rect.
 */
export function isPointInRegion(point: Point, region: DrawingRegion): boolean {
  const { x, y, width, height } = region.rect;
  return (
    point.x >= x &&
    point.x <= x + width &&
    point.y >= y &&
    point.y <= y + height
  );
}

/**
 * Find the first region containing the given point that has a valid scale.
 * If multiple regions overlap, the first matching one (by list order) wins.
 * Returns null if no calibrated region covers the point.
 */
export function findRegionForPoint(
  point: Point,
  regions: DrawingRegion[],
): DrawingRegion | null {
  for (const region of regions) {
    if (region.scale !== null && isPointInRegion(point, region)) {
      return region;
    }
  }
  return null;
}

/**
 * Resolve the scale (px/mm) for a point, preferring region-specific scale
 * over the global fallback. Returns null if no scale is available.
 *
 * @param point          Pixel coordinate of the measurement point
 * @param regions        List of defined regions (may be empty)
 * @param globalScale    Global fallback scale (px/mm) or null
 */
export function resolveScale(
  point: Point,
  regions: DrawingRegion[],
  globalScale: number | null,
): number | null {
  const region = findRegionForPoint(point, regions);
  if (region !== null && region.scale !== null) {
    return region.scale;
  }
  return globalScale;
}

// ── localStorage persistence ──────────────────────────────────────────────────

const REGIONS_STORAGE_KEY_PREFIX = "drawing_regions_";

/**
 * Save regions for a drawing to localStorage.
 */
export function saveRegions(
  drawingId: string,
  regions: DrawingRegion[],
): void {
  try {
    localStorage.setItem(
      REGIONS_STORAGE_KEY_PREFIX + drawingId,
      JSON.stringify(regions),
    );
  } catch {
    // quota exceeded or unavailable — ignore
  }
}

/**
 * Load regions for a drawing from localStorage.
 * Returns [] if not found or corrupt.
 */
export function loadRegions(drawingId: string): DrawingRegion[] {
  try {
    const raw = localStorage.getItem(REGIONS_STORAGE_KEY_PREFIX + drawingId);
    if (!raw) return [];
    return JSON.parse(raw) as DrawingRegion[];
  } catch {
    return [];
  }
}

// ── Paper scale helpers ───────────────────────────────────────────────────────

/**
 * Derive a human-readable paper scale string (e.g. "1:50") from two points
 * and a known real distance, given a reference DPI for display.
 * Purely informational — not used in calculations.
 *
 * @param pixelDistance   Pixel distance between calibration points
 * @param realDistanceMm  Known real distance in mm
 * @param dpi             Screen/scan DPI (default 96)
 */
export function derivePaperScale(
  pixelDistance: number,
  realDistanceMm: number,
  dpi = 96,
): string {
  if (pixelDistance <= 0 || realDistanceMm <= 0) return "不明";
  // Physical size of pixelDistance on the screen in mm
  const screenSizeMm = (pixelDistance / dpi) * 25.4;
  if (screenSizeMm <= 0) return "不明";
  // Scale ratio: how many real mm per 1 screen mm
  const ratio = Math.round(realDistanceMm / screenSizeMm);
  return ratio > 0 ? `1:${ratio}` : "不明";
}
