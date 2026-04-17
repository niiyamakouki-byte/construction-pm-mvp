import { describe, it, expect } from "vitest";
import {
  calculateArea,
  calculatePerimeter,
  calculateLength,
  applyScale,
  setDrawingScale,
  getDefaultWasteFactor,
  createTakeoffItem,
  summarizeTakeoff,
  exportTakeoffCSV,
  mergeTakeoffSessions,
  calculateCostEstimate,
} from "./drawing-takeoff.js";
import type {
  TakeoffShape,
  TakeoffMeasurement,
  TakeoffSession,
  DrawingScale,
} from "./drawing-takeoff.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeScale(pixelsPerMeter: number): DrawingScale {
  return { pixelsPerMeter, paperScale: "1:100" };
}

function makeMeasurement(
  overrides: Partial<TakeoffMeasurement> = {},
): TakeoffMeasurement {
  return {
    id: "m1",
    shapeId: "s1",
    measureType: "area",
    rawValue: 100,
    scaledValue: 10,
    unit: "㎡",
    ...overrides,
  };
}

function makeSession(items: TakeoffSession["items"] = []): TakeoffSession {
  return {
    id: "sess1",
    projectId: "proj1",
    drawingId: "draw1",
    scale: makeScale(100),
    items,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };
}

// ── calculateArea ─────────────────────────────────────────────────────────────

describe("calculateArea", () => {
  it("returns correct area for a 100×100 square (shoelace)", () => {
    const shape: TakeoffShape = {
      id: "s1",
      type: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
    };
    expect(calculateArea(shape)).toBeCloseTo(10000);
  });

  it("returns correct area for a right triangle (shoelace)", () => {
    // base=100, height=100 → area = 5000
    const shape: TakeoffShape = {
      id: "s2",
      type: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
      ],
    };
    expect(calculateArea(shape)).toBeCloseTo(5000);
  });

  it("gives same result regardless of winding direction (CW vs CCW)", () => {
    const cw: TakeoffShape = {
      id: "s3",
      type: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
    };
    const ccw: TakeoffShape = {
      id: "s4",
      type: "polygon",
      points: [...cw.points].reverse(),
    };
    expect(calculateArea(cw)).toBeCloseTo(calculateArea(ccw));
  });

  it("returns 0 for polygon with fewer than 3 points", () => {
    const shape: TakeoffShape = {
      id: "s5",
      type: "polygon",
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    };
    expect(calculateArea(shape)).toBe(0);
  });

  it("returns 0 for empty polygon", () => {
    const shape: TakeoffShape = { id: "s6", type: "polygon", points: [] };
    expect(calculateArea(shape)).toBe(0);
  });

  it("returns π·r² for circle", () => {
    const shape: TakeoffShape = {
      id: "s7",
      type: "circle",
      points: [{ x: 50, y: 50 }],
      radius: 10,
    };
    expect(calculateArea(shape)).toBeCloseTo(Math.PI * 100);
  });

  it("returns 0 for circle with no radius", () => {
    const shape: TakeoffShape = {
      id: "s8",
      type: "circle",
      points: [{ x: 0, y: 0 }],
    };
    expect(calculateArea(shape)).toBe(0);
  });

  it("returns 0 for polyline (has no area)", () => {
    const shape: TakeoffShape = {
      id: "s9",
      type: "polyline",
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
    };
    expect(calculateArea(shape)).toBe(0);
  });

  it("handles rectangle type via shoelace", () => {
    const shape: TakeoffShape = {
      id: "s10",
      type: "rectangle",
      points: [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 50 },
        { x: 0, y: 50 },
      ],
    };
    expect(calculateArea(shape)).toBeCloseTo(10000);
  });
});

// ── calculatePerimeter ────────────────────────────────────────────────────────

