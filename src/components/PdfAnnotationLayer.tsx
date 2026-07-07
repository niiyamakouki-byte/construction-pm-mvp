import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { getStroke } from "perfect-freehand";
import {
  addStroke,
  createStroke,
  eraseAt,
  loadAnnotations,
  saveAnnotations,
  undoLastStroke,
  type PdfAnnotations,
  type PdfStroke,
  type PenKind,
} from "../lib/pdf-annotations.js";
import { PEN_PRESETS, hasRealPressureSignal, pencilEffectivePressure } from "../lib/pen-presets.js";
import type { PenSample } from "../lib/pen-stroke.js";

const SAVE_DEBOUNCE_MS = 200;
const ERASE_RADIUS_NORM = 0.02;

export type PdfAnnotationTool = "pen" | "eraser";
export type { PenKind } from "../lib/pdf-annotations.js";

// ponytail: one tiled noise swatch, generated once and reused (clipped to the
// stroke outline, multiply blend) for a subtle paper-grain feel under pencil
// ink. This is the one bit of pencil rendering we didn't hand off to
// perfect-freehand — shape/taper come from the library, texture is ours.
let grainPatternCache: CanvasPattern | null = null;
function getGrainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (grainPatternCache) return grainPatternCache;
  const swatch = document.createElement("canvas");
  swatch.width = 24;
  swatch.height = 24;
  const sctx = swatch.getContext("2d");
  if (!sctx) return null;
  const img = sctx.createImageData(24, 24);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() > 0.5 ? 0 : 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = Math.random() * 90;
  }
  sctx.putImageData(img, 0, 0);
  grainPatternCache = ctx.createPattern(swatch, "repeat");
  return grainPatternCache;
}

type StrokeInputPoint = { x: number; y: number; pressure: number };

