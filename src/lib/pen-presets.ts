/**
 * Pen-kind → perfect-freehand parameter presets for PDF hand-drawn annotation.
 *
 * We lean on perfect-freehand (MIT, github.com/steveruizok/perfect-freehand —
 * the same stroke engine tldraw and Excalidraw use) for stroke shape/taper
 * instead of hand-rolling variable-width polylines. The only bespoke bit is
 * the pencil's paper-grain texture (see getGrainPattern in
 * PdfAnnotationLayer.tsx), per explicit product direction.
 */
import type { StrokeOptions } from "perfect-freehand";
import type { PenKind } from "./pdf-annotations.js";

export type PenRenderPreset = {
  /** Multiplier applied to the user-chosen 細/太 width to get perfect-freehand's `size`. */
  sizeMult: number;
  alpha: number;
  composite: GlobalCompositeOperation;
  strokeOptions: (size: number, simulatePressure: boolean) => StrokeOptions;
};

export const PEN_PRESETS: Record<PenKind, PenRenderPreset> = {
  ballpoint: {
    sizeMult: 1,
    alpha: 1,
    composite: "source-over",
    strokeOptions: (size, simulatePressure) => ({
      size,
      thinning: 0.35,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure,
    }),
  },
  marker: {
    sizeMult: 1.8,
    alpha: 0.92,
    composite: "source-over",
    strokeOptions: (size) => ({
      size,
      thinning: 0.1,
      smoothing: 0.5,
      streamline: 0.55,
      simulatePressure: false,
    }),
  },
  highlighter: {
    sizeMult: 3.2,
    alpha: 0.35,
    composite: "multiply",
    strokeOptions: (size) => ({
      size,
      thinning: 0,
      smoothing: 0.5,
      streamline: 0.55,
      simulatePressure: false,
    }),
  },
  pencil: {
    sizeMult: 0.8,
    alpha: 0.8,
    composite: "source-over",
    strokeOptions: (size, simulatePressure) => ({
      size,
      thinning: 0.7,
      smoothing: 0.45,
      streamline: 0.3,
      simulatePressure,
    }),
  },
};

/**
 * perfect-freehand's `simulatePressure: true` derives width from velocity
 * and effectively ignores whatever per-point pressure we pass in. So: use
 * real pressure (Apple Pencil) when the stroke actually carries a signal,
 * and only fall back to velocity-simulated width when it doesn't (mouse,
 * finger touch, or a Pencil that reports a flat 0.5 for some other reason).
 */
export function hasRealPressureSignal(pressures: number[]): boolean {
  return pressures.some((p) => Math.abs(p - 0.5) > 0.02);
}

/**
 * Apple Pencil laid on its side (high tilt) should read as a wider mark,
 * same as real graphite. perfect-freehand only takes pressure, so fold tilt
 * into an effective pressure value for the pencil tool only.
 */
export function pencilEffectivePressure(pressure: number, tiltX: number, tiltY: number): number {
  const tiltFactor = Math.min(1, Math.hypot(tiltX, tiltY) / 90);
  return Math.min(1, pressure + tiltFactor * 0.5);
}