describe("calculatePerimeter", () => {
  it("returns 400 for a 100×100 square", () => {
    const shape: TakeoffShape = {
      id: "p1",
      type: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
    };
    expect(calculatePerimeter(shape)).toBeCloseTo(400);
  });

  it("returns 2πr for circle", () => {
    const shape: TakeoffShape = {
      id: "p2",
      type: "circle",
      points: [{ x: 0, y: 0 }],
      radius: 10,
    };
    expect(calculatePerimeter(shape)).toBeCloseTo(2 * Math.PI * 10);
  });

  it("returns 0 for polygon with fewer than 2 points", () => {
    const shape: TakeoffShape = {
      id: "p3",
      type: "polygon",
      points: [{ x: 0, y: 0 }],
    };
    expect(calculatePerimeter(shape)).toBe(0);
  });

  it("delegates to calculateLength for polyline", () => {
    const shape: TakeoffShape = {
      id: "p4",
      type: "polyline",
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    };
    expect(calculatePerimeter(shape)).toBeCloseTo(100);
  });
});

// ── calculateLength ───────────────────────────────────────────────────────────

describe("calculateLength", () => {
  it("returns correct length for horizontal segment", () => {
    const shape: TakeoffShape = {
      id: "l1",
      type: "polyline",
      points: [{ x: 0, y: 0 }, { x: 300, y: 0 }],
    };
    expect(calculateLength(shape)).toBeCloseTo(300);
  });

  it("returns correct length for diagonal (3-4-5 triangle)", () => {
    const shape: TakeoffShape = {
      id: "l2",
      type: "polyline",
      points: [{ x: 0, y: 0 }, { x: 300, y: 400 }],
    };
    expect(calculateLength(shape)).toBeCloseTo(500);
  });

  it("returns 0 for single point", () => {
    const shape: TakeoffShape = {
      id: "l3",
      type: "polyline",
      points: [{ x: 0, y: 0 }],
    };
    expect(calculateLength(shape)).toBe(0);
  });

  it("returns 0 for empty points", () => {
    const shape: TakeoffShape = { id: "l4", type: "polyline", points: [] };
    expect(calculateLength(shape)).toBe(0);
  });

  it("accumulates multi-segment lengths", () => {
    // Two segments of 100 each
    const shape: TakeoffShape = {
      id: "l5",
      type: "polyline",
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }],
    };
    expect(calculateLength(shape)).toBeCloseTo(200);
  });
});

// ── applyScale ────────────────────────────────────────────────────────────────

describe("applyScale", () => {
  it("converts px² to ㎡ for area", () => {
    // 100 px/m → 10000 px²/m² → 10000 px² = 1 ㎡
    const scale = makeScale(100);
    expect(applyScale(10000, scale, "area")).toBeCloseTo(1);
  });

  it("converts px to m for length", () => {
    // 100 px/m → 100 px = 1 m
    const scale = makeScale(100);
    expect(applyScale(100, scale, "length")).toBeCloseTo(1);
  });

  it("converts px to m for perimeter", () => {
    const scale = makeScale(50);
    expect(applyScale(50, scale, "perimeter")).toBeCloseTo(1);
  });

  it("returns pixelValue unchanged for count", () => {
    const scale = makeScale(100);
    expect(applyScale(5, scale, "count")).toBe(5);
  });

  it("returns 0 when pixelsPerMeter is 0", () => {
    const scale = makeScale(0);
    expect(applyScale(1000, scale, "area")).toBe(0);
  });

  it("1:50 scale: 1cm on paper (≈38px at 96dpi) maps correctly", () => {
    // At 96 dpi, 1 cm = 37.8 px. At 1:50, 1 cm paper = 50 cm real = 0.5 m.
    // So pixelsPerMeter = 37.8 / 0.5 = 75.6 px/m
    const scale: DrawingScale = { pixelsPerMeter: 75.6, paperScale: "1:50" };
    // 37.8 px → 0.5 m
    expect(applyScale(37.8, scale, "length")).toBeCloseTo(0.5, 1);
  });
});

// ── setDrawingScale ───────────────────────────────────────────────────────────

describe("setDrawingScale", () => {
  it("computes pixelsPerMeter from known reference", () => {
    // 200 pixels = 2 meters → 100 px/m
    const scale = setDrawingScale(200, 2);
    expect(scale.pixelsPerMeter).toBeCloseTo(100);
  });

  it("returns zero scale for invalid inputs", () => {
    expect(setDrawingScale(0, 1).pixelsPerMeter).toBe(0);
    expect(setDrawingScale(100, 0).pixelsPerMeter).toBe(0);
    expect(setDrawingScale(-10, 1).pixelsPerMeter).toBe(0);
  });

  it("returns DrawingScale with paperScale string", () => {
    const scale = setDrawingScale(100, 1);
    expect(typeof scale.paperScale).toBe("string");
    expect(scale.paperScale).toMatch(/^\d+:\d+$/);
  });
});

