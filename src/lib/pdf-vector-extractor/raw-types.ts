/**
 * pdf-vector-extractor 内部の中間表現。
 * path-extractor / curve-fitter が生成し、to-drawing-model が DrawingModel へ変換する。
 */

import type { Point } from "../pdf-to-estimate/types.js";

/** 直線セグメント、または分割済みベジエの 1 弦。座標は PDF pt（CTM 適用済み）。 */
export type RawSeg = {
  start: Point;
  end: Point;
  /** 線幅（pt、CTM スケール適用済み）。0/未指定はローダ側で補正する。 */
  width: number;
};
