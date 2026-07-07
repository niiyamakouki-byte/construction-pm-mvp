import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import {
  addStroke,
  createStroke,
  eraseAt,
  loadAnnotations,
  saveAnnotations,
  undoLastStroke,
  type PdfAnnotations,
  type PdfStroke,
} from "../lib/pdf-annotations.js";
import { simplifyStroke, type PenSample } from "../lib/pen-stroke.js";

const SAVE_DEBOUNCE_MS = 200;
const ERASE_RADIUS_NORM = 0.02;
const SIMPLIFY_EPSILON_PX = 1.5;

export type PdfAnnotationTool = "pen" | "eraser";

export type PdfAnnotationLayerHandle = {
  undo: () => void;
  /** Composite this overlay onto `baseCanvas` and return a PNG blob (null if unavailable). */
  exportComposite: (baseCanvas: HTMLCanvasElement) => Promise<Blob | null>;
};

type Props = {
  /** Storage key for persisted annotations (per-document). */
  documentId: string;
  pageNumber: number;
  /** Displayed (CSS px) size of the PDF page — must match the base canvas. */
  viewportWidth: number;
  viewportHeight: number;
  /** Annotation mode on/off. When off, the layer is fully click-through. */
  active: boolean;
  tool: PdfAnnotationTool;
  color: string;
  /** Thin/thick stroke width in CSS px at the current viewport size. */
  strokeWidthPx: number;
};

function devicePixelRatioSafe(): number {
  return typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
}

