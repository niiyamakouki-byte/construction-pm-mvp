import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
// Vite はこの ?url import を静的アセット URL（ブラウザ取得可）に解決する。
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import type { RenderTask } from "pdfjs-dist";
import { Eraser, PenLine, Share2, Undo2 } from "lucide-react";
import { PdfAnnotationLayer, type PdfAnnotationLayerHandle, type PdfAnnotationTool, type PenKind } from "./PdfAnnotationLayer.js";
import { shareOrDownloadFile } from "../lib/share-file.js";

const ANNOTATION_COLORS = [
  { label: "赤", value: "#D64545" },
  { label: "セージ", value: "#346538" },
  { label: "チャコール", value: "#2F3437" },
] as const;

const ANNOTATION_WIDTHS = [
  { label: "細", value: 2 },
  { label: "太", value: 5 },
] as const;

const PEN_KINDS: { label: string; value: PenKind }[] = [
  { label: "ボールペン", value: "ballpoint" },
  { label: "蛍光ペン", value: "highlighter" },
  { label: "太マーカー", value: "marker" },
  { label: "鉛筆", value: "pencil" },
];

if (!pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
}

const MIN_SCALE = 0.4;
const MAX_SCALE = 4;
const SCALE_STEP = 0.25;

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function distanceBetweenTouches(touches: React.TouchList): number {
  const first = touches[0];
  const second = touches[1];
  if (!first || !second) return 0;
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

/**
 * ブラウザネイティブのPDFビューアをiframeにそのまま埋め込むと、
 * 自動化/一部環境で描画に失敗し黒画面になる不具合(construction_pm_mvp-6jt)への対応。
 * pdf.js(既存依存)でページをcanvasに自前描画することで、埋め込みビューアに依存しない。
 */
export function PdfCanvasPreview({
  src,
  title,
  documentId,
}: {
  src: string;
  title: string;
  /** Storage key for hand-drawn annotations. Defaults to `src` when omitted. */
  documentId?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const renderGenerationRef = useRef(0);
  const pinchRef = useRef<{ startDistance: number; startScale: number } | null>(null);
  const annotationLayerRef = useRef<PdfAnnotationLayerHandle>(null);

  const [docRef, setDocRef] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [annotateActive, setAnnotateActive] = useState(false);
  const [annotateTool, setAnnotateTool] = useState<PdfAnnotationTool>("pen");
  const [annotatePenKind, setAnnotatePenKind] = useState<PenKind>("ballpoint");
  const [annotateColor, setAnnotateColor] = useState<string>(ANNOTATION_COLORS[0].value);
  const [annotateWidthPx, setAnnotateWidthPx] = useState<number>(ANNOTATION_WIDTHS[0].value);
  const [sharingAnnotated, setSharingAnnotated] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const savedHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAnnotationSaved = useCallback(() => {
    setShowSaved(true);
    if (savedHideTimerRef.current) clearTimeout(savedHideTimerRef.current);
    savedHideTimerRef.current = setTimeout(() => setShowSaved(false), 1400);
  }, []);

  useEffect(() => {
    return () => {
      if (savedHideTimerRef.current) clearTimeout(savedHideTimerRef.current);
    };
  }, []);

  const resolvedDocumentId = documentId ?? src;

  // ドキュメントの読み込み(src変更のたびにリセット)
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setDocRef(null);
    setPageNumber(1);
    setScale(1);
    setRotation(0);
    setAnnotateActive(false);

    const loadingTask = pdfjs.getDocument({ url: src });
    loadingTask.promise.then(
      (loadedDoc) => {
        if (cancelled) return;
        setDocRef(loadedDoc);
        setNumPages(loadedDoc.numPages);
        setStatus("ready");
      },
      () => {
        if (cancelled) return;
        setStatus("error");
      },
    );

    return () => {
      cancelled = true;
      loadingTask.destroy();
    };
  }, [src]);

  // ページ描画
  // ピンチズーム等でscaleが高頻度に変わりrenderPageが連続発火しても、
  // 同一canvasへの並行render()呼び出し(pdf.jsの"Cannot use the same canvas
  // during multiple render() operations"例外)を起こさないよう、
  // (1) 世代カウンタで自分より新しい呼び出しに追い越された処理は結果を捨て、
  // (2) 前回のrender taskはcancel()呼び出し後、実際に完了(reject)するまで待ってから
  // 次のrender()を呼ぶ、の2点で直列化する。
  const renderPage = useCallback(async () => {
    if (!docRef) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const generation = ++renderGenerationRef.current;
    const isStale = () => renderGenerationRef.current !== generation;

    try {
      const page = await docRef.getPage(pageNumber);
      if (isStale()) return;

      const outputScale = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      // getViewportへ明示的にrotationを渡すとページ自身の/Rotateを上書きしてしまうため、
      // ページ固有の回転(page.rotate)にユーザー操作分の回転を加算する。
      const effectiveRotation = ((page.rotate ?? 0) + rotation) % 360;
      const viewport = page.getViewport({ scale, rotation: effectiveRotation });
      setViewportSize({ width: Math.floor(viewport.width), height: Math.floor(viewport.height) });

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        // cancel()は非同期。実際にcanvasが解放される(=render taskが決着する)まで
        // 待たずに次のrender()を呼ぶと、pdf.js側が「同一canvasへの並行render」として
        // 例外を投げビューア全体がエラー画面化してしまう。
        await renderTaskRef.current.promise.catch(() => {});
        if (isStale()) return;
      }

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const context = canvas.getContext("2d");
      if (!context) return;

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
      const task = page.render({ canvasContext: context, viewport, transform });
      renderTaskRef.current = task;
      await task.promise;
    } catch (err) {
      if (isStale()) return;
      const isCancelled = err instanceof Error && err.name === "RenderingCancelledException";
      if (!isCancelled) setStatus("error");
    }
  }, [docRef, pageNumber, scale, rotation]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  const zoomIn = () => setScale((current) => clampScale(current + SCALE_STEP));
  const zoomOut = () => setScale((current) => clampScale(current - SCALE_STEP));
  const resetZoom = () => setScale(1);
  const rotateClockwise = () => setRotation((current) => (current + 90) % 360);
  const goToPrevPage = () => setPageNumber((current) => Math.max(1, current - 1));
  const goToNextPage = () => setPageNumber((current) => Math.min(numPages, current + 1));

  // 2本指ピンチでのズーム
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = { startDistance: distanceBetweenTouches(e.touches), startScale: scale };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current && pinchRef.current.startDistance > 0) {
      e.preventDefault();
      const currentDistance = distanceBetweenTouches(e.touches);
      const ratio = currentDistance / pinchRef.current.startDistance;
      setScale(clampScale(pinchRef.current.startScale * ratio));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
  };

  const handleShareAnnotated = useCallback(async () => {
    const base = canvasRef.current;
    const layer = annotationLayerRef.current;
    if (!base || !layer) return;
    setSharingAnnotated(true);
    try {
      const blob = await layer.exportComposite(base);
      if (!blob) return;
      const file = new File([blob], `${title}_赤入れ.png`, { type: "image/png" });
      await shareOrDownloadFile(file);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    } finally {
      setSharingAnnotated(false);
    }
  }, [title]);

  if (status === "error") {
    return (
      <div className="flex h-[420px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        <p>PDFを読み込めませんでした。上のボタンから元ファイルを開いてください。</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={zoomOut}
            disabled={scale <= MIN_SCALE}
            aria-label="縮小"
            className="rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-700 disabled:opacity-40"
          >
            −
          </button>
          <button
            type="button"
            onClick={resetZoom}
            aria-label="拡大率をリセット"
            className="min-w-[3.5rem] rounded-md border border-slate-200 px-2 py-1 font-mono text-slate-600 hover:border-brand-300 hover:text-brand-700"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            disabled={scale >= MAX_SCALE}
            aria-label="拡大"
            className="rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-700 disabled:opacity-40"
          >
            ＋
          </button>
          <button
            type="button"
            onClick={rotateClockwise}
            aria-label="回転"
            className="rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-700"
          >
            回転
          </button>
        </div>

        {numPages > 1 ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
              aria-label="前のページ"
              className="rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-700 disabled:opacity-40"
            >
              ‹
            </button>
            <span className="font-mono text-slate-500">
              {pageNumber} / {numPages}
            </span>
            <button
              type="button"
              onClick={goToNextPage}
              disabled={pageNumber >= numPages}
              aria-label="次のページ"
              className="rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-700 disabled:opacity-40"
            >
              ›
            </button>
          </div>
        ) : null}
      </div>

      {status === "ready" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
          <button
            type="button"
            onClick={() => setAnnotateActive((current) => !current)}
            aria-pressed={annotateActive}
            className={`flex items-center gap-1 rounded-md px-2 py-1 font-semibold ${
              annotateActive
                ? "bg-brand-700 text-white"
                : "border border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700"
            }`}
          >
            <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
            赤入れ{annotateActive ? "中" : ""}
          </button>

          {annotateActive ? (
            <>
              <div className="flex items-center gap-1">
                {PEN_KINDS.map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => {
                      setAnnotateTool("pen");
                      setAnnotatePenKind(k.value);
                    }}
                    aria-pressed={annotateTool === "pen" && annotatePenKind === k.value}
                    className={`rounded-md border px-2 py-1 font-semibold ${
                      annotateTool === "pen" && annotatePenKind === k.value
                        ? "border-brand-700 bg-brand-50 text-brand-700"
                        : "border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700"
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                {ANNOTATION_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => {
                      setAnnotateTool("pen");
                      setAnnotateColor(c.value);
                    }}
                    aria-label={c.label}
                    aria-pressed={annotateTool === "pen" && annotateColor === c.value}
                    className={`h-6 w-6 rounded-full border-2 ${
                      annotateTool === "pen" && annotateColor === c.value ? "border-slate-900" : "border-slate-200"
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>

              <div className="flex items-center gap-1">
                {ANNOTATION_WIDTHS.map((w) => (
                  <button
                    key={w.value}
                    type="button"
                    onClick={() => {
                      setAnnotateTool("pen");
                      setAnnotateWidthPx(w.value);
                    }}
                    aria-pressed={annotateTool === "pen" && annotateWidthPx === w.value}
                    className={`rounded-md border px-2 py-1 font-semibold ${
                      annotateTool === "pen" && annotateWidthPx === w.value
                        ? "border-brand-700 bg-brand-50 text-brand-700"
                        : "border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700"
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setAnnotateTool("eraser")}
                aria-pressed={annotateTool === "eraser"}
                className={`flex items-center gap-1 rounded-md border px-2 py-1 font-semibold ${
                  annotateTool === "eraser"
                    ? "border-brand-700 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700"
                }`}
              >
                <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
                消しゴム
              </button>

              <button
                type="button"
                onClick={() => annotationLayerRef.current?.undo()}
                className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-700"
              >
                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                取り消し
              </button>

              <span
                role="status"
                aria-hidden={!showSaved}
                className={`font-semibold text-brand-700 transition-all duration-300 ease-out ${
                  showSaved ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
                }`}
              >
                {showSaved ? "保存済み" : ""}
              </span>

              <button
                type="button"
                onClick={() => void handleShareAnnotated()}
                disabled={sharingAnnotated}
                className="ml-auto flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-700 disabled:opacity-40"
              >
                <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                {sharingAnnotated ? "共有準備中..." : "注釈付きで共有"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="h-[420px] w-full overflow-auto rounded-2xl border border-slate-200 bg-slate-50">
        {status === "loading" ? (
          <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">読み込み中...</div>
        ) : null}
        <div className="flex min-h-full w-full items-start justify-center p-2">
          <div className="relative inline-block">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`${title} プレビュー`}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ display: status === "ready" ? "block" : "none", touchAction: "pan-x pan-y" }}
            />
            {status === "ready" && viewportSize.width > 0 ? (
              <PdfAnnotationLayer
                ref={annotationLayerRef}
                documentId={resolvedDocumentId}
                pageNumber={pageNumber}
                viewportWidth={viewportSize.width}
                viewportHeight={viewportSize.height}
                active={annotateActive}
                tool={annotateTool}
                color={annotateColor}
                strokeWidthPx={annotateWidthPx}
                penKind={annotatePenKind}
                onSaved={handleAnnotationSaved}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
