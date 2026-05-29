/**
 * ベジエ → 弦ポリライン変換
 *
 * PDF の曲線は 3 次ベジエであり、一般に真円弧ではない。
 * そのため arc-fit（PdfArc 復元）は行わず、適応的細分で
 * 短い直線弦（RawSeg 相当）へフラット化する。
 * 後段 interior-semantic.traceClosedLoop はこの弦を直線壁と同様に連結する。
 */

import type { Point } from "../pdf-to-estimate/types.js";

/** 弦セグメント（width は path-extractor 側で付与）。 */
type Chord = { start: Point; end: Point };

/** 平面度の許容（pt）。これより平坦なら分割を打ち切る。 */
const FLATNESS_TOL_PT = 0.3;
/** 弦本数の下限・上限（plan: 4〜12 本程度）。 */
const MIN_SEGMENTS = 4;
const MAX_SEGMENTS = 12;

function cubicAt(p0: Point, c1: Point, c2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p3.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p3.y,
  };
}

/** 制御点が始終点を結ぶ弦からどれだけ外れるか（最大偏差）で必要分割数を決める。 */
function neededSegments(p0: Point, c1: Point, c2: Point, p3: Point): number {
  // 制御多角形の弦からの偏差を平面度の目安にする
  const devC1 = distPointToLine(c1, p0, p3);
  const devC2 = distPointToLine(c2, p0, p3);
  const maxDev = Math.max(devC1, devC2);
  if (maxDev <= FLATNESS_TOL_PT) return MIN_SEGMENTS;
  // 偏差に比例して分割数を増やす（平方根目安）
  const n = Math.ceil(Math.sqrt(maxDev / FLATNESS_TOL_PT) * MIN_SEGMENTS);
  return Math.max(MIN_SEGMENTS, Math.min(MAX_SEGMENTS, n));
}

function distPointToLine(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const cross = Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx);
  return cross / len;
}

/**
 * 3 次ベジエを N 本の直線弦に分割して返す（始点は含まず弦列として返す）。
 */
export function flattenBezier(
  p0: Point,
  c1: Point,
  c2: Point,
  p3: Point,
): Chord[] {
  const n = neededSegments(p0, c1, c2, p3);
  const chords: Chord[] = [];
  let prev = p0;
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    const pt = cubicAt(p0, c1, c2, p3, t);
    chords.push({ start: prev, end: pt });
    prev = pt;
  }
  return chords;
}