// ── getDefaultWasteFactor ─────────────────────────────────────────────────────

describe("getDefaultWasteFactor", () => {
  it("returns 10% for クロス", () => {
    expect(getDefaultWasteFactor("クロス")).toBeCloseTo(0.1);
  });

  it("returns 5% for タイルカーペット", () => {
    expect(getDefaultWasteFactor("タイルカーペット")).toBeCloseTo(0.05);
  });

  it("returns 8% for フローリング", () => {
    expect(getDefaultWasteFactor("フローリング")).toBeCloseTo(0.08);
  });

  it("returns 15% for 塗装", () => {
    expect(getDefaultWasteFactor("塗装")).toBeCloseTo(0.15);
  });

  it("returns 5% for PB (石膏ボード)", () => {
    expect(getDefaultWasteFactor("PB")).toBeCloseTo(0.05);
  });

  it("returns 3% for LGS", () => {
    expect(getDefaultWasteFactor("LGS")).toBeCloseTo(0.03);
  });

  it("returns 0% for サッシ (no waste)", () => {
    expect(getDefaultWasteFactor("サッシ")).toBeCloseTo(0);
  });

  it("returns 5% for unknown categories (fallback)", () => {
    expect(getDefaultWasteFactor("謎素材")).toBeCloseTo(0.05);
  });
});

// ── createTakeoffItem ─────────────────────────────────────────────────────────

describe("createTakeoffItem", () => {
  it("applies waste factor to quantity", () => {
    const m = makeMeasurement({ scaledValue: 10 });
    const item = createTakeoffItem(m, "クロス", "㎡");
    expect(item.quantity).toBeCloseTo(10);
    expect(item.wasteFactor).toBeCloseTo(0.1);
    expect(item.totalQuantity).toBeCloseTo(11);
  });

  it("uses explicit waste factor override", () => {
    const m = makeMeasurement({ scaledValue: 20 });
    const item = createTakeoffItem(m, "その他", "㎡", 0.2);
    expect(item.wasteFactor).toBeCloseTo(0.2);
    expect(item.totalQuantity).toBeCloseTo(24);
  });

  it("sets materialName and unit correctly", () => {
    const m = makeMeasurement({ scaledValue: 5 });
    const item = createTakeoffItem(m, "フローリング", "㎡");
    expect(item.materialName).toBe("フローリング");
    expect(item.unit).toBe("㎡");
  });

  it("handles zero quantity with waste factor", () => {
    const m = makeMeasurement({ scaledValue: 0 });
    const item = createTakeoffItem(m, "クロス", "㎡");
    expect(item.totalQuantity).toBe(0);
  });

  it("accepts materialCode and note", () => {
    const m = makeMeasurement({ scaledValue: 5 });
    const item = createTakeoffItem(m, "クロス", "㎡", undefined, "MAT-001", "備考テスト");
    expect(item.materialCode).toBe("MAT-001");
    expect(item.note).toBe("備考テスト");
  });
});

// ── summarizeTakeoff ──────────────────────────────────────────────────────────

