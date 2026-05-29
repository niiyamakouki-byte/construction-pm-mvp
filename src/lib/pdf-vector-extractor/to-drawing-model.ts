/**
 * DrawingModel 組み立て
 *
 * RawSeg[] + TextItem[] + 縮尺から DrawingModel を生成する。
 *
 * 重要: interior-semantic.traceClosedLoop は端点一致を 1.0pt 許容で閉ループ判定する。
 * PDF の浮動小数ドリフトでループが閉じなくなるのを防ぐため、emit 前に
 * 全端点を 0.5pt グリッドへスナップ（1pt より細かい）してドリフトを吸収する。
 */

import type {
  DrawingModel,
  PdfLine,
  Point,
  TextItem,
} from "../pdf-to-estimate/types.js";
import type { RawSeg } from "./raw-types.js";

/** スナップ格子（pt）。1.0pt の閉ループ許容より細かくする。 */
const SNAP_GRID_PT = 0.5;
/** CAD ヘアライン（0 幅）の最小壁厚（pt）。これ未満は壁判定で落ちるため底上げ。 */
const MIN_THICKNESS_PT = 0.5;

function snapCoord(v: number): number {
  // + 0 で -0 を +0 に正規化（端点の厳密一致を保証）
  return Math.round(v / SNAP_GRID_PT) * SNAP_GRID_PT + 0;
}

function snapPoint(p: Point): Point {
  return { x: snapCoord(p.x), y: snapCoord(p.y) };
}

export type AssembleOptions = {
  sourceName?: string;
  pageIndex: number;
  pageSizePt: Point;
  scale: string | null;
  scaleMmPerPt: number | null;
};

/**
 * RawSeg[]・テキスト・縮尺から DrawingModel を組み立てる。
 * 端点スナップとヘアライン底上げを適用する。
 */
export function assembleDrawingModel(
  segs: RawSeg[],
  texts: TextItem[],
  opts: AssembleOptions,
): DrawingModel {
  const s = opts.scaleMmPerPt;

  const lines: PdfLine[] = [];
  const layerSet = new Set<string>();

  for (const seg of segs) {
    const start = snapPoint(seg.start);
    const end = snapPoint(seg.end);

    // 退化セグメント（スナップ後に始終点一致）は除外
    if (start.x === end.x && start.y === end.y) continue;

    const lengthPt = Math.hypot(end.x - start.x, end.y - start.y);
    const thickness = seg.width > 0 ? Math.max(seg.width, MIN_THICKNESS_PT) : MIN_THICKNESS_PT;

    lines.push({
      start,
      end,
      thickness,
      color: null,
      layer: null,
      semantic: null,
      length_pt: lengthPt,
      length_mm: s !== null ? lengthPt * s : null,
    });
  }

  return {
    source_pdf: opts.sourceName ?? "",
    page_index: opts.pageIndex,
    page_size_pt: opts.pageSizePt,
    scale: opts.scale,
    scale_mm_per_pt: s,
    lines,
    rects: [],
    texts,
    layers: Array.from(layerSet),
    extracted_at: new Date().toISOString(),
  };
}
