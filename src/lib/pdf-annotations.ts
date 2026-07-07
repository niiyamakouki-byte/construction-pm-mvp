/**
 * Hand-drawn PDF annotation ("赤入れ") data management.
 * Mirrors drawing-pins.ts: normalized 0-1 coordinates + localStorage persistence,
 * keyed per PDF page.
 */

export type AnnotationPoint = { x: number; y: number };

/** Ink rendering style. Absent on old saved strokes → treated as "ballpoint". */
export type PenKind = "ballpoint" | "highlighter" | "marker" | "pencil";

export type PdfStroke = {
  id: string;
  /** points normalized 0-1 relative to the page's displayed viewport */
  points: AnnotationPoint[];
  color: string;
  /**
   * stroke width normalized 0-1 relative to viewport width, so ink thickness
   * scales with zoom (stays a constant size relative to the drawing) instead
   * of staying a fixed screen-pixel size.
   */
  width: number;
  penKind?: PenKind;
  /**
   * Per-point opacity (0-1), same length as `points`. Only populated for
   * "pencil" strokes, where mark darkness follows drawing speed/pressure.
   */
  alphas?: number[];
  /**
   * Per-point line-width multiplier, same length as `points`. Only populated
   * for "pencil" strokes — Apple Pencil tilt makes the mark wider/scratchier,
   * mimicking graphite laid on its side.
   */
  widthMults?: number[];
};

/** page number (1-based) -> strokes drawn on that page */
export type PdfAnnotations = Record<number, PdfStroke[]>;

const STORAGE_KEY_PREFIX = "pdf_annotations_";

export function loadAnnotations(documentId: string): PdfAnnotations {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + documentId);
    if (!raw) return {};
    return JSON.parse(raw) as PdfAnnotations;
  } catch {
    return {};
  }
}

export function saveAnnotations(documentId: string, data: PdfAnnotations): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + documentId, JSON.stringify(data));
  } catch {
    // localStorage quota exceeded or unavailable — ignore to avoid crashing the UI
  }
}

export function createStroke(
  points: AnnotationPoint[],
  color: string,
  width: number,
  penKind?: PenKind,
  alphas?: number[],
  widthMults?: number[],
): PdfStroke {
  return { id: crypto.randomUUID(), points, color, width, penKind, alphas, widthMults };
}

export function addStroke(data: PdfAnnotations, page: number, stroke: PdfStroke): PdfAnnotations {
  const existing = data[page] ?? [];
  return { ...data, [page]: [...existing, stroke] };
}

export function undoLastStroke(data: PdfAnnotations, page: number): PdfAnnotations {
  const existing = data[page] ?? [];
  if (existing.length === 0) return data;
  return { ...data, [page]: existing.slice(0, -1) };
}

function pointDistance(a: AnnotationPoint, b: AnnotationPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Erase all strokes on `page` that pass within `radius` (normalized 0-1
 * units) of (x, y).
 * ponytail: hit-tests each stored vertex rather than the segments between
 * them — good enough for freehand ink at MVP point density. Upgrade to
 * point-to-segment distance if simplified strokes end up sparse enough that
 * the eraser visibly skips past a line.
 */
export function eraseAt(data: PdfAnnotations, page: number, x: number, y: number, radius: number): PdfAnnotations {
  const existing = data[page] ?? [];
  const kept = existing.filter((stroke) => !stroke.points.some((p) => pointDistance(p, { x, y }) <= radius));
  if (kept.length === existing.length) return data;
  return { ...data, [page]: kept };
}
