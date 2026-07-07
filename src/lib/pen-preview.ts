/**
 * ペン/マーカー切替時の「ちょこんと見せて消える」ミニプレビュー描画。
 * 本番の描画関数(computeOutline/fillOutline)をそのまま流用するので、
 * 見た目は実際の線と一致する。サンプル点とキャンバスサイズは
 * 「小さな見本を描ければ十分」なので固定値でよい(ponytail: 実サイズ反映が
 * 要るなら strokeWidthPx を size 引数として渡すよう拡張)。
 *
 * PdfCanvasPreview のペン先プレビューから抽出。写真注釈側でも同種のミニ
 * プレビューが要るようになった場合はここに追加する(ponytail: 今は
 * 呼び出し側1箇所なので汎用オプション化はしない)。
 */
import { computeOutline, fillOutline, type PenKind } from "../components/PdfAnnotationLayer.js";

export const PEN_PREVIEW_WIDTH = 48;
export const PEN_PREVIEW_HEIGHT = 20;
const PEN_PREVIEW_BASE_STROKE_PX = 2;
const PEN_PREVIEW_SAMPLE_POINTS = [
  { x: 4, y: 15, pressure: 0.5 },
  { x: 14, y: 6, pressure: 0.5 },
  { x: 26, y: 16, pressure: 0.5 },
  { x: 38, y: 7, pressure: 0.5 },
  { x: 44, y: 12, pressure: 0.5 },
];

/**
 * canvas に色/ペン種のサンプルストロークを描く。
 * テスト環境のgetContextスタブ({}など)では描画APIが無いのでスキップする
 * (PdfAnnotationLayerのdrawLiveFrameと同じガード)。
 */
export function drawPenPreview(canvas: HTMLCanvasElement | null | undefined, color: string, kind: PenKind): void {
  const ctx = canvas?.getContext("2d");
  if (!ctx || typeof ctx.clearRect !== "function" || typeof ctx.beginPath !== "function") return;
  ctx.clearRect(0, 0, PEN_PREVIEW_WIDTH, PEN_PREVIEW_HEIGHT);
  const outline = computeOutline(PEN_PREVIEW_SAMPLE_POINTS, kind, PEN_PREVIEW_BASE_STROKE_PX);
  fillOutline(ctx, outline, color, kind, PEN_PREVIEW_WIDTH, PEN_PREVIEW_HEIGHT);
}
