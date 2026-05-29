/**
 * 縮尺検出
 *
 * 優先順位:
 *   1. opts.scaleMmPerPt が指定されていればそれを直接使う。
 *   2. 抽出テキストの "1:50" / "1/50" 等を正規表現で拾い、
 *      scale_mm_per_pt = ratio * (25.4/72) を算出する。
 *      （1pt = 25.4/72 mm の紙面長に縮尺倍率 ratio を掛けた実寸長）
 *   3. それ以外は null（後段は confidence 0.3 で続行）。
 */

import type { TextItem } from "../pdf-to-estimate/types.js";

const PT_TO_MM = 25.4 / 72;
const SCALE_RE = /1\s*[:/]\s*(\d+)/;

export type ScaleResult = {
  /** 表示用の縮尺文字列（例 "1:50"）。検出できなければ null。 */
  scale: string | null;
  /** pt → mm 実寸の倍率。検出できなければ null。 */
  scaleMmPerPt: number | null;
};

/**
 * テキスト項目と明示指定から縮尺を決定する。
 */
export function detectScale(
  texts: TextItem[],
  explicitMmPerPt?: number,
): ScaleResult {
  // ① 明示指定が最優先
  if (typeof explicitMmPerPt === "number" && Number.isFinite(explicitMmPerPt)) {
    return { scale: null, scaleMmPerPt: explicitMmPerPt };
  }

  // ② テキストから "1:50" / "1/50" を検出
  for (const t of texts) {
    const m = SCALE_RE.exec(t.text);
    if (m) {
      const ratio = Number(m[1]);
      if (ratio > 0) {
        return {
          scale: `1:${ratio}`,
          scaleMmPerPt: ratio * PT_TO_MM,
        };
      }
    }
  }

  // ③ 検出不能
  return { scale: null, scaleMmPerPt: null };
}
