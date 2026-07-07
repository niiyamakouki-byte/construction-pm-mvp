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
  type PenKind,
} from "../lib/pdf-annotations.js";
import { simplifyStroke, type PenSample } from "../lib/pen-stroke.js";

const SAVE_DEBOUNCE_MS = 200;
const ERASE_RADIUS_NORM = 0.02;
const SIMPLIFY_EPSILON_PX = 1.5;

export type PdfAnnotationTool = "pen" | "eraser";
export type { PenKind } from "../lib/pdf-annotations.js";

// ponytail: per-kind look tuned by eye against the existing ballpoint, not
// measured against real ink swatches — nudge these constants if a pen reads
// wrong on device.
const MARKER_WIDTH_MULT = 1.8;
const HIGHLIGHTER_WIDTH_MULT = 3.2;
const HIGHLIGHTER_ALPHA = 0.35;
const PENCIL_WIDTH_MULT = 0.85;
const PENCIL_MIN_ALPHA = 0.28;
const PENCIL_MAX_ALPHA = 0.75;
const PENCIL_SPEED_REF_PX_MS = 1.2;
const PENCIL_GRAIN_PX = 0.6;
/** Apple Pencil laid on its side (high tilt) draws a wider, scratchier mark. */
const PENCIL_TILT_WIDTH_BOOST = 0.9;

/** Faster stroke / lighter touch → lighter (more "graphite") mark. */
function pencilAlphaFromMotion(pxPerMs: number, pressure: number): number {
  const speedFactor = Math.max(0, 1 - Math.min(pxPerMs / PENCIL_SPEED_REF_PX_MS, 1));
  const pressureFactor = Math.min(Math.max(pressure, 0), 1);
  const t = 0.6 * speedFactor + 0.4 * pressureFactor;
  return PENCIL_MIN_ALPHA + t * (PENCIL_MAX_ALPHA - PENCIL_MIN_ALPHA);
}

/** 0 (flat/no tilt info — mouse, touch, most fingers) .. 1 (pencil laid almost flat). */
function pencilTiltFactor(tiltX: number, tiltY: number): number {
  return Math.min(1, Math.hypot(tiltX, tiltY) / 90);
}

function pencilWidthMult(tiltX: number, tiltY: number): number {
  return 1 + pencilTiltFactor(tiltX, tiltY) * PENCIL_TILT_WIDTH_BOOST;
}

/** Deterministic (index-seeded) sub-pixel jitter for a bit of graphite grain. */
function grainJitter(seed: number): number {
  const s = Math.sin(seed * 12.9898) * 43758.5453;
  return (s - Math.floor(s) - 0.5) * PENCIL_GRAIN_PX;
}

// ponytail: one tiled noise swatch, generated once and reused as a stroke
// pattern (multiply blend) for a subtle paper-grain feel under pencil ink.
// Not applied to the live in-progress segment (perf) — it appears once the
// stroke commits and the layer redraws.
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
};

function devicePixelRatioSafe(): number {
  return typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
}

