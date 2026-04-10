import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calibrateScale,
  measureDistance,
  measureArea,
  loadScale,
  saveScale,
} from "./drawing-measure.js";

function makeMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

describe("calibrateScale", () => {
  it("returns px/mm ratio for horizontal segment", () => {
    const scale = calibrateScale({ x: 0, y: 0 }, { x: 100, y: 0 }, 500);
    expect(scale).toBeCloseTo(0.2);
  });

  it("returns px/mm ratio for diagonal segment", () => {
    // 300-400-500 right triangle; pixel distance = 500, real = 1000mm
    const scale = calibrateScale({ x: 0, y: 0 }, { x: 300, y: 400 }, 1000);
    expect(scale).toBeCloseTo(0.5);
  });

  it("returns 0 when points are identical", () => {
    expect(calibrateScale({ x: 5, y: 5 }, { x: 5, y: 5 }, 100)).toBe(0);
  });

  it("returns 0 when realDistanceMm is 0", () => {
    expect(calibrateScale({ x: 0, y: 0 }, { x: 100, y: 0 }, 0)).toBe(0);
  });

  it("returns 0 when realDistanceMm is negative", () => {
    expect(calibrateScale({ x: 0, y: 0 }, { x: 100, y: 0 }, -10)).toBe(0);
  });
});

describe("measureDistance", () => {
  it("returns distance in mm for short distances", () => {
    // scale = 1 px/mm, 200px → 200mm
    const result = measureDistance({ x: 0, y: 0 }, { x: 200, y: 0 }, 1);
    expect(result.valueMm).toBeCloseTo(200);
    expect(result.label).toBe("200 mm");
  });

  it("switches to meters for distances >= 1000mm", () => {
    // scale = 0.5 px/mm, 600px → 1200mm = 1.2m
    const result = measureDistance({ x: 0, y: 0 }, { x: 600, y: 0 }, 0.5);
    expect(result.valueM).toBeCloseTo(1.2);
    expect(result.label).toBe("1.20 m");
  });

  it("returns 0 when scale is 0", () => {
    const result = measureDistance({ x: 0, y: 0 }, { x: 100, y: 0 }, 0);
    expect(result.valueMm).toBe(0);
  });

  it("handles diagonal measurement", () => {
    // 3-4-5 triangle: pixelDist=500, scale=0.5 → 1000mm = 1m
    const result = measureDistance({ x: 0, y: 0 }, { x: 300, y: 400 }, 0.5);
    expect(result.valueMm).toBeCloseTo(1000);
    expect(result.label).toBe("1.00 m");
  });
});

describe("measureArea", () => {
  it("returns correct area for a square", () => {
    // 100x100 px square; scale=1px/mm → 10000mm² = 0.01 m²
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const area = measureArea(points, 1);
    expect(area).toBeCloseTo(0.01);
  });

  it("returns 0 for less than 3 points", () => {
    expect(measureArea([{ x: 0, y: 0 }, { x: 1, y: 0 }], 1)).toBe(0);
  });

  it("returns 0 when scale is 0", () => {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }];
    expect(measureArea(points, 0)).toBe(0);
  });

  it("gives same result regardless of winding direction", () => {
    const cw = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    const ccw = [...cw].reverse();
    expect(measureArea(cw, 1)).toBeCloseTo(measureArea(ccw, 1));
  });

  it("scale affects result proportionally", () => {
    const points = [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
    ];
    const a1 = measureArea(points, 1);
    const a2 = measureArea(points, 2);
    // doubling scale → quarter the mm², quarter the m²
    expect(a1 / a2).toBeCloseTo(4);
  });
});

describe("scale persistence", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeMockStorage());
  });

  it("returns null for unknown drawing", () => {
    expect(loadScale("drawing-x")).toBeNull();
  });

  it("saves and loads scale", () => {
    saveScale("d1", 0.25);
    expect(loadScale("d1")).toBeCloseTo(0.25);
  });

  it("returns null for invalid stored value", () => {
    localStorage.setItem("drawing_scale_bad", "not-a-number");
    expect(loadScale("bad")).toBeNull();
  });

  it("overwrites scale on re-save", () => {
    saveScale("d1", 0.5);
    saveScale("d1", 0.75);
    expect(loadScale("d1")).toBeCloseTo(0.75);
  });
});