describe("summarizeTakeoff", () => {
  it("counts total items", () => {
    const m1 = makeMeasurement({ id: "m1", measureType: "area", scaledValue: 10 });
    const m2 = makeMeasurement({ id: "m2", measureType: "area", scaledValue: 5 });
    const item1 = createTakeoffItem(m1, "クロス", "㎡", 0);
    const item2 = createTakeoffItem(m2, "クロス", "㎡", 0);
    const session = makeSession([item1, item2]);
    const summary = summarizeTakeoff(session);
    expect(summary.totalItems).toBe(2);
  });

  it("groups by material name", () => {
    const mA = makeMeasurement({ id: "mA", measureType: "area", scaledValue: 10 });
    const mB = makeMeasurement({ id: "mB", measureType: "area", scaledValue: 5 });
    const itemA = createTakeoffItem(mA, "クロス", "㎡", 0);
    const itemB = createTakeoffItem(mB, "フローリング", "㎡", 0);
    const session = makeSession([itemA, itemB]);
    const summary = summarizeTakeoff(session);
    expect(Object.keys(summary.byCategory)).toHaveLength(2);
    expect(summary.byCategory["クロス"]?.count).toBe(1);
    expect(summary.byCategory["フローリング"]?.count).toBe(1);
  });

  it("accumulates totalArea for area items", () => {
    const m1 = makeMeasurement({ id: "m3", measureType: "area", scaledValue: 10 });
    const m2 = makeMeasurement({ id: "m4", measureType: "area", scaledValue: 5 });
    const item1 = createTakeoffItem(m1, "クロス", "㎡", 0);
    const item2 = createTakeoffItem(m2, "クロス", "㎡", 0);
    const session = makeSession([item1, item2]);
    const summary = summarizeTakeoff(session);
    expect(summary.byCategory["クロス"]?.totalArea).toBeCloseTo(15);
  });

  it("accumulates totalLength for length items", () => {
    const m1 = makeMeasurement({ id: "m5", measureType: "length", scaledValue: 10, unit: "m" });
    const item1 = createTakeoffItem(m1, "LGS", "m", 0);
    const session = makeSession([item1]);
    const summary = summarizeTakeoff(session);
    expect(summary.byCategory["LGS"]?.totalLength).toBeCloseTo(10);
  });

  it("returns empty summary for session with no items", () => {
    const session = makeSession([]);
    const summary = summarizeTakeoff(session);
    expect(summary.totalItems).toBe(0);
    expect(Object.keys(summary.byCategory)).toHaveLength(0);
  });
});

// ── exportTakeoffCSV ──────────────────────────────────────────────────────────

describe("exportTakeoffCSV", () => {
  it("includes CSV header row", () => {
    const session = makeSession([]);
    const csv = exportTakeoffCSV(session);
    expect(csv.startsWith("品目,数量,単位,ロス率,合計数量,備考")).toBe(true);
  });

  it("outputs one data row per item", () => {
    const m = makeMeasurement({ scaledValue: 10 });
    const item = createTakeoffItem(m, "クロス", "㎡", 0.1);
    const session = makeSession([item]);
    const csv = exportTakeoffCSV(session);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2); // header + 1 data row
  });

  it("data row contains correct columns", () => {
    const m = makeMeasurement({ scaledValue: 20 });
    const item = createTakeoffItem(m, "フローリング", "㎡", 0.08);
    const session = makeSession([item]);
    const csv = exportTakeoffCSV(session);
    const [, dataRow] = csv.split("\n");
    expect(dataRow).toContain("フローリング");
    expect(dataRow).toContain("20.000");
    expect(dataRow).toContain("㎡");
    expect(dataRow).toContain("8.0%");
    expect(dataRow).toContain("21.600");
  });

  it("escapes fields containing commas", () => {
    const m = makeMeasurement({ scaledValue: 1 });
    const item = createTakeoffItem(m, "材料A,B", "㎡", 0);
    const session = makeSession([item]);
    const csv = exportTakeoffCSV(session);
    expect(csv).toContain('"材料A,B"');
  });

  it("outputs empty data for empty session (only header)", () => {
    const csv = exportTakeoffCSV(makeSession([]));
    expect(csv.split("\n")).toHaveLength(1);
  });
});

// ── mergeTakeoffSessions ──────────────────────────────────────────────────────