export const PdfAnnotationLayer = forwardRef<PdfAnnotationLayerHandle, Props>(function PdfAnnotationLayer(
  { documentId, pageNumber, viewportWidth, viewportHeight, active, tool, color, strokeWidthPx },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const annotationsRef = useRef<PdfAnnotations>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawingRef = useRef(false);
  const penEverUsedRef = useRef(false);
  const samplesRef = useRef<PenSample[]>([]);
  const rafScheduledRef = useRef(false);
  const liveColorRef = useRef(color);
  const liveWidthNormRef = useRef(0);

  const drawStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: PdfStroke) => {
      if (stroke.points.length < 2) return;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = Math.max(1, stroke.width * viewportWidth);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      const first = stroke.points[0]!;
      ctx.moveTo(first.x * viewportWidth, first.y * viewportHeight);
      for (let i = 1; i < stroke.points.length; i++) {
        const p = stroke.points[i]!;
        ctx.lineTo(p.x * viewportWidth, p.y * viewportHeight);
      }
      ctx.stroke();
    },
    [viewportWidth, viewportHeight],
  );

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewportWidth <= 0 || viewportHeight <= 0) return;
    const dpr = devicePixelRatioSafe();
    canvas.width = Math.floor(viewportWidth * dpr);
    canvas.height = Math.floor(viewportHeight * dpr);
    canvas.style.width = `${viewportWidth}px`;
    canvas.style.height = `${viewportHeight}px`;
    const ctx = canvas.getContext("2d");
    // テスト環境ではgetContextが最小限のスタブ({}など)を返すことがあるため、
    // 2D APIが揃っていない場合は描画をスキップする(実ブラウザでは常に揃っている)。
    if (!ctx || typeof ctx.setTransform !== "function" || typeof ctx.clearRect !== "function") return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewportWidth, viewportHeight);
    const strokes = annotationsRef.current[pageNumber] ?? [];
    for (const stroke of strokes) drawStroke(ctx, stroke);
  }, [viewportWidth, viewportHeight, pageNumber, drawStroke]);

  // documentId変化時にlocalStorageから注釈を読み込む(drawing-pinsと同じ初期化パターン)
  useEffect(() => {
    annotationsRef.current = loadAnnotations(documentId);
    redrawAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- documentId変化時のみ再読込。redrawAllは同フレーム内の最新版を使う
  }, [documentId]);

  // ページ切替・ズーム・回転でviewport寸法が変わるたびに全再描画(既存ストロークが追従する)
  useEffect(() => {
    redrawAll();
  }, [redrawAll]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveAnnotations(documentId, annotationsRef.current);
    }, SAVE_DEBOUNCE_MS);
  }, [documentId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const getNormPos = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x, y };
  }, []);

  const eraseAtClient = useCallback(
    (clientX: number, clientY: number) => {
      const pos = getNormPos(clientX, clientY);
      if (!pos) return;
      const next = eraseAt(annotationsRef.current, pageNumber, pos.x, pos.y, ERASE_RADIUS_NORM);
      if (next !== annotationsRef.current) {
        annotationsRef.current = next;
        redrawAll();
        scheduleSave();
      }
    },
    [pageNumber, redrawAll, scheduleSave, getNormPos],
  );

  // 描画中のライブプレビュー: 直近セグメントだけ足す(全ストローク再描画より低レイテンシ)。
  // rAFで1フレームにつき1回だけ描くようバッチする。
  const drawIncrementalSegment = useCallback(() => {
    rafScheduledRef.current = false;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || typeof ctx.beginPath !== "function") return;
    const samples = samplesRef.current;
    if (samples.length < 2) return;
    const a = samples[samples.length - 2]!;
    const b = samples[samples.length - 1]!;
    ctx.strokeStyle = liveColorRef.current;
    ctx.lineWidth = Math.max(1, liveWidthNormRef.current * viewportWidth);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }, [viewportWidth]);

  const scheduleIncrementalDraw = useCallback(() => {
    if (rafScheduledRef.current) return;
    rafScheduledRef.current = true;
    requestAnimationFrame(drawIncrementalSegment);
  }, [drawIncrementalSegment]);

  const finishStroke = useCallback(
    (commit: boolean) => {
      drawingRef.current = false;
      const samples = samplesRef.current;
      samplesRef.current = [];
      if (!commit || samples.length < 2) {
        redrawAll();
        return;
      }
      const simplifiedPx = simplifyStroke(samples, SIMPLIFY_EPSILON_PX);
      const points = simplifiedPx.map((p) => ({ x: p.x / viewportWidth, y: p.y / viewportHeight }));
      const stroke = createStroke(points, liveColorRef.current, liveWidthNormRef.current);
      annotationsRef.current = addStroke(annotationsRef.current, pageNumber, stroke);
      redrawAll();
      scheduleSave();
    },
    [viewportWidth, viewportHeight, pageNumber, redrawAll, scheduleSave],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!active) return;
      if (e.pointerType === "pen") penEverUsedRef.current = true;
      // palm rejection ハイブリッド: pen入力が一度でも観測された環境ではtouchを無視する。
      // pen非対応環境(スマホ等)ではtouchが唯一の入力なので許可する。
      if (e.pointerType === "touch" && penEverUsedRef.current) return;
      const pos = getNormPos(e.clientX, e.clientY);
      if (!pos) return;
      (e.currentTarget as HTMLCanvasElement).setPointerCapture?.(e.pointerId);
      drawingRef.current = true;

      if (tool === "eraser") {
        eraseAtClient(e.clientX, e.clientY);
        return;
      }

      liveColorRef.current = color;
      liveWidthNormRef.current = strokeWidthPx / viewportWidth;
      samplesRef.current = [
        {
          x: pos.x * viewportWidth,
          y: pos.y * viewportHeight,
          pressure: e.pressure || 0.5,
          t: e.timeStamp,
        },
      ];
    },
    [active, tool, color, strokeWidthPx, viewportWidth, viewportHeight, getNormPos, eraseAtClient],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      if (e.pointerType === "touch" && penEverUsedRef.current) return;

      if (tool === "eraser") {
        eraseAtClient(e.clientX, e.clientY);
        return;
      }

      // 高頻度サンプルがある環境では coalesced events を全部使う
      const native = e.nativeEvent;
      const events: PointerEvent[] = native.getCoalescedEvents ? native.getCoalescedEvents() : [native];
      const list = events.length > 0 ? events : [native];
      for (const ev of list) {
        const pos = getNormPos(ev.clientX, ev.clientY);
        if (!pos) continue;
        samplesRef.current.push({
          x: pos.x * viewportWidth,
          y: pos.y * viewportHeight,
          pressure: (ev as PointerEvent).pressure || 0.5,
          t: ev.timeStamp,
        });
      }
      scheduleIncrementalDraw();
    },
    [tool, viewportWidth, viewportHeight, getNormPos, eraseAtClient, scheduleIncrementalDraw],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      (e.currentTarget as HTMLCanvasElement).releasePointerCapture?.(e.pointerId);
      finishStroke(true);
    },
    [finishStroke],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      (e.currentTarget as HTMLCanvasElement).releasePointerCapture?.(e.pointerId);
      finishStroke(false);
    },
    [finishStroke],
  );

  useImperativeHandle(
    ref,
    () => ({
      undo: () => {
        annotationsRef.current = undoLastStroke(annotationsRef.current, pageNumber);
        redrawAll();
        saveAnnotations(documentId, annotationsRef.current);
      },
      exportComposite: async (baseCanvas: HTMLCanvasElement) => {
        const overlay = canvasRef.current;
        if (!overlay) return null;
        const out = document.createElement("canvas");
        out.width = baseCanvas.width;
        out.height = baseCanvas.height;
        const ctx = out.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(baseCanvas, 0, 0);
        ctx.drawImage(overlay, 0, 0, out.width, out.height);
        return new Promise<Blob | null>((resolve) => out.toBlob((b) => resolve(b), "image/png"));
      },
    }),
    [documentId, pageNumber, redrawAll],
  );

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        touchAction: active ? "none" : undefined,
        pointerEvents: active ? "auto" : "none",
        cursor: active ? (tool === "eraser" ? "cell" : "crosshair") : "default",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    />
  );
});
