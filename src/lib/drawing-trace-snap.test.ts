/**
 * Sprint 64 — 図面なぞり拾い出し本格版
 * Tests for new polyline geometry helpers, snap/predict, and cost-summary functions.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  polylineLengthPx,
  pxLengthToMetres,
  predictNextPoint,
  snapToNearestEndpoint,
  orthoSnap,
  summariseWithCost,
  sessionTotalCost,
  createSession,
  addSegment,
  updateSegment,
  TAKEOFF_CATEGORY_COLORS,
  TAKEOFF_SEGMENT_CATEGORIES,
} from "./takeoff-session.js";
import type { TakeoffSessionState, TracePoint } from "./takeoff-session.js";
import type { CostMasterEntry } from "./measurement-to-estimate-link.js";

// ── Mock localStorage ─────────────────────────────────────────────────────────

const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    mockStorage[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
  get length() {
    return Object.keys(mockStorage).length;
  },
  key: vi.fn((i: number) => Object.keys(mockStorage)[i] ?? null),
  clear: vi.fn(() => {
    for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  }),
};

beforeEach(() => {
  for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  vi.stubGlobal("localStorage", localStorageMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Sample cost master ────────────────────────────────────────────────────────

const costMaster: CostMasterEntry[] = [
  { code: "W001", name: "LGS壁ボード", unit: "㎡", unitPrice: 3200, categoryName: "壁" },
  { code: "B001", name: "巾木材", unit: "m", unitPrice: 600, categoryName: "巾木" },
  { code: "C001", name: "廻り縁材", unit: "m", unitPrice: 400, categoryName: "廻り縁" },
];

function makeSession(): TakeoffSessionState {
  return createSession("drawing-sprint64", "proj-01");
}

// ── polylineLengthPx ──────────────────────────────────────────────────────────

describe("polylineLengthPx", () => {
  it("returns 0 for empty points", () => {
    expect(polylineLengthPx([])).toBe(0);
  });

  it("returns 0 for single point", () => {
    expect(polylineLengthPx([{ x: 0, y: 0 }])).toBe(0);
  });

  it("returns correct length for horizontal segment", () => {
    const pts: TracePoint[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    expect(polylineLengthPx(pts)).toBeCloseTo(100);
  });

  it("sums multiple segments (L-shape: 100 right + 100 down = 200)", () => {
    const pts: TracePoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    expect(polylineLengthPx(pts)).toBeCloseTo(200);
  });

  it("is always longer than straight-line distance for non-straight polyline", () => {
    const pts: TracePoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ];
    const polyLen = polylineLengthPx(pts);
    const straightLen = Math.sqrt(100 * 100); // 100
    expect(polyLen).toBeGreaterThan(straightLen);
  });

  it("3-4-5 diagonal: 300px right + 400px up = 500px", () => {
    const pts: TracePoint[] = [{ x: 0, y: 0 }, { x: 300, y: 400 }];
    expect(polylineLengthPx(pts)).toBeCloseTo(500);
  });
});

// ── pxLengthToMetres ──────────────────────────────────────────────────────────

describe("pxLengthToMetres", () => {
  it("converts pixels to metres: 1000px at 1px/mm = 1m", () => {
    expect(pxLengthToMetres(1000, 1)).toBeCloseTo(1);
  });

  it("returns 0 when scale is 0", () => {
    expect(pxLengthToMetres(500, 0)).toBe(0);
  });

  it("handles typical 1:50 scale at 96dpi (≈75.6px/m approx)", () => {
    // At 96dpi, 1cm = ~37.8px. scale = 37.8px/10mm = 3.78 px/mm
    // 37.8 px / 3.78 px/mm / 1000 = 0.01 m = 1 cm
    expect(pxLengthToMetres(37.8, 3.78)).toBeCloseTo(0.01, 2);
  });
});

// ── predictNextPoint ──────────────────────────────────────────────────────────

describe("predictNextPoint", () => {
  it("returns null for fewer than 2 points", () => {
    expect(predictNextPoint([], 50)).toBeNull();
    expect(predictNextPoint([{ x: 0, y: 0 }], 50)).toBeNull();
  });

  it("predicts next point by extending last segment", () => {
    // A→B direction is right (dx=100, dy=0), extend 100px
    const pts: TracePoint[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const next = predictNextPoint(pts, 100);
    expect(next).not.toBeNull();
    expect(next!.x).toBeCloseTo(200);
    expect(next!.y).toBeCloseTo(0);
  });

  it("predicts diagonal correctly", () => {
    // A(0,0)→B(3,4): normalized (3/5, 4/5). Extend 5px → C(3,4)+1*(3/5*5, 4/5*5) = (6,8)
    const pts: TracePoint[] = [{ x: 0, y: 0 }, { x: 3, y: 4 }];
    const next = predictNextPoint(pts, 5);
    expect(next).not.toBeNull();
    expect(next!.x).toBeCloseTo(6);
    expect(next!.y).toBeCloseTo(8);
  });

  it("returns null when last two points are identical (zero vector)", () => {
    const pts: TracePoint[] = [{ x: 5, y: 5 }, { x: 5, y: 5 }];
    expect(predictNextPoint(pts, 10)).toBeNull();
  });
});

// ── snapToNearestEndpoint ─────────────────────────────────────────────────────

describe("snapToNearestEndpoint", () => {
  it("snaps to nearest point within radius", () => {
    const existing: TracePoint[] = [{ x: 100, y: 100 }];
    const candidate: TracePoint = { x: 108, y: 108 }; // dist ≈ 11.3 < 15
    const result = snapToNearestEndpoint(candidate, existing, 15);
    expect(result.snapped).toBe(true);
    expect(result.point).toEqual({ x: 100, y: 100 });
  });

  it("does not snap when outside radius", () => {
    const existing: TracePoint[] = [{ x: 0, y: 0 }];
    const candidate: TracePoint = { x: 50, y: 50 }; // dist ≈ 70.7 > 20
    const result = snapToNearestEndpoint(candidate, existing, 20);
    expect(result.snapped).toBe(false);
    expect(result.point).toEqual(candidate);
  });

  it("snaps to closest when multiple candidates", () => {
    const existing: TracePoint[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    const candidate: TracePoint = { x: 8, y: 0 }; // closer to {10,0}
    const result = snapToNearestEndpoint(candidate, existing, 20);
    expect(result.snapped).toBe(true);
    expect(result.point).toEqual({ x: 10, y: 0 });
  });

  it("returns original when existing is empty", () => {
    const candidate: TracePoint = { x: 5, y: 5 };
    const result = snapToNearestEndpoint(candidate, [], 20);
    expect(result.snapped).toBe(false);
    expect(result.point).toEqual(candidate);
  });
});

// ── orthoSnap ─────────────────────────────────────────────────────────────────

describe("orthoSnap", () => {
  it("returns null for empty points", () => {
    expect(orthoSnap([], { x: 10, y: 10 })).toBeNull();
  });

  it("locks horizontal when dx > dy", () => {
    const pts: TracePoint[] = [{ x: 0, y: 0 }];
    const result = orthoSnap(pts, { x: 100, y: 10 }); // |dx|=100 > |dy|=10
    expect(result).not.toBeNull();
    expect(result!.x).toBe(100);
    expect(result!.y).toBe(0); // locked to last.y
  });

  it("locks vertical when dy > dx", () => {
    const pts: TracePoint[] = [{ x: 50, y: 50 }];
    const result = orthoSnap(pts, { x: 55, y: 150 }); // |dy|=100 > |dx|=5
    expect(result).not.toBeNull();
    expect(result!.x).toBe(50); // locked to last.x
    expect(result!.y).toBe(150);
  });
});

// ── TAKEOFF_CATEGORY_COLORS ───────────────────────────────────────────────────

describe("TAKEOFF_CATEGORY_COLORS", () => {
  it("has a color for every category", () => {
    for (const cat of TAKEOFF_SEGMENT_CATEGORIES) {
      expect(TAKEOFF_CATEGORY_COLORS[cat]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("includes new Sprint-64 categories", () => {
    expect(TAKEOFF_CATEGORY_COLORS["廻り縁"]).toBeDefined();
    expect(TAKEOFF_CATEGORY_COLORS["天井見切"]).toBeDefined();
    expect(TAKEOFF_CATEGORY_COLORS["床見切"]).toBeDefined();
  });

  it("all colors are distinct", () => {
    const colors = Object.values(TAKEOFF_CATEGORY_COLORS);
    const unique = new Set(colors);
    expect(unique.size).toBe(colors.length);
  });
});

// ── summariseWithCost ─────────────────────────────────────────────────────────

describe("summariseWithCost", () => {
  it("returns zero cost for unlinked segments", () => {
    let session = makeSession();
    session = addSegment(session, { category: "壁", measureKind: "area", value: 10 });
    const rows = summariseWithCost(session, costMaster);
    expect(rows[0]!.totalCost).toBe(0);
    expect(rows[0]!.unitPrice).toBe(0);
  });

  it("computes totalCost = unitPrice × totalValue for linked segments", () => {
    let session = makeSession();
    session = addSegment(session, { category: "壁", measureKind: "area", value: 5 });
    // Link the segment to W001 (¥3200/㎡)
    const segId = session.segments[0]!.id;
    session = updateSegment(session, segId, {
      linkedCostCode: "W001",
      linkedCostName: "LGS壁ボード",
    });
    const rows = summariseWithCost(session, costMaster);
    expect(rows[0]!.unitPrice).toBe(3200);
    expect(rows[0]!.totalCost).toBe(5 * 3200); // 16000
  });

  it("uses first linked segment's cost code for the whole row", () => {
    let session = makeSession();
    session = addSegment(session, { category: "巾木", measureKind: "distance", value: 10 });
    session = addSegment(session, { category: "巾木", measureKind: "distance", value: 5 });
    const seg1Id = session.segments[0]!.id;
    session = updateSegment(session, seg1Id, {
      linkedCostCode: "B001",
      linkedCostName: "巾木材",
    });
    const rows = summariseWithCost(session, costMaster);
    // totalValue = 15m × ¥600 = ¥9000
    expect(rows[0]!.totalCost).toBe(15 * 600);
  });
});

// ── sessionTotalCost ──────────────────────────────────────────────────────────

describe("sessionTotalCost", () => {
  it("returns 0 for empty session", () => {
    expect(sessionTotalCost(makeSession(), costMaster)).toBe(0);
  });

  it("sums cost across multiple linked categories", () => {
    let session = makeSession();
    session = addSegment(session, { category: "壁", measureKind: "area", value: 5 });
    session = addSegment(session, { category: "巾木", measureKind: "distance", value: 10 });
    const wallId = session.segments[0]!.id;
    const basboardId = session.segments[1]!.id;
    session = updateSegment(session, wallId, { linkedCostCode: "W001", linkedCostName: "LGS壁ボード" });
    session = updateSegment(session, basboardId, { linkedCostCode: "B001", linkedCostName: "巾木材" });
    // 5 × 3200 + 10 × 600 = 16000 + 6000 = 22000
    expect(sessionTotalCost(session, costMaster)).toBe(22000);
  });

  it("returns 0 when no segments are linked to cost master", () => {
    let session = makeSession();
    session = addSegment(session, { category: "廻り縁", measureKind: "distance", value: 8 });
    expect(sessionTotalCost(session, costMaster)).toBe(0);
  });
});

// ── New categories: 廻り縁 / 天井見切 / 床見切 ───────────────────────────────

describe("new Sprint-64 categories", () => {
  it("廻り縁 can be added as a segment", () => {
    let session = makeSession();
    session = addSegment(session, { category: "廻り縁", measureKind: "distance", value: 12.5 });
    expect(session.segments[0]!.category).toBe("廻り縁");
    expect(session.segments[0]!.value).toBeCloseTo(12.5);
  });

  it("天井見切 can be added as a segment", () => {
    let session = makeSession();
    session = addSegment(session, { category: "天井見切", measureKind: "distance", value: 6 });
    expect(session.segments[0]!.category).toBe("天井見切");
  });

  it("床見切 can be added as a segment", () => {
    let session = makeSession();
    session = addSegment(session, { category: "床見切", measureKind: "distance", value: 4.2 });
    expect(session.segments[0]!.category).toBe("床見切");
  });

  it("summarises 廻り縁 length with cost link", () => {
    let session = makeSession();
    session = addSegment(session, { category: "廻り縁", measureKind: "distance", value: 10 });
    const segId = session.segments[0]!.id;
    session = updateSegment(session, segId, {
      linkedCostCode: "C001",
      linkedCostName: "廻り縁材",
    });
    // 10m × ¥400 = ¥4000
    expect(sessionTotalCost(session, costMaster)).toBe(4000);
  });
});
