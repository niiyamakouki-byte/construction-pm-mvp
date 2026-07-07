import { describe, it, expect } from "vitest";
import { PEN_PRESETS, hasRealPressureSignal, pencilEffectivePressure } from "./pen-presets.js";

describe("PEN_PRESETS", () => {
  it("has an entry for all 4 pen kinds", () => {
    expect(Object.keys(PEN_PRESETS).sort()).toEqual(["ballpoint", "highlighter", "marker", "pencil"]);
  });
});

describe("hasRealPressureSignal", () => {
  it("is false for a flat 0.5 (mouse/touch default) series", () => {
    expect(hasRealPressureSignal([0.5, 0.5, 0.5])).toBe(false);
  });

  it("is true once any point deviates from the neutral default", () => {
    expect(hasRealPressureSignal([0.5, 0.5, 0.8])).toBe(true);
  });
});

describe("pencilEffectivePressure", () => {
  it("returns the raw pressure when the pencil is flat (no tilt)", () => {
    expect(pencilEffectivePressure(0.4, 0, 0)).toBe(0.4);
  });

  it("boosts pressure when the pencil is laid on its side (high tilt)", () => {
    const flat = pencilEffectivePressure(0.4, 0, 0);
    const tilted = pencilEffectivePressure(0.4, 60, 60);
    expect(tilted).toBeGreaterThan(flat);
  });

  it("never exceeds 1 even at maximum tilt and pressure", () => {
    expect(pencilEffectivePressure(1, 90, 90)).toBeLessThanOrEqual(1);
  });
});
