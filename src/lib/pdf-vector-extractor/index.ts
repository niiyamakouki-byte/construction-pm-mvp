/**
 * pdf-vector-extractor — 公開 API
 *
 * 建築平面図 PDF を、既存の見積パイプラインが消費する DrawingModel JSON へ変換する。
 * フロー: loadPage → (extractRawSegments | extractTextItems) → detectScale → assembleDrawingModel
 */

import type { DrawingModel } from "../pdf-to-estimate/types.js";
import { loadPage } from "./pdf-loader.js";
import { extractRawSegments } from "./path-extractor.js";
import { extractTextItems } from "./text-extractor.js";
import { detectScale } from "./scale-detector.js";
import { assembleDrawingModel } from "./to-drawing-model.js";

export type ExtractOptions = {
  /** 抽出対象ページ（0 始まり）。既定 0。 */
  pageIndex?: number;
  /** 縮尺を明示指定（pt→mm）。テキスト検出より優先。 */
  scaleMmPerPt?: number;
  /** source_pdf に記録する名前。 */
  sourceName?: string;
};

/**
 * PDF（File / ArrayBuffer）から DrawingModel を抽出する。
 */
export async function extractDrawingModel(
  input: File | ArrayBuffer,
  opts: ExtractOptions = {},
): Promise<DrawingModel> {
  const pageIndex = opts.pageIndex ?? 0;
  const page = await loadPage(input, pageIndex);

  const [segs, texts] = await Promise.all([
    extractRawSegments(page),
    extractTextItems(page),
  ]);

  const scale = detectScale(texts, opts.scaleMmPerPt);

  // ページサイズ（pt）: viewport の幅・高さ
  const viewport = page.getViewport({ scale: 1 });
  const pageSizePt = { x: viewport.width, y: viewport.height };

  const sourceName =
    opts.sourceName ??
    (typeof File !== "undefined" && input instanceof File ? input.name : "");

  return assembleDrawingModel(segs, texts, {
    sourceName,
    pageIndex,
    pageSizePt,
    scale: scale.scale,
    scaleMmPerPt: scale.scaleMmPerPt,
  });
}
