/**
 * Pen stroke processing for Apple Pencil pickup input.
 * Pure logic only; no DOM/React/Canvas dependencies.
 *
 * Pipeline: raw PenSamples → simplifyStroke (RDP) → classifyStroke
 * → { kind: "line" | "polyline" | "polygon", points }.
 */

import type { Point } from "./drawing-measure.js";

export type PenSample = {
  x: number;
  y: number;
  pressure: number;
  t: number;
  /** Apple Pencil tilt in degrees (-90..90). 0/absent on mouse/touch. */
  tiltX?: number;
  tiltY?: number;
};

export type StrokeKind = "line" | "polyline" | "polygon";

export type StrokeResult = {
  kind: StrokeKind;
  points: Point[];
};

export type ClassifyOptions = {
  /** 始点と終点が「閉じている」と判定する半径 (px). */
  closeThresholdPx?: number;
  /** 全点が始終点直線からこの距離内なら直線扱い (px). */
  straightnessEpsilonPx?: number;
};

// ── Geometry helpers ──────────────────────────────────────────────────────────

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  // 端点が同一なら点間距離にフォールバック
  if (lenSq === 0) {
    const ex = p.x - a.x;
    const ey = p.y - a.y;
    return Math.sqrt(ex * ex + ey * ey);
  }
  const num = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x);
  return num / Math.sqrt(lenSq);
}

function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ── Ramer-Douglas-Peucker ─────────────────────────────────────────────────────

/**
 * RDPでサンプル列を間引きする。
 * 空/1点入力はそのまま、2点未満の epsilon でもクラッシュしない。
 */
export function simplifyStroke(samples: PenSample[], epsilon: number): Point[] {
  if (samples.length === 0) return [];
  if (samples.length === 1) {
    const s = samples[0]!;
    return [{ x: s.x, y: s.y }];
  }
  const pts: Point[] = samples.map((s) => ({ x: s.x, y: s.y }));
  if (pts.length === 2) return pts;
  const eps = epsilon > 0 ? epsilon : 0;
  return rdp(pts, eps);
}

function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points.slice();
  const first = points[0]!;
  const last = points[points.length - 1]!;
  let maxDist = 0;
  let maxIdx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i]!, first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }
  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, maxIdx + 1), epsilon);
    const right = rdp(points.slice(maxIdx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

// ── Stroke classification ─────────────────────────────────────────────────────

/**
 * 簡略化後の点列を line/polyline/polygon に分類する。
 *
 * - 2点 or 全点が始終点直線から epsilon 内 → "line" (2点)
 * - 終点が始点近く & 3頂点以上 → "polygon" (終点を始点にスナップして閉じる)
 * - それ以外 → "polyline"
 */
export function classifyStroke(
  points: Point[],
  opts: ClassifyOptions = {},
): StrokeResult {
  const closeThreshold = opts.closeThresholdPx ?? 24;
  const straightEps = opts.straightnessEpsilonPx ?? 4;

  if (points.length <= 1) {
    return { kind: "polyline", points: points.slice() };
  }
  if (points.length === 2) {
    return { kind: "line", points: [points[0]!, points[1]!] };
  }

  const first = points[0]!;
  const last = points[points.length - 1]!;

  // 全点が始終点直線から epsilon 以内 → 直線
  let isStraight = true;
  for (let i = 1; i < points.length - 1; i++) {
    if (perpendicularDistance(points[i]!, first, last) > straightEps) {
      isStraight = false;
      break;
    }
  }
  if (isStraight) {
    return { kind: "line", points: [first, last] };
  }

  // 始点・終点が近い & 3頂点以上 → 閉路 (終点を始点にスナップ)
  if (points.length >= 3 && distance(first, last) <= closeThreshold) {
    const closed = points.slice(0, -1);
    // 最後の頂点が始点と同じになるとShoelaceで縮退するため、最終点を落として閉路扱いとする
    return { kind: "polygon", points: closed };
  }

  return { kind: "polyline", points: points.slice() };
}