export const PdfAnnotationLayer = forwardRef<PdfAnnotationLayerHandle, Props>(function PdfAnnotationLayer(
  { documentId, pageNumber, viewportWidth, viewportHeight, active, tool, color, strokeWidthPx, penKind },
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

  /** Ballpoint/marker/highlighter: one continuous path, style set once. */
  const drawUniformStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: PdfStroke, widthMult: number, alpha: number, composite: GlobalCompositeOperation) => {
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = composite;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = Math.max(1, stroke.width * viewportWidth * widthMult);
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
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    },
    [viewportWidth, viewportHeight],
  );

  /**
   * Pencil: per-segment alpha (speed/pressure) + width (tilt) + a faint
   * offset pass for grain, plus a paper-grain pattern pass on top.
   */
  const drawPencilStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: PdfStroke) => {
      const baseWidthPx = Math.max(1, stroke.width * viewportWidth * PENCIL_WIDTH_MULT);
      const grain = getGrainPattern(ctx);
      ctx.strokeStyle = stroke.color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 1; i < stroke.points.length; i++) {
        const a = stroke.points[i - 1]!;
        const b = stroke.points[i]!;
        const alpha = stroke.alphas?.[i] ?? PENCIL_MAX_ALPHA;
        const widthMult = stroke.widthMults?.[i] ?? 1;
        const jx = grainJitter(i) * widthMult;
        const jy = grainJitter(i + 100) * widthMult;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = baseWidthPx * widthMult;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(a.x * viewportWidth, a.y * viewportHeight);
        ctx.lineTo(b.x * viewportWidth + jx, b.y * viewportHeight + jy);
        ctx.stroke();
        // faint second pass, slightly offset, for a grainy (non-uniform) mark
        ctx.globalAlpha = alpha * 0.4;
        ctx.beginPath();
        ctx.moveTo(a.x * viewportWidth - jx, a.y * viewportHeight - jy);
        ctx.lineTo(b.x * viewportWidth, b.y * viewportHeight);
        ctx.stroke();
        // paper-grain texture riding on top of the ink
        if (grain) {
          ctx.strokeStyle = grain;
          ctx.globalCompositeOperation = "multiply";
          ctx.globalAlpha = alpha * 0.5;
          ctx.beginPath();
          ctx.moveTo(a.x * viewportWidth, a.y * viewportHeight);
          ctx.lineTo(b.x * viewportWidth, b.y * viewportHeight);
          ctx.stroke();
          ctx.globalCompositeOperation = "source-over";
        }
      }
      ctx.globalAlpha = 1;
    },
    [viewportWidth, viewportHeight],
  );

  const drawStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: PdfStroke) => {
      if (stroke.points.length < 2) return;
      switch (stroke.penKind) {
        case "highlighter":
          drawUniformStroke(ctx, stroke, HIGHLIGHTER_WIDTH_MULT, HIGHLIGHTER_ALPHA, "multiply");
          return;
        case "marker":
          drawUniformStroke(ctx, stroke, MARKER_WIDTH_MULT, 1, "source-over");
          return;
        case "pencil":
          drawPencilStroke(ctx, stroke);
          return;
        default:
          drawUniformStroke(ctx, stroke, 1, 1, "source-over");
      }
    },
    [drawUniformStroke, drawPencilStroke],
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
    const kind = livePenKindRef.current;
    let widthMult = kind === "highlighter" ? HIGHLIGHTER_WIDTH_MULT : kind === "marker" ? MARKER_WIDTH_MULT : kind === "pencil" ? PENCIL_WIDTH_MULT : 1;
    if (kind === "pencil") widthMult *= pencilWidthMult(b.tiltX ?? 0, b.tiltY ?? 0);
    ctx.strokeStyle = liveColorRef.current;
    ctx.lineWidth = Math.max(1, liveWidthNormRef.current * viewportWidth * widthMult);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (kind === "highlighter") {
      ctx.globalAlpha = HIGHLIGHTER_ALPHA;
      ctx.globalCompositeOperation = "multiply";
    } else if (kind === "pencil") {
      const dtMs = Math.max(1, b.t - a.t);
      const speedPxMs = Math.hypot(b.x - a.x, b.y - a.y) / dtMs;
      ctx.globalAlpha = pencilAlphaFromMotion(speedPxMs, b.pressure);
    }
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
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
      const kind = livePenKindRef.current;
      let points: { x: number; y: number }[];
      let alphas: number[] | undefined;
      let widthMults: number[] | undefined;
      if (kind === "pencil") {
        // Skip RDP simplification here: pencil needs one alpha/width per raw
        // sample (speed/pressure/tilt-derived), and typical annotation
        // strokes are short enough that this is fine.
        // ponytail: revisit with an index-preserving simplify if very long
        // pencil strokes ever bloat localStorage.
        points = samples.map((s) => ({ x: s.x / viewportWidth, y: s.y / viewportHeight }));
        alphas = samples.map((s, i) => {
          if (i === 0) return PENCIL_MAX_ALPHA;
          const prev = samples[i - 1]!;
          const dtMs = Math.max(1, s.t - prev.t);
          const speedPxMs = Math.hypot(s.x - prev.x, s.y - prev.y) / dtMs;
          return pencilAlphaFromMotion(speedPxMs, s.pressure);
        });
        widthMults = samples.map((s) => pencilWidthMult(s.tiltX ?? 0, s.tiltY ?? 0));
      } else {
        const simplifiedPx = simplifyStroke(samples, SIMPLIFY_EPSILON_PX);
        points = simplifiedPx.map((p) => ({ x: p.x / viewportWidth, y: p.y / viewportHeight }));
      }
      const stroke = createStroke(points, liveColorRef.current, liveWidthNormRef.current, kind, alphas, widthMults);
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
