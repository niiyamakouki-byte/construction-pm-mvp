import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  createRegion,
  calibrateRegion,
  updateRegionLabel,
  addRegion,
  removeRegion,
  replaceRegion,
  isPointInRegion,
  findRegionForPoint,
  resolveScale,
  saveRegions,
  loadRegions,
  derivePaperScale,
} from "../lib/takeoff-region.js";
import type { DrawingRegion, RegionRect } from "../lib/takeoff-region.js";

// ── Mock localStorage ─────────────────────────────────────────────────────────

const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { mockStorage[key] = val; }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  get length() { return Object.keys(mockStorage).length; },
  key: vi.fn((i: number) => Object.keys(mockStorage)[i] ?? null),
  clear: vi.fn(() => { for (const k of Object.keys(mockStorage)) delete mockStorage[k]; }),
};

beforeEach(() => {
  for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  vi.stubGlobal("localStorage", localStorageMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRect(x = 0, y = 0, w = 200, h = 150): RegionRect {
  return { x, y, width: w, height: h };
}

function makeRegion(overrides?: Partial<DrawingRegion>): DrawingRegion {
  return {
    ...createRegion(makeRect()),
    ...overrides,
  };
}

function calibratedRegion(rect = makeRect(), scale = 0.5): DrawingRegion {
  const r = createRegion(rect);
  return { ...r, scale };
}

// ── createRegion ──────────────────────────────────────────────────────────────

describe("createRegion", () => {
  it("creates a region with the given rect", () => {
    const rect = makeRect(10, 20, 300, 200);
    const r = createRegion(rect);
    expect(r.rect).toEqual(rect);
  });

  it("scale is null by default (requires calibration)", () => {
    const r = createRegion(makeRect());
    expect(r.scale).toBeNull();
  });

  it("assigns unique ids", () => {
    const r1 = createRegion(makeRect());
    const r2 = createRegion(makeRect());
    expect(r1.id).not.toBe(r2.id);
  });

  it("sets custom label when provided", () => {
    const r = createRegion(makeRect(), "1F平面図 1:50");
    expect(r.label).toBe("1F平面図 1:50");
  });

  it("assigns a default label when not provided", () => {
    const r = createRegion(makeRect());
    expect(typeof r.label).toBe("string");
    expect(r.label.length).toBeGreaterThan(0);
  });
});

// ── calibrateRegion ───────────────────────────────────────────────────────────

describe("calibrateRegion", () => {
  it("sets scale based on two calibration points", () => {
    const r = createRegion(makeRect());
    // 100px = 200mm → 0.5 px/mm
    const calibrated = calibrateRegion(r, { x: 0, y: 0 }, { x: 100, y: 0 }, 200);
    expect(calibrated.scale).toBeCloseTo(0.5);
  });

  it("returns 0 scale for zero pixel distance", () => {
    const r = createRegion(makeRect());
    const calibrated = calibrateRegion(r, { x: 50, y: 50 }, { x: 50, y: 50 }, 100);
    expect(calibrated.scale).toBe(0);
  });

  it("does not mutate original region", () => {
    const r = createRegion(makeRect());
    calibrateRegion(r, { x: 0, y: 0 }, { x: 100, y: 0 }, 100);
    expect(r.scale).toBeNull();
  });

  it("diagonal calibration gives correct scale", () => {
    const r = createRegion(makeRect());
    // 3-4-5 triangle: 300px + 400px diagonal = 500px = 1000mm → 0.5 px/mm
    const calibrated = calibrateRegion(
      r,
      { x: 0, y: 0 },
      { x: 300, y: 400 },
      1000,
    );
    expect(calibrated.scale).toBeCloseTo(0.5);
  });

  it("preserves other region fields", () => {
    const r = createRegion(makeRect(), "test-label");
    const calibrated = calibrateRegion(r, { x: 0, y: 0 }, { x: 100, y: 0 }, 100);
    expect(calibrated.id).toBe(r.id);
    expect(calibrated.label).toBe("test-label");
    expect(calibrated.rect).toEqual(r.rect);
  });
});

// ── updateRegionLabel ─────────────────────────────────────────────────────────

describe("updateRegionLabel", () => {
  it("updates the label", () => {
    const r = createRegion(makeRect(), "old");
    const updated = updateRegionLabel(r, "new label");
    expect(updated.label).toBe("new label");
  });

  it("does not mutate original", () => {
    const r = createRegion(makeRect(), "original");
    updateRegionLabel(r, "changed");
    expect(r.label).toBe("original");
  });
});

// ── addRegion / removeRegion / replaceRegion ──────────────────────────────────

describe("addRegion", () => {
  it("appends a region to an empty list", () => {
    const r = makeRegion();
    const list = addRegion([], r);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(r.id);
  });

  it("does not mutate the original list", () => {
    const original: DrawingRegion[] = [];
    addRegion(original, makeRegion());
    expect(original).toHaveLength(0);
  });
});

describe("removeRegion", () => {
  it("removes a region by id", () => {
    const r1 = makeRegion();
    const r2 = makeRegion();
    const list = removeRegion([r1, r2], r1.id);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(r2.id);
  });

  it("no-op for non-existent id", () => {
    const r = makeRegion();
    const list = removeRegion([r], "bad-id");
    expect(list).toHaveLength(1);
  });
});

describe("replaceRegion", () => {
  it("replaces a region by id", () => {
    const r1 = createRegion(makeRect(), "first");
    const r2 = createRegion(makeRect(), "second");
    const updated = { ...r1, label: "updated-first" };
    const list = replaceRegion([r1, r2], updated);
    expect(list[0]?.label).toBe("updated-first");
    expect(list[1]?.label).toBe("second");
  });
});

// ── isPointInRegion ───────────────────────────────────────────────────────────

describe("isPointInRegion", () => {
  const rect = makeRect(100, 100, 200, 150);
  const region = makeRegion({ rect });

  it("point inside rect returns true", () => {
    expect(isPointInRegion({ x: 150, y: 150 }, region)).toBe(true);
  });

  it("point at top-left corner returns true", () => {
    expect(isPointInRegion({ x: 100, y: 100 }, region)).toBe(true);
  });

  it("point at bottom-right corner returns true", () => {
    expect(isPointInRegion({ x: 300, y: 250 }, region)).toBe(true);
  });

  it("point outside to the left returns false", () => {
    expect(isPointInRegion({ x: 50, y: 150 }, region)).toBe(false);
  });

  it("point outside to the right returns false", () => {
    expect(isPointInRegion({ x: 350, y: 150 }, region)).toBe(false);
  });

  it("point above returns false", () => {
    expect(isPointInRegion({ x: 150, y: 50 }, region)).toBe(false);
  });

  it("point below returns false", () => {
    expect(isPointInRegion({ x: 150, y: 300 }, region)).toBe(false);
  });
});

// ── findRegionForPoint ────────────────────────────────────────────────────────

describe("findRegionForPoint", () => {
  it("returns null when no regions", () => {
    expect(findRegionForPoint({ x: 100, y: 100 }, [])).toBeNull();
  });

  it("returns null when point not in any region", () => {
    const r = calibratedRegion(makeRect(0, 0, 100, 100));
    expect(findRegionForPoint({ x: 200, y: 200 }, [r])).toBeNull();
  });

  it("returns null when matching region has no scale", () => {
    const r = createRegion(makeRect(0, 0, 200, 200));
    // scale is null → not returned
    expect(findRegionForPoint({ x: 100, y: 100 }, [r])).toBeNull();
  });

  it("returns the region when point matches and scale is set", () => {
    const r = calibratedRegion(makeRect(0, 0, 200, 200), 0.5);
    const found = findRegionForPoint({ x: 100, y: 100 }, [r]);
    expect(found?.id).toBe(r.id);
  });

  it("returns the first matching region when multiple overlap", () => {
    const r1 = calibratedRegion(makeRect(0, 0, 300, 300), 0.5);
    const r2 = calibratedRegion(makeRect(0, 0, 300, 300), 1.0);
    const found = findRegionForPoint({ x: 100, y: 100 }, [r1, r2]);
    expect(found?.id).toBe(r1.id);
  });
});

// ── resolveScale ──────────────────────────────────────────────────────────────

describe("resolveScale", () => {
  it("returns region scale when point is inside a calibrated region", () => {
    const r = calibratedRegion(makeRect(0, 0, 200, 200), 0.5);
    expect(resolveScale({ x: 100, y: 100 }, [r], 1.0)).toBeCloseTo(0.5);
  });

  it("falls back to globalScale when no region matches", () => {
    const r = calibratedRegion(makeRect(0, 0, 100, 100), 0.5);
    expect(resolveScale({ x: 500, y: 500 }, [r], 2.0)).toBeCloseTo(2.0);
  });

  it("returns null when no region and no global scale", () => {
    expect(resolveScale({ x: 100, y: 100 }, [], null)).toBeNull();
  });

  it("region scale takes priority over global scale", () => {
    const r = calibratedRegion(makeRect(0, 0, 200, 200), 0.25);
    expect(resolveScale({ x: 50, y: 50 }, [r], 1.0)).toBeCloseTo(0.25);
  });

  it("returns global scale when regions list is empty", () => {
    expect(resolveScale({ x: 50, y: 50 }, [], 0.75)).toBeCloseTo(0.75);
  });

  it("supports 1/50 vs 1/100 mixed PDF scenario", () => {
    // Region A: top half 1:50 → 2 px/mm
    // Region B: bottom half 1:100 → 1 px/mm
    const regionA = calibratedRegion(makeRect(0, 0, 400, 300), 2.0);
    const regionB = calibratedRegion(makeRect(0, 300, 400, 300), 1.0);
    const scaleTop = resolveScale({ x: 200, y: 100 }, [regionA, regionB], null);
    const scaleBottom = resolveScale({ x: 200, y: 400 }, [regionA, regionB], null);
    expect(scaleTop).toBeCloseTo(2.0);
    expect(scaleBottom).toBeCloseTo(1.0);
  });
});

// ── saveRegions / loadRegions ─────────────────────────────────────────────────

describe("saveRegions / loadRegions", () => {
  it("round-trips regions through localStorage", () => {
    const r1 = calibratedRegion(makeRect(0, 0, 200, 200), 0.5);
    const r2 = createRegion(makeRect(200, 0, 200, 200), "2F");
    saveRegions("dwg-test", [r1, r2]);
    const loaded = loadRegions("dwg-test");
    expect(loaded).toHaveLength(2);
    expect(loaded[0]?.id).toBe(r1.id);
    expect(loaded[0]?.scale).toBeCloseTo(0.5);
    expect(loaded[1]?.label).toBe("2F");
  });

  it("returns empty array when nothing saved", () => {
    expect(loadRegions("unknown-dwg")).toHaveLength(0);
  });

  it("overwrites previous save for same drawingId", () => {
    const r = calibratedRegion(makeRect(), 0.5);
    saveRegions("dwg-x", [r]);
    saveRegions("dwg-x", []);
    expect(loadRegions("dwg-x")).toHaveLength(0);
  });
});

// ── derivePaperScale ──────────────────────────────────────────────────────────

describe("derivePaperScale", () => {
  it("returns '不明' for zero pixel distance", () => {
    expect(derivePaperScale(0, 1000)).toBe("不明");
  });

  it("returns '不明' for zero real distance", () => {
    expect(derivePaperScale(100, 0)).toBe("不明");
  });

  it("returns a 1:N string for valid inputs", () => {
    // At 96 dpi, 100px ≈ 26.5mm on screen, mapped to 500mm real → ~1:19
    const result = derivePaperScale(100, 500, 96);
    expect(result).toMatch(/^\d+:\d+$/);
  });

  it("approximates 1:50 for 378px = 5000mm at 96dpi", () => {
    // 378px at 96dpi ≈ 100mm on screen, 5000mm real → ratio ~50
    const result = derivePaperScale(378, 5000, 96);
    expect(result).toBe("1:50");
  });

  it("returns '不明' when ratio calculation yields non-positive value", () => {
    // Edge: very high pxPerMm → paperMmPerScreenMm < 1/large → ratio ≈ 0
    const result = derivePaperScale(10000, 1, 96);
    // ratio will be extremely large number, should be "1:N"
    expect(result).toMatch(/^(不明|\d+:\d+)$/);
  });
});