describe("mergeTakeoffSessions", () => {
  it("combines items from multiple sessions", () => {
    const m1 = makeMeasurement({ id: "ma", scaledValue: 10 });
    const m2 = makeMeasurement({ id: "mb", scaledValue: 5 });
    const item1 = createTakeoffItem(m1, "クロス", "㎡", 0);
    const item2 = createTakeoffItem(m2, "フローリング", "㎡", 0);
    const s1 = makeSession([item1]);
    const s2 = { ...makeSession([item2]), id: "sess2", drawingId: "draw2" };
    const merged = mergeTakeoffSessions([s1, s2]);
    expect(merged.items).toHaveLength(2);
  });

  it("uses projectId from first session", () => {
    const session = makeSession([]);
    const merged = mergeTakeoffSessions([session]);
    expect(merged.projectId).toBe("proj1");
  });

  it("sets drawingId to 'merged'", () => {
    const merged = mergeTakeoffSessions([makeSession([])]);
    expect(merged.drawingId).toBe("merged");
  });

  it("handles merging sessions with overlapping material names (all items kept)", () => {
    const m1 = makeMeasurement({ id: "mc", scaledValue: 10 });
    const m2 = makeMeasurement({ id: "md", scaledValue: 8 });
    const item1 = createTakeoffItem(m1, "クロス", "㎡", 0);
    const item2 = createTakeoffItem(m2, "クロス", "㎡", 0);
    const s1 = makeSession([item1]);
    const s2 = { ...makeSession([item2]), id: "sess3" };
    const merged = mergeTakeoffSessions([s1, s2]);
    expect(merged.items).toHaveLength(2);
  });

  it("handles empty sessions array gracefully", () => {
    const merged = mergeTakeoffSessions([]);
    expect(merged.items).toHaveLength(0);
    expect(merged.projectId).toBe("");
  });
});

// ── calculateCostEstimate ─────────────────────────────────────────────────────

describe("calculateCostEstimate", () => {
  const costMaster = [
    { code: "MAT-001", name: "クロス", unit: "㎡", unitPrice: 1200 },
    { code: "MAT-002", name: "フローリング", unit: "㎡", unitPrice: 8000 },
    { code: "MAT-003", name: "LGS", unit: "m", unitPrice: 500 },
  ];

  it("calculates cost from materialCode match", () => {
    const m = makeMeasurement({ scaledValue: 10 });
    const item = createTakeoffItem(m, "クロス", "㎡", 0, "MAT-001");
    const session = makeSession([item]);
    // totalQuantity = 10 * (1+0) = 10; cost = 10 * 1200 = 12000
    expect(calculateCostEstimate(session, costMaster)).toBeCloseTo(12000);
  });

  it("falls back to name match when code not provided", () => {
    const m = makeMeasurement({ scaledValue: 5 });
    const item = createTakeoffItem(m, "フローリング", "㎡", 0);
    const session = makeSession([item]);
    // totalQuantity = 5; cost = 5 * 8000 = 40000
    expect(calculateCostEstimate(session, costMaster)).toBeCloseTo(40000);
  });

  it("sums costs across multiple items", () => {
    const m1 = makeMeasurement({ id: "me", scaledValue: 10 });
    const m2 = makeMeasurement({ id: "mf", scaledValue: 5 });
    const item1 = createTakeoffItem(m1, "クロス", "㎡", 0);
    const item2 = createTakeoffItem(m2, "フローリング", "㎡", 0);
    const session = makeSession([item1, item2]);
    // 10 * 1200 + 5 * 8000 = 12000 + 40000 = 52000
    expect(calculateCostEstimate(session, costMaster)).toBeCloseTo(52000);
  });

  it("contributes 0 for unmatched items", () => {
    const m = makeMeasurement({ scaledValue: 10 });
    const item = createTakeoffItem(m, "謎材料", "㎡", 0);
    const session = makeSession([item]);
    expect(calculateCostEstimate(session, costMaster)).toBe(0);
  });

  it("returns 0 for empty session", () => {
    expect(calculateCostEstimate(makeSession([]), costMaster)).toBe(0);
  });

  it("returns 0 for empty cost master", () => {
    const m = makeMeasurement({ scaledValue: 10 });
    const item = createTakeoffItem(m, "クロス", "㎡", 0);
    const session = makeSession([item]);
    expect(calculateCostEstimate(session, [])).toBe(0);
  });

  it("includes waste in cost calculation", () => {
    // 10 ㎡ + 10% waste = 11 ㎡ × 1200 = 13200
    const m = makeMeasurement({ scaledValue: 10 });
    const item = createTakeoffItem(m, "クロス", "㎡", 0.1, "MAT-001");
    const session = makeSession([item]);
    expect(calculateCostEstimate(session, costMaster)).toBeCloseTo(13200);
  });
});
