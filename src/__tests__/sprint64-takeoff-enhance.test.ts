/**
 * Sprint 64: 図面なぞり本格版テスト
 * スナップ・AI補完・オートクローズの純粋ロジック検証
 */

import { describe, it, expect } from "vitest";
import {
  snapToExistingPoint,
  snapToAxisLine,
  isNearFirstPoint,
  predictNextPoint,
  processPickupPoint,
} from "../lib/drawing-takeoff.js";
import type { TakeoffPoint } from "../lib/drawing-takeoff.js";

// ── snapToExistingPoint ───────────────────────────────────────────────────────

describe("snapToExistingPoint", () => {
  it("returns original point when existing list is empty", () => {
    const pt: TakeoffPoint = { x: 100, y: 100 };
    expect(snapToExistingPoint(pt, [])).toEqual(pt);
  });

  it("snaps to nearest existing point within radius", () => {
    const existing: TakeoffPoint[] = [{ x: 100, y: 100 }];
    // 8px away — within default 12px radius
    const candidate: TakeoffPoint = { x: 108, y: 100 };
    const result = snapToExistingPoint(candidate, existing);
    expect(result).toEqual({ x: 100, y: 100 });
  });

  it("does not snap when outside radius", () => {
    const existing: TakeoffPoint[] = [{ x: 100, y: 100 }];
    // 20px away — outside default 12px radius
    const candidate: TakeoffPoint = { x: 120, y: 100 };
    const result = snapToExistingPoint(candidate, existing);
    expect(result).toEqual(candidate);
  });

  it("snaps to the nearest of multiple candidates", () => {
    const existing: TakeoffPoint[] = [
      { x: 100, y: 100 },
      { x: 108, y: 100 }, // closer
    ];
    const candidate: TakeoffPoint = { x: 110, y: 100 };
    const result = snapToExistingPoint(candidate, existing, 15);
    // 108 is 2px away, 100 is 10px away — should snap to 108
    expect(result).toEqual({ x: 108, y: 100 });
  });

  it("respects custom snapRadius", () => {
    const existing: TakeoffPoint[] = [{ x: 100, y: 100 }];
    const candidate: TakeoffPoint = { x: 105, y: 100 };
    // With radius=3, 5px is outside
    expect(snapToExistingPoint(candidate, existing, 3)).toEqual(candidate);
    // With radius=10, 5px is inside
    expect(snapToExistingPoint(candidate, existing, 10)).toEqual({ x: 100, y: 100 });
  });
});

// ── snapToAxisLine ────────────────────────────────────────────────────────────

describe("snapToAxisLine", () => {
  it("returns original point when existing list is empty", () => {
    const pt: TakeoffPoint = { x: 50, y: 50 };
    expect(snapToAxisLine(pt, [])).toEqual(pt);
  });

  it("snaps horizontally when candidate.y is close to existing point.y", () => {
    const existing: TakeoffPoint[] = [{ x: 0, y: 100 }];
    // candidate.y = 107 → within 10px of 100
    const candidate: TakeoffPoint = { x: 200, y: 107 };
    const result = snapToAxisLine(candidate, existing, 10);
    expect(result.y).toBe(100);
    expect(result.x).toBe(200); // x unchanged
  });

  it("snaps vertically when candidate.x is close to existing point.x", () => {
    const existing: TakeoffPoint[] = [{ x: 150, y: 0 }];
    const candidate: TakeoffPoint = { x: 157, y: 300 };
    const result = snapToAxisLine(candidate, existing, 10);
    expect(result.x).toBe(150);
    expect(result.y).toBe(300);
  });

  it("does not snap when outside axis radius", () => {
    const existing: TakeoffPoint[] = [{ x: 100, y: 100 }];
    const candidate: TakeoffPoint = { x: 200, y: 200 };
    const result = snapToAxisLine(candidate, existing, 10);
    expect(result).toEqual(candidate);
  });

  it("prefers the closer axis snap when both axes qualify", () => {
    const existing: TakeoffPoint[] = [{ x: 100, y: 100 }];
    // dx=5, dy=8 — vertical (dx) is closer → snaps x
    const candidate: TakeoffPoint = { x: 105, y: 108 };
    const result = snapToAxisLine(candidate, existing, 10);
    expect(result.x).toBe(100);
    expect(result.y).toBe(108);
  });
});

