/** Provenance: laporta-beads-0935m, authored by Codex. */
import { describe, expect, it } from "vitest";
import {
  normalizeOklch,
  oklchToHex,
  oklchToRgba,
  rgbaToOklch,
} from "../theme/oklch.js";

describe("OKLCH theme color conversion", () => {
  it("normalizes hue, chroma, lightness, and alpha", () => {
    expect(normalizeOklch({ h: -30, c: -1, l: 2, a: -0.2 })).toEqual({
      h: 330,
      c: 0,
      l: 1,
      a: 0,
    });
  });

  it("preserves an in-gamut color through RGBA round-trip", () => {
    const source = { h: 145.6704357758372, c: 0.08937599489302114, l: 0.4597527627319958, a: 0.75 };
    const roundTrip = rgbaToOklch(oklchToRgba(source));

    expect(roundTrip.h).toBeCloseTo(source.h, 6);
    expect(roundTrip.c).toBeCloseTo(source.c, 6);
    expect(roundTrip.l).toBeCloseTo(source.l, 6);
    expect(roundTrip.a).toBe(0.75);
  });

  it("maps out-of-gamut OKLCH into displayable sRGB", () => {
    const rgba = oklchToRgba({ h: 30, c: 0.5, l: 0.7 });
    for (const channel of [rgba.r, rgba.g, rgba.b, rgba.a]) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
  });

  it("reproduces the existing GenbaHub theme swatches", () => {
    expect(oklchToHex({ h: 145.6704357758372, c: 0.08937599489302114, l: 0.4597527627319958 })).toBe("#346538");
    expect(oklchToHex({ h: 251.839472158828, c: 0.06630349363882569, l: 0.4122760885957429 })).toBe("#2f4d6e");
    expect(oklchToHex({ h: 106.82317364655417, c: 0.00845291747553088, l: 0.35445649392752787 })).toBe("#3c3c37");
    expect(oklchToHex({ h: 48.927390810612, c: 0.09111981252704311, l: 0.4497156352925065 })).toBe("#7d4423");
    expect(oklchToHex({ h: 79.81221487171582, c: 0.07787872255171892, l: 0.6166872771533655 })).toBe("#9e804d");
  });
});