/** Fill a perfect-freehand outline polygon; pencil also gets a clipped paper-grain pass. */
export function fillOutline(
  ctx: CanvasRenderingContext2D,
  outline: [number, number][],
  color: string,
  penKind: PenKind,
  viewportWidth: number,
  viewportHeight: number,
) {
  if (outline.length < 3) return;
  const preset = PEN_PRESETS[penKind];
  ctx.beginPath();
  const first = outline[0]!;
  ctx.moveTo(first[0], first[1]);
  for (let i = 1; i < outline.length; i++) {
    const p = outline[i]!;
    ctx.lineTo(p[0], p[1]);
  }
  ctx.closePath();
  ctx.globalAlpha = preset.alpha;
  ctx.globalCompositeOperation = preset.composite;
  ctx.fillStyle = color;
  ctx.fill();
  if (penKind === "pencil") {
    const grain = getGrainPattern(ctx);
    if (grain) {
      ctx.save();
      ctx.clip();
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = grain;
      ctx.fillRect(0, 0, viewportWidth, viewportHeight);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

export function computeOutline(points: StrokeInputPoint[], penKind: PenKind, sizePx: number): [number, number][] {
  const preset = PEN_PRESETS[penKind];
  const simulatePressure = !hasRealPressureSignal(points.map((p) => p.pressure));
  return getStroke(points, preset.strokeOptions(Math.max(1, sizePx * preset.sizeMult), simulatePressure));
}

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
  /** Ink rendering style, applied only when `tool === "pen"`. */
  penKind: PenKind;
  /** Fired each time a debounced autosave to localStorage actually completes. */
  onSaved?: () => void;
};

function devicePixelRatioSafe(): number {
  return typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
}

export const PdfAnnotationLayer = forwardRef<PdfAnnotationLayerHandle, Props>(function PdfAnnotationLayer(
  { documentId, pageNumber, viewportWidth, viewportHeight, active, tool, color, strokeWidthPx, penKind, onSaved },
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
  const livePenKindRef = useRef<PenKind>(penKind);
  // Cached outlines for already-committed strokes so live-drawing frames
  // don't re-run getStroke() on every past stroke, only the in-progress one.
  // Keyed by viewport size too, since outline coordinates are in CSS px.
  const outlineCacheRef = useRef<Map<string, [number, number][]>>(new Map());

  const getCachedOutline = useCallback(
    (stroke: PdfStroke): [number, number][] => {
      const key = `${stroke.id}|${viewportWidth}|${viewportHeight}`;
      let outline = outlineCacheRef.current.get(key);
      if (!outline) {
        const pressures = stroke.pressures ?? stroke.points.map(() => 0.5);
        const points = stroke.points.map((p, i) => ({
          x: p.x * viewportWidth,
          y: p.y * viewportHeight,
          pressure: pressures[i] ?? 0.5,
        }));
        outline = computeOutline(points, stroke.penKind ?? "ballpoint", stroke.width * viewportWidth);
        outlineCacheRef.current.set(key, outline);
      }
      return outline;
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
    for (const stroke of strokes) {
      if (stroke.points.length < 1) continue;
      const outline = getCachedOutline(stroke);
      fillOutline(ctx, outline, stroke.color, stroke.penKind ?? "ballpoint", viewportWidth, viewportHeight);
    }
  }, [viewportWidth, viewportHeight, pageNumber, getCachedOutline]);

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
      onSaved?.();
    }, SAVE_DEBOUNCE_MS);
  }, [documentId, onSaved]);

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

  /** Turn a live PenSample into perfect-freehand input, boosting pencil width by tilt. */
  const toStrokeInputPoint = useCallback((s: PenSample, kind: PenKind): StrokeInputPoint => {
    const pressure = kind === "pencil" ? pencilEffectivePressure(s.pressure, s.tiltX ?? 0, s.tiltY ?? 0) : s.pressure;
    return { x: s.x, y: s.y, pressure };
  }, []);

  // 描画中のライブプレビュー: 直前までに確定した全ストローク(キャッシュ済みのため
  // 再計算コスト無し) + 描画中の1本(perfect-freehandで毎フレーム再計算)をrAFで描く。
  const drawLiveFrame = useCallback(() => {
    rafScheduledRef.current = false;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || typeof ctx.beginPath !== "function") return;
    const samples = samplesRef.current;
    if (samples.length < 1) return;
    redrawAll();
    const kind = livePenKindRef.current;
    const inputPoints = samples.map((s) => toStrokeInputPoint(s, kind));
    const sizePx = liveWidthNormRef.current * viewportWidth;
    const outline = computeOutline(inputPoints, kind, sizePx);
    fillOutline(ctx, outline, liveColorRef.current, kind, viewportWidth, viewportHeight);
  }, [viewportWidth, viewportHeight, redrawAll, toStrokeInputPoint]);

  const scheduleIncrementalDraw = useCallback(() => {
    if (rafScheduledRef.current) return;
    rafScheduledRef.current = true;
    requestAnimationFrame(drawLiveFrame);
  }, [drawLiveFrame]);

  const finishStroke = useCallback(
    (commit: boolean) => {
      drawingRef.current = false;
      const samples = samplesRef.current;
      samplesRef.current = [];
      if (!commit || samples.length < 2) {
        redrawAll();
        return;
      }
      const kind = livePenKindRef.current;
      const points = samples.map((s) => ({ x: s.x / viewportWidth, y: s.y / viewportHeight }));
      const pressures = samples.map((s) => toStrokeInputPoint(s, kind).pressure);
      const stroke = createStroke(points, liveColorRef.current, liveWidthNormRef.current, kind, pressures);
      annotationsRef.current = addStroke(annotationsRef.current, pageNumber, stroke);
      redrawAll();
      scheduleSave();
    },
    [viewportWidth, viewportHeight, pageNumber, redrawAll, scheduleSave, toStrokeInputPoint],
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
      livePenKindRef.current = penKind;
      samplesRef.current = [
        {
          x: pos.x * viewportWidth,
          y: pos.y * viewportHeight,
          pressure: e.pressure || 0.5,
          t: e.timeStamp,
          tiltX: e.tiltX,
          tiltY: e.tiltY,
        },
      ];
    },
    [active, tool, color, strokeWidthPx, penKind, viewportWidth, viewportHeight, getNormPos, eraseAtClient],
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
          tiltX: (ev as PointerEvent).tiltX,
          tiltY: (ev as PointerEvent).tiltY,
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