// ── isNearFirstPoint ──────────────────────────────────────────────────────────

describe("isNearFirstPoint", () => {
  it("returns true when candidate is within threshold of first point", () => {
    const first: TakeoffPoint = { x: 100, y: 100 };
    // 10px away — within default 16px
    expect(isNearFirstPoint({ x: 110, y: 100 }, first)).toBe(true);
  });

  it("returns false when candidate is beyond threshold", () => {
    const first: TakeoffPoint = { x: 100, y: 100 };
    // 20px away — outside default 16px
    expect(isNearFirstPoint({ x: 120, y: 100 }, first)).toBe(false);
  });

  it("returns true at exact same position", () => {
    const first: TakeoffPoint = { x: 50, y: 75 };
    expect(isNearFirstPoint({ x: 50, y: 75 }, first)).toBe(true);
  });

  it("respects custom threshold", () => {
    const first: TakeoffPoint = { x: 0, y: 0 };
    expect(isNearFirstPoint({ x: 5, y: 0 }, first, 4)).toBe(false);
    expect(isNearFirstPoint({ x: 3, y: 0 }, first, 4)).toBe(true);
  });
});

// ── predictNextPoint ──────────────────────────────────────────────────────────

describe("predictNextPoint", () => {
  it("returns null for empty list", () => {
    expect(predictNextPoint([])).toBeNull();
  });

  it("returns null for single point", () => {
    expect(predictNextPoint([{ x: 100, y: 100 }])).toBeNull();
  });

  it("extrapolates horizontally (moving right)", () => {
    const pts: TakeoffPoint[] = [{ x: 0, y: 100 }, { x: 100, y: 100 }];
    const pred = predictNextPoint(pts);
    expect(pred).toEqual({ x: 200, y: 100 });
  });

  it("extrapolates vertically (moving down)", () => {
    const pts: TakeoffPoint[] = [{ x: 50, y: 0 }, { x: 50, y: 100 }];
    const pred = predictNextPoint(pts);
    expect(pred).toEqual({ x: 50, y: 200 });
  });

  it("extrapolates diagonally", () => {
    const pts: TakeoffPoint[] = [{ x: 0, y: 0 }, { x: 30, y: 40 }];
    const pred = predictNextPoint(pts);
    expect(pred).toEqual({ x: 60, y: 80 });
  });

  it("uses only the last two points (ignores earlier history)", () => {
    const pts: TakeoffPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 }, // turn: now going down
    ];
    const pred = predictNextPoint(pts);
    // last segment: (100,0)→(100,50), delta=(0,50)
    expect(pred).toEqual({ x: 100, y: 100 });
  });
});

// ── processPickupPoint ────────────────────────────────────────────────────────

describe("processPickupPoint", () => {
  it("returns original candidate when no existing points", () => {
    const candidate: TakeoffPoint = { x: 100, y: 200 };
    const { snapped } = processPickupPoint(candidate, []);
    expect(snapped).toEqual(candidate);
  });

  it("prediction is null when fewer than 2 points total after snap", () => {
    const candidate: TakeoffPoint = { x: 100, y: 100 };
    const { prediction } = processPickupPoint(candidate, []);
    // After snapping, allPoints has 1 element → prediction null
    expect(prediction).toBeNull();
  });

  it("returns a prediction when 2+ points available after snapping", () => {
    const existing: TakeoffPoint[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const candidate: TakeoffPoint = { x: 200, y: 0 };
    const { prediction } = processPickupPoint(candidate, existing);
    expect(prediction).not.toBeNull();
    expect(prediction?.x).toBe(300);
    expect(prediction?.y).toBe(0);
  });

  it("snaps candidate before predicting", () => {
    // Existing: straight line at y=100
    const existing: TakeoffPoint[] = [{ x: 0, y: 100 }, { x: 100, y: 100 }];
    // Candidate slightly off-axis
    const candidate: TakeoffPoint = { x: 200, y: 106 };
    const { snapped } = processPickupPoint(candidate, existing, 12, 10);
    // axis snap should pull y to 100
    expect(snapped.y).toBe(100);
  });
});
