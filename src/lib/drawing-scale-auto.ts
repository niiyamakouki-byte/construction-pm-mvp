/**
 * 縮尺自動検出ユーティリティ
 *
 * PDF テキスト検出結果 (scaleMmPerPt) とレンダリング解像度 (renderPxPerPt) を
 * 組み合わせて DrawingViewer が使う px/mm スケールを算出する。
 *
 * 優先順位:
 *   1. localStorage に保存済みの手動キャリブレーション値（上書きしない）
 *   2. PDF 自動検出値（scaleMmPerPt + renderPxPerPt から算出）
 *   3. null（未設定 → 手動キャリブレーション誘導）
 */

/** 標準スクリーン解像度 96dpi での pt → px 変換係数（1pt = 1/72 inch = 96/72 px）*/
export const DEFAULT_RENDER_PX_PER_PT = 96 / 72;

export type ResolveScaleResult = {
  /** 使用する px/mm スケール。null の場合はキャリブレーション未設定 */
  scale: number | null;
  /** このスケールが自動検出由来か（true = 自動 / false = 手動 or 未設定） */
  isAutoDetected: boolean;
  /** 自動検出時の縮尺ラベル（例: "1:50"）。自動でない場合は null */
  detectedScaleLabel: string | null;
};

/**
 * scaleMmPerPt（1pt あたりの実寸 mm）と renderPxPerPt（1pt あたりのレンダリング px 数）から
 * DrawingViewer が使う px/mm スケールを算出する。
 *
 * 計算式:
 *   px/mm = renderPxPerPt / scaleMmPerPt
 *
 * 例: 縮尺 1:50、標準96dpi レンダリング
 *   scaleMmPerPt = 50 * (25.4/72) ≈ 17.639 mm/pt
 *   renderPxPerPt = 96/72 ≈ 1.333 px/pt
 *   px/mm = 1.333 / 17.639 ≈ 0.0756 px/mm
 *
 * @param scaleMmPerPt  - 縮尺検出結果（mm/pt）。0 以下や無限は無効扱いで null 返却
 * @param renderPxPerPt - レンダリング解像度（px/pt）。既定 96/72
 */
export function scaleMmPerPtToPxPerMm(
  scaleMmPerPt: number,
  renderPxPerPt: number = DEFAULT_RENDER_PX_PER_PT,
): number | null {
  if (!Number.isFinite(scaleMmPerPt) || scaleMmPerPt <= 0) return null;
  if (!Number.isFinite(renderPxPerPt) || renderPxPerPt <= 0) return null;
  return renderPxPerPt / scaleMmPerPt;
}

/**
 * 保存済みスケール・自動検出値を統合して最終的なスケールを決定する。
 *
 * @param savedScale        - localStorage から読み取った手動キャリブレーション値（null = 未設定）
 * @param detectedMmPerPt   - PDF テキスト検出の scaleMmPerPt（null = 検出失敗）
 * @param detectedLabel     - 表示用縮尺ラベル（例: "1:50"）。null = ラベルなし
 * @param renderPxPerPt     - レンダリング解像度（px/pt）。既定 DEFAULT_RENDER_PX_PER_PT
 */
export function resolveDrawingScale(
  savedScale: number | null,
  detectedMmPerPt: number | null,
  detectedLabel: string | null,
  renderPxPerPt: number = DEFAULT_RENDER_PX_PER_PT,
): ResolveScaleResult {
  // 手動キャリブレーション済みなら自動検出より優先
  if (savedScale !== null && savedScale > 0) {
    return { scale: savedScale, isAutoDetected: false, detectedScaleLabel: null };
  }

  // PDF 自動検出があれば算出
  if (detectedMmPerPt !== null) {
    const pxPerMm = scaleMmPerPtToPxPerMm(detectedMmPerPt, renderPxPerPt);
    if (pxPerMm !== null) {
      return { scale: pxPerMm, isAutoDetected: true, detectedScaleLabel: detectedLabel };
    }
  }

  return { scale: null, isAutoDetected: false, detectedScaleLabel: null };
}
