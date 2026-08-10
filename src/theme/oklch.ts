/**
 * OKLCH/RGBA conversion for perceptually uniform theme colors.
 *
 * Provenance: laporta-beads-0935m, implemented by Codex from the conversion
 * pattern in open-pencil packages/core/src/color/okhcl.ts at d6ec858243ae.
 * The upstream MIT notice is retained in THIRD_PARTY_NOTICES.md.
 */
import { converter, formatHex, toGamut } from "culori";

export interface OklchColor {
  h: number;
  c: number;
  l: number;
  a?: number;
}

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

const toRgb = converter("rgb");
const toOklch = converter("oklch");
const toDisplayableRgb = toGamut("rgb", "oklch");

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeHue(value: number): number {
  const hue = value % 360;
  return hue < 0 ? hue + 360 : hue;
}

export function normalizeOklch(color: OklchColor): Required<OklchColor> {
  return {
    h: normalizeHue(color.h),
    c: Math.max(0, color.c),
    l: clampUnit(color.l),
    a: clampUnit(color.a ?? 1),
  };
}

export function oklchToRgba(color: OklchColor): RgbaColor {
  const normalized = normalizeOklch(color);
  const rgb = toRgb(
    toDisplayableRgb({
      mode: "oklch",
      l: normalized.l,
      c: normalized.c,
      h: normalized.h,
      alpha: normalized.a,
    }),
  );

  return {
    r: clampUnit(rgb.r),
    g: clampUnit(rgb.g),
    b: clampUnit(rgb.b),
    a: clampUnit(rgb.alpha ?? normalized.a),
  };
}

export function rgbaToOklch(color: RgbaColor): Required<OklchColor> {
  const oklch = toOklch({
    mode: "rgb",
    r: clampUnit(color.r),
    g: clampUnit(color.g),
    b: clampUnit(color.b),
    alpha: clampUnit(color.a),
  });

  return normalizeOklch({
    h: oklch.h ?? 0,
    c: oklch.c,
    l: oklch.l,
    a: oklch.alpha ?? color.a,
  });
}

export function oklchToHex(color: OklchColor): string {
  const rgba = oklchToRgba(color);
  return formatHex({ mode: "rgb", r: rgba.r, g: rgba.g, b: rgba.b });
}
