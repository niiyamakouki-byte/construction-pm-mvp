/**
 * TakeoffPage — 図面拾い出し専用ページ
 *
 * PDF または 画像 をアップロード → DrawingViewer をマウントして
 * ピン/計測/面積/縮尺キャリブレーション/pickupなぞり拾い を提供する。
 * pickup セッションは DrawingViewer 内の「見積へ送る」ボタンから
 * localStorage 経由で EstimatePage に流し込まれる（既存機構）。
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { DrawingViewer } from "../components/DrawingViewer.js";
import {
  detectScale,
  type ScaleResult,
} from "../lib/pdf-vector-extractor/scale-detector.js";
import { extractTextItems } from "../lib/pdf-vector-extractor/text-extractor.js";
import { DEFAULT_RENDER_PX_PER_PT } from "../lib/drawing-scale-auto.js";
import {
  sessionToEstimateItems,
  writeEstimateInject,
} from "../lib/takeoff-to-estimate.js";
import { navigate } from "../hooks/useHashRouter.js";
import costMasterRaw from "../estimate/cost-master.json";
import type { CostMasterEntry } from "../lib/measurement-to-estimate-link.js";

// EstimatePage と同じ流儀で cost-master をフラット化
type CostMasterJSON = {
  categories: { id: string; name: string; items: CostMasterEntry[] }[];
};
const COST_MASTER: CostMasterEntry[] = (costMasterRaw as CostMasterJSON).categories.flatMap(
  (cat) =>
    cat.items.map((item) => ({
      ...item,
      categoryId: cat.id,
      categoryName: cat.name,
    })),
);

// PDF を 1 ページ目だけ canvas にレンダリングして dataURL 化
const PDF_RENDER_SCALE = 2; // 高解像度（96dpi×2 ≒ 192dpi 相当）でラスタライズ

type LoadedDrawing = {
  drawingUrl: string;
  drawingId: string;
  drawingName: string;
  renderPxPerPt: number;
  detectedScaleMmPerPt?: number;
  detectedScaleLabel?: string;
  totalPages: number;
};

async function renderPdfPageToDataURL(
  file: File,
  pageIndex: number,
): Promise<{
  dataUrl: string;
  renderPxPerPt: number;
  scale: ScaleResult;
  totalPages: number;
}> {
  // pdf-loader.ts と同じ legacy ビルドを使用（worker 設定もそこで完結）
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    isEvalSupported: false,
  }).promise;
  const totalPages = doc.numPages;
  const page = await doc.getPage(pageIndex + 1);

  const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context が取得できません");
  await page.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL("image/png");

  // pdfjs.getViewport({ scale }) は viewport.width = pageWidthPt × scale。
  // つまり 1pt あたり scale ピクセルでレンダリングされる ⇒ px/pt = scale。
  const renderPxPerPt = PDF_RENDER_SCALE;

  const texts = await extractTextItems(page);
  const scale = detectScale(texts);

  return { dataUrl, renderPxPerPt, scale, totalPages };
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
}

function sanitizeId(name: string): string {
  return `takeoff:${name.toLowerCase().replace(/[^a-z0-9._-]+/g, "_")}`;
}

export function TakeoffPage() {
  const [drawing, setDrawing] = useState<LoadedDrawing | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const releaseObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const loadFile = useCallback(
    async (file: File, targetPageIndex = 0) => {
      setLoading(true);
      setError(null);
      try {
        releaseObjectUrl();
        if (isImageFile(file)) {
          const url = URL.createObjectURL(file);
          objectUrlRef.current = url;
          setPdfFile(null);
          setPageIndex(0);
          setDrawing({
            drawingUrl: url,
            drawingId: sanitizeId(file.name),
            drawingName: file.name,
            renderPxPerPt: DEFAULT_RENDER_PX_PER_PT,
            totalPages: 1,
          });
        } else if (isPdfFile(file)) {
          const result = await renderPdfPageToDataURL(file, targetPageIndex);
          setPdfFile(file);
          setPageIndex(targetPageIndex);
          setDrawing({
            drawingUrl: result.dataUrl,
            drawingId: sanitizeId(`${file.name}#${targetPageIndex}`),
            drawingName: `${file.name}${result.totalPages > 1 ? ` (p.${targetPageIndex + 1}/${result.totalPages})` : ""}`,
            renderPxPerPt: result.renderPxPerPt,
            detectedScaleMmPerPt: result.scale.scaleMmPerPt ?? undefined,
            detectedScaleLabel: result.scale.scale ?? undefined,
            totalPages: result.totalPages,
          });
        } else {
          throw new Error("PDF または 画像（PNG/JPG）を選択してください");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "ファイルの読み込みに失敗しました");
        setDrawing(null);
      } finally {
        setLoading(false);
      }
    },
    [releaseObjectUrl],
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      void loadFile(file, 0);
    },
    [loadFile],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      void loadFile(file, 0);
    },
    [loadFile],
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const goToPage = useCallback(
    (next: number) => {
      if (!pdfFile || !drawing) return;
      const safe = Math.max(0, Math.min(drawing.totalPages - 1, next));
      if (safe === pageIndex) return;
      void loadFile(pdfFile, safe);
    },
    [pdfFile, drawing, pageIndex, loadFile],
  );

  const handleReset = useCallback(() => {
    releaseObjectUrl();
    setDrawing(null);
    setPdfFile(null);
    setPageIndex(0);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [releaseObjectUrl]);

  const costMaster = useMemo(() => COST_MASTER, []);

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900">図面拾い出し</h1>
          <p className="mt-1 text-xs text-slate-500 truncate">
            PDFか図面画像をアップロード → なぞって拾い出し → 見積へ
          </p>
        </div>
        {drawing && (
          <button
            type="button"
            onClick={handleReset}
            className="flex-shrink-0 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 whitespace-nowrap"
          >
            切替
          </button>
        )}
      </header>

      {!drawing && (
        <div
          data-testid="takeoff-dropzone"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-12 text-center"
        >
          <p className="text-sm font-semibold text-slate-700">
            PDFか図面画像（PNG/JPG）をアップロード
          </p>
          <ol className="mx-auto mt-3 max-w-md space-y-1 text-left text-xs text-slate-500">
            <li>1. PDFか画像を選択（ドラッグ&ドロップ可）</li>
            <li>2. 縮尺を設定（PDFに「1:50」等あれば自動検出）</li>
            <li>3. 「拾い出し」モードでなぞる → 見積へ送る</li>
          </ol>
          <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-700">
            ファイルを選択
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/*"
              onChange={handleFileChange}
              className="sr-only"
              data-testid="takeoff-file-input"
            />
          </label>
        </div>
      )}

      {loading && (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
          図面を読み込み中...
        </p>
      )}
      {error && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {drawing && (
        <>
          {drawing.totalPages > 1 && pdfFile && (
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              <span>
                {drawing.drawingName}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToPage(pageIndex - 1)}
                  disabled={pageIndex <= 0 || loading}
                  className="rounded-xl border border-slate-200 px-2 py-1 font-semibold disabled:opacity-40"
                >
                  ← 前
                </button>
                <span>
                  {pageIndex + 1} / {drawing.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(pageIndex + 1)}
                  disabled={pageIndex >= drawing.totalPages - 1 || loading}
                  className="rounded-xl border border-slate-200 px-2 py-1 font-semibold disabled:opacity-40"
                >
                  次 →
                </button>
              </div>
            </div>
          )}

          <DrawingViewer
            drawingUrl={drawing.drawingUrl}
            drawingId={drawing.drawingId}
            drawingName={drawing.drawingName}
            costMaster={costMaster}
            renderPxPerPt={drawing.renderPxPerPt}
            detectedScaleMmPerPt={drawing.detectedScaleMmPerPt}
            detectedScaleLabel={drawing.detectedScaleLabel}
          />
        </>
      )}
    </div>
  );
}

// テストから DrawingViewer 経由ではなく直接 inject を発火するためのヘルパー
// （TakeoffPage は通常 DrawingViewer 内のボタン経由でこのフローを実行する）
export function __sendSessionToEstimate(
  session: Parameters<typeof sessionToEstimateItems>[0],
): boolean {
  const items = sessionToEstimateItems(session);
  if (items.length === 0) return false;
  writeEstimateInject(items);
  navigate("/estimate");
  return true;
}
