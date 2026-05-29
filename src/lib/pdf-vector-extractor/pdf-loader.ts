/**
 * PDF.js ページローダ
 *
 * Vite（ブラウザ）と vitest（jsdom）の双方で動かすため、
 * legacy ビルドを使い worker を無効化する（disableWorker / fake worker）。
 * ブラウザ本番でも legacy ビルドはメインスレッド実行で動作し、
 * 巨大図面でなければ実用上問題ない（worker 設定の不一致を避ける優先）。
 */

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
// Vite はこの ?url import を静的アセット URL（ブラウザ取得可）に解決する。
// vitest（jsdom）では setupFiles（vitest-pdfjs-worker.ts）が
// GlobalWorkerOptions.workerSrc を file:// パスへ上書きするため、
// この import の解決値は使われない（テスト時は import 自体が成功すれば良い）。
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import type { PDFPageProxy } from "pdfjs-dist";

if (!pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
}

function toUint8Array(input: File | ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return Promise.resolve(input);
  if (input instanceof ArrayBuffer) return Promise.resolve(new Uint8Array(input));
  // File / Blob
  return input.arrayBuffer().then((buf) => new Uint8Array(buf));
}

/**
 * PDF を読み込み、指定ページ（0 始まり）の PDFPageProxy を返す。
 */
export async function loadPage(
  input: File | ArrayBuffer | Uint8Array,
  pageIndex: number,
): Promise<PDFPageProxy> {
  const data = await toUint8Array(input);
  const loadingTask = pdfjs.getDocument({
    data,
    // jsdom/Node には標準フォントが無いため警告を抑える
    disableFontFace: true,
    isEvalSupported: false,
  });
  const doc = await loadingTask.promise;
  // pdf.js は 1 始まり
  return doc.getPage(pageIndex + 1);
}
