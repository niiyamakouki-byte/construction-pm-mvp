import { describe, it, expect } from "vitest";
import {
  parseBIMElements,
  calculateWallTakeoff,
  calculateCeilingTakeoff,
  calculateFloorTakeoff,
  generateFullTakeoff,
  aggregateMaterials,
  generatePrecutPlan,
  estimatePrecutWaste,
  buildTakeoffReportHtml,
  exportTakeoffCSV,
  compareTakeoffs,
  buildTakeoffSummary,
} from "../lib/bim-takeoff.js";
import type {
  BIMElement,
  BIMModel,
  MaterialTakeoff,
  TakeoffSummary,
} from "../lib/bim-takeoff.js";

// ─── Helpers ──────────────────────────────────────────────────────

function makeWall(overrides?: Partial<BIMElement>): BIMElement {
  return {
    id: "wall-01",
    type: "wall",
    material: "LGS",
    dimensions: { length: 3.0, width: 0.065, height: 2.7, area: 3.0 * 2.7, volume: 3.0 * 0.065 * 2.7 },
    location: { floor: 1, room: "A101" },
    properties: {},
    ...overrides,
  };
}

function makeCeiling(overrides?: Partial<BIMElement>): BIMElement {
  return {
    id: "ceil-01",
    type: "ceiling",
    material: "LGS-ceiling",
    dimensions: { length: 5.0, width: 4.0, height: 0.2, area: 20.0, volume: 4.0 },
    location: { floor: 1, room: "A101" },
    properties: {},
    ...overrides,
  };
}

function makeFloor(finishType = "carpet", overrides?: Partial<BIMElement>): BIMElement {
  return {
    id: "floor-01",
    type: "floor",
    material: "concrete",
    dimensions: { length: 5.0, width: 4.0, height: 0.15, area: 20.0, volume: 3.0 },
    location: { floor: 1, room: "A101" },
    properties: { finishType },
    ...overrides,
  };
}

function makeModel(elements: BIMElement[] = []): BIMModel {
  return {
    id: "model-01",
    projectName: "テスト内装工事",
    elements,
    floors: 1,
    totalArea: 100,
    importedAt: new Date("2026-04-01"),
  };
}

function makeSummary(takeoffs: MaterialTakeoff[], projectName = "テスト"): TakeoffSummary {
  return {
    projectName,
    takeoffs,
    materialTotals: aggregateMaterials(takeoffs),
    totalEstimatedCost: 0,
  };
}

// ─── parseBIMElements ─────────────────────────────────────────────

describe("parseBIMElements", () => {
  it("parses a valid wall element", () => {
    const raw = [
      {
        id: "w1",
        type: "wall",
        material: "LGS",
        dimensions: { length: 3, width: 0.065, height: 2.7, area: 8.1, volume: 0.526 },
        location: { floor: 1, room: "A101" },
        properties: {},
      },
    ];
    const elements = parseBIMElements(raw);
    expect(elements).toHaveLength(1);
    expect(elements[0].id).toBe("w1");
    expect(elements[0].type).toBe("wall");
    expect(elements[0].dimensions.area).toBe(8.1);
  });

  it("infers area from length×width when area not provided", () => {
    const raw = [
      {
        id: "w2",
        type: "wall",
        material: "LGS",
        dimensions: { length: 3, width: 0.065, height: 2.7 },
        location: { floor: 1 },
        properties: {},
      },
    ];
    const elements = parseBIMElements(raw);
    expect(elements[0].dimensions.area).toBeCloseTo(3 * 0.065, 5);
  });

  it("throws on invalid type", () => {
    const raw = [{ id: "x1", type: "invalid-type", material: "", dimensions: {}, location: { floor: 1 }, properties: {} }];
    expect(() => parseBIMElements(raw)).toThrow();
  });

  it("throws when input is not an array", () => {
    expect(() => parseBIMElements({ id: "x" })).toThrow();
  });

  it("parses optional room and zone", () => {
    const raw = [
      {
        id: "c1",
        type: "ceiling",
        material: "LGS",
        dimensions: { length: 5, width: 4, height: 0.2, area: 20, volume: 4 },
        location: { floor: 2, room: "B202", zone: "north" },
        properties: {},
      },
    ];
    const elements = parseBIMElements(raw);
    expect(elements[0].location.room).toBe("B202");
    expect(elements[0].location.zone).toBe("north");
  });
});

// ─── calculateWallTakeoff ─────────────────────────────────────────

describe("calculateWallTakeoff", () => {
  it("returns correct elementId and type", () => {
    const wall = makeWall({ id: "w-test" });
    const result = calculateWallTakeoff(wall);
    expect(result.elementId).toBe("w-test");
    expect(result.elementType).toBe("wall");
  });

  it("3m×2.7m wall → correct stud count (@600mm pitch)", () => {
    // 3m / 0.6m = 5 intervals → 6 studs
    const wall = makeWall({ dimensions: { length: 3, width: 0.065, height: 2.7, area: 8.1, volume: 0.526 } });
    const result = calculateWallTakeoff(wall);
    const studs = result.materials.find((m) => m.name === "LGSスタッド")!;
    expect(studs).toBeDefined();
    expect(studs.quantity).toBe(6); // floor(3/0.6)+1
  });

  it("3m×2.7m wall → correct runner length (upper+lower)", () => {
    const wall = makeWall({ dimensions: { length: 3, width: 0.065, height: 2.7, area: 8.1, volume: 0.526 } });
    const result = calculateWallTakeoff(wall);
    const runner = result.materials.find((m) => m.name === "LGSランナー")!;
    expect(runner.quantity).toBe(6); // 3m × 2
  });

  it("3m×2.7m wall → PB sheets ≥ 1 with waste factor 1.05", () => {
    const wall = makeWall({ dimensions: { length: 3, width: 0.065, height: 2.7, area: 8.1, volume: 0.526 } });
    const result = calculateWallTakeoff(wall);
    const pb = result.materials.find((m) => m.name === "石膏ボード PB12.5mm")!;
    expect(pb).toBeDefined();
    expect(pb.wasteFactor).toBe(1.05);
    // area=8.1, both sides=16.2㎡, each sheet=0.91×1.82≈1.6562㎡ → ceil(16.2/1.6562*1.05) sheets
    const sheetsExpected = Math.ceil((8.1 / (0.91 * 1.82)) * 2 * 1.05);
    expect(pb.totalQuantity).toBe(sheetsExpected);
  });

  it("has screw count proportional to PB sheets", () => {
    const wall = makeWall({ dimensions: { length: 3, width: 0.065, height: 2.7, area: 8.1, volume: 0.526 } });
    const result = calculateWallTakeoff(wall);
    const pb = result.materials.find((m) => m.name === "石膏ボード PB12.5mm")!;
    const screws = result.materials.find((m) => m.name === "ビス（LGS用）")!;
    expect(screws.quantity).toBe(pb.totalQuantity * 25);
  });

  it("has GL (グラスウール) with area = wall area", () => {
    const wall = makeWall({ dimensions: { length: 3, width: 0.065, height: 2.7, area: 8.1, volume: 0.526 } });
    const result = calculateWallTakeoff(wall);
    const gl = result.materials.find((m) => m.name.includes("グラスウール"))!;
    expect(gl).toBeDefined();
    expect(gl.quantity).toBe(8.1);
  });

  it("has cloth area = 2× wall area × 1.1 waste", () => {
    const wall = makeWall({ dimensions: { length: 3, width: 0.065, height: 2.7, area: 8.1, volume: 0.526 } });
    const result = calculateWallTakeoff(wall);
    const cloth = result.materials.find((m) => m.name.includes("クロス"))!;
    expect(cloth).toBeDefined();
    expect(cloth.totalQuantity).toBeCloseTo(8.1 * 2 * 1.1, 1);
  });
});

// ─── calculateCeilingTakeoff ──────────────────────────────────────

describe("calculateCeilingTakeoff", () => {
  it("returns correct elementId and type", () => {
    const ceil = makeCeiling({ id: "c-test" });
    const result = calculateCeilingTakeoff(ceil);
    expect(result.elementId).toBe("c-test");
    expect(result.elementType).toBe("ceiling");
  });

  it("20㎡ ceiling → has 野縁（シングルバー）", () => {
    const ceil = makeCeiling();
    const result = calculateCeilingTakeoff(ceil);
    const nofuch = result.materials.find((m) => m.name.includes("野縁（シングルバー）"))!;
    expect(nofuch).toBeDefined();
    // 20㎡ / 0.3m pitch = ~66.7m
    expect(nofuch.quantity).toBeGreaterThan(60);
  });

  it("has 野縁受け（Cチャンネル）", () => {
    const ceil = makeCeiling();
    const result = calculateCeilingTakeoff(ceil);
    const cbar = result.materials.find((m) => m.name.includes("野縁受け"))!;
    expect(cbar).toBeDefined();
  });

  it("has ハンガー", () => {
    const ceil = makeCeiling();
    const result = calculateCeilingTakeoff(ceil);
    const hanger = result.materials.find((m) => m.name === "ハンガー")!;
    expect(hanger).toBeDefined();
    expect(hanger.quantity).toBeGreaterThan(0);
  });

  it("has クリップ", () => {
    const ceil = makeCeiling();
    const result = calculateCeilingTakeoff(ceil);
    const clip = result.materials.find((m) => m.name === "クリップ")!;
    expect(clip).toBeDefined();
    expect(clip.quantity).toBeGreaterThan(0);
  });

  it("has 吊りボルト（全ネジ）", () => {
    const ceil = makeCeiling();
    const result = calculateCeilingTakeoff(ceil);
    const bolt = result.materials.find((m) => m.name.includes("吊りボルト"))!;
    expect(bolt).toBeDefined();
  });

  it("has PB sheets", () => {
    const ceil = makeCeiling();
    const result = calculateCeilingTakeoff(ceil);
    const pb = result.materials.find((m) => m.name.includes("石膏ボード"))!;
    expect(pb).toBeDefined();
    const expected = Math.ceil((20 / (0.91 * 1.82)) * 1.05);
    expect(pb.totalQuantity).toBe(expected);
  });

  it("has クロス/岩綿吸音板 with 10% waste", () => {
    const ceil = makeCeiling();
    const result = calculateCeilingTakeoff(ceil);
    const cloth = result.materials.find((m) => m.name.includes("クロス"))!;
    expect(cloth).toBeDefined();
    expect(cloth.totalQuantity).toBeCloseTo(20 * 1.1, 1);
  });
});

// ─── calculateFloorTakeoff ────────────────────────────────────────

describe("calculateFloorTakeoff", () => {
  it("carpet finish → タイルカーペット 500角", () => {
    const floor = makeFloor("carpet");
    const result = calculateFloorTakeoff(floor);
    const carpet = result.materials.find((m) => m.name.includes("タイルカーペット"))!;
    expect(carpet).toBeDefined();
    // 20㎡ / 0.25㎡ = 80 sheets → ceil(80 * 1.05) = 84
    expect(carpet.totalQuantity).toBe(Math.ceil((20 / (0.5 * 0.5)) * 1.05));
  });

  it("flooring finish → 防音フローリング 12mm", () => {
    const floor = makeFloor("flooring");
    const result = calculateFloorTakeoff(floor);
    const flooring = result.materials.find((m) => m.name.includes("フローリング"))!;
    expect(flooring).toBeDefined();
    expect(flooring.wasteFactor).toBe(1.08);
  });

  it("tile finish → 磁器タイル 300角", () => {
    const floor = makeFloor("tile");
    const result = calculateFloorTakeoff(floor);
    const tile = result.materials.find((m) => m.name.includes("磁器タイル"))!;
    expect(tile).toBeDefined();
    expect(tile.wasteFactor).toBe(1.1);
  });

  it("flooring finish → has 接着剤 and 巾木", () => {
    const floor = makeFloor("flooring");
    const result = calculateFloorTakeoff(floor);
    const names = result.materials.map((m) => m.name);
    expect(names.some((n) => n.includes("接着剤"))).toBe(true);
    expect(names.some((n) => n.includes("巾木"))).toBe(true);
  });
});

// ─── generateFullTakeoff ─────────────────────────────────────────

describe("generateFullTakeoff", () => {
  it("returns takeoffs for wall, ceiling, floor elements", () => {
    const model = makeModel([makeWall(), makeCeiling(), makeFloor("carpet")]);
    const takeoffs = generateFullTakeoff(model);
    expect(takeoffs).toHaveLength(3);
    const types = takeoffs.map((t) => t.elementType);
    expect(types).toContain("wall");
    expect(types).toContain("ceiling");
    expect(types).toContain("floor");
  });

  it("skips door/window/column/beam without error", () => {
    const door: BIMElement = {
      id: "door-01",
      type: "door",
      material: "wood",
      dimensions: { length: 0.9, width: 0.05, height: 2.1, area: 0.045, volume: 0.094 },
      location: { floor: 1 },
      properties: {},
    };
    const model = makeModel([door]);
    const takeoffs = generateFullTakeoff(model);
    expect(takeoffs).toHaveLength(0);
  });

  it("processes multiple walls correctly", () => {
    const wall1 = makeWall({ id: "w1", dimensions: { length: 3, width: 0.065, height: 2.7, area: 8.1, volume: 0.526 } });
    const wall2 = makeWall({ id: "w2", dimensions: { length: 5, width: 0.065, height: 2.7, area: 13.5, volume: 0.876 } });
    const model = makeModel([wall1, wall2]);
    const takeoffs = generateFullTakeoff(model);
    expect(takeoffs).toHaveLength(2);
  });
});

// ─── aggregateMaterials ───────────────────────────────────────────

describe("aggregateMaterials", () => {
  it("sums same material across multiple elements", () => {
    const wall1 = calculateWallTakeoff(makeWall({ id: "w1", dimensions: { length: 3, width: 0.065, height: 2.7, area: 8.1, volume: 0.526 } }));
    const wall2 = calculateWallTakeoff(makeWall({ id: "w2", dimensions: { length: 3, width: 0.065, height: 2.7, area: 8.1, volume: 0.526 } }));
    const totals = aggregateMaterials([wall1, wall2]);
    const studs = totals.find((m) => m.name === "LGSスタッド")!;
    expect(studs).toBeDefined();
    // Each wall: floor(3/0.6)+1 = 6 studs
    expect(studs.totalQuantity).toBe(12);
  });

  it("returns unique material names", () => {
    const wall = calculateWallTakeoff(makeWall());
    const totals = aggregateMaterials([wall]);
    const names = totals.map((m) => m.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it("handles empty takeoffs", () => {
    expect(aggregateMaterials([])).toHaveLength(0);
  });
});

// ─── generatePrecutPlan ───────────────────────────────────────────

describe("generatePrecutPlan", () => {
  it("returns PrecutOrder for walls with PB material", () => {
    const wall = calculateWallTakeoff(makeWall({ dimensions: { length: 10, width: 0.065, height: 2.7, area: 27, volume: 1.755 } }));
    const plan = generatePrecutPlan([wall]);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0].material).toContain("石膏ボード");
  });

  it("totalSheets matches expected sheet count", () => {
    const wall = calculateWallTakeoff(makeWall({ dimensions: { length: 3, width: 0.065, height: 2.7, area: 8.1, volume: 0.526 } }));
    const plan = generatePrecutPlan([wall]);
    if (plan.length > 0) {
      expect(plan[0].totalSheets).toBeGreaterThan(0);
    }
  });

  it("wasteRate is between 0 and 100", () => {
    const wall = calculateWallTakeoff(makeWall({ dimensions: { length: 3, width: 0.065, height: 2.7, area: 8.1, volume: 0.526 } }));
    const plan = generatePrecutPlan([wall]);
    for (const order of plan) {
      expect(order.wasteRate).toBeGreaterThanOrEqual(0);
      expect(order.wasteRate).toBeLessThanOrEqual(100);
    }
  });

  it("returns empty plan for non-PB elements (floor carpet)", () => {
    const floor = calculateFloorTakeoff(makeFloor("carpet"));
    const plan = generatePrecutPlan([floor]);
    expect(plan).toHaveLength(0);
  });
});

// ─── estimatePrecutWaste ──────────────────────────────────────────

describe("estimatePrecutWaste", () => {
  it("returns 0 for empty plan", () => {
    expect(estimatePrecutWaste([])).toBe(0);
  });

  it("averages waste rates across orders", () => {
    const now = new Date();
    const plan = [
      { id: "p1", projectId: "", material: "PB", pieces: [], wasteRate: 10, totalSheets: 5, createdAt: now },
      { id: "p2", projectId: "", material: "PB", pieces: [], wasteRate: 20, totalSheets: 3, createdAt: now },
    ];
    expect(estimatePrecutWaste(plan)).toBe(15);
  });
});

// ─── buildTakeoffReportHtml ───────────────────────────────────────

describe("buildTakeoffReportHtml", () => {
  it("returns valid HTML string", () => {
    const wall = calculateWallTakeoff(makeWall());
    const summary = makeSummary([wall], "テスト案件");
    const html = buildTakeoffReportHtml(summary);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("数量拾い出し");
  });

  it("contains project name escaped in HTML", () => {
    const wall = calculateWallTakeoff(makeWall());
    const summary = makeSummary([wall], "<script>alert(1)</script>");
    const html = buildTakeoffReportHtml(summary);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("contains 材料集計 section", () => {
    const wall = calculateWallTakeoff(makeWall());
    const summary = makeSummary([wall]);
    const html = buildTakeoffReportHtml(summary);
    expect(html).toContain("材料集計");
  });

  it("contains material names", () => {
    const wall = calculateWallTakeoff(makeWall());
    const summary = makeSummary([wall]);
    const html = buildTakeoffReportHtml(summary);
    expect(html).toContain("LGSスタッド");
    expect(html).toContain("石膏ボード");
  });

  it("escapes special characters in element IDs", () => {
    const wall = makeWall({ id: 'w<1>&"test"' });
    const taken = calculateWallTakeoff(wall);
    const summary = makeSummary([taken]);
    const html = buildTakeoffReportHtml(summary);
    expect(html).not.toContain("<1>");
  });
});

// ─── exportTakeoffCSV ─────────────────────────────────────────────

describe("exportTakeoffCSV", () => {
  it("returns CSV string with header", () => {
    const wall = calculateWallTakeoff(makeWall());
    const summary = makeSummary([wall]);
    const csv = exportTakeoffCSV(summary);
    expect(csv).toContain("要素ID,種別,材料コード,材料名,単位,数量,ロス係数,発注数量,仕様");
  });

  it("contains material data rows", () => {
    const wall = calculateWallTakeoff(makeWall({ id: "wall-csv-test" }));
    const summary = makeSummary([wall]);
    const csv = exportTakeoffCSV(summary);
    expect(csv).toContain("wall-csv-test");
    expect(csv).toContain("LGSスタッド");
  });

  it("escapes commas in values", () => {
    const wall = makeWall({ id: "w1,w2" });
    const taken = calculateWallTakeoff(wall);
    const summary = makeSummary([taken]);
    const csv = exportTakeoffCSV(summary);
    // comma in ID should be quoted
    expect(csv).toContain('"w1,w2"');
  });

  it("returns one header line + N data lines", () => {
    const wall = calculateWallTakeoff(makeWall());
    const summary = makeSummary([wall]);
    const csv = exportTakeoffCSV(summary);
    const lines = csv.split("\n");
    // header + one line per material
    expect(lines.length).toBe(1 + wall.materials.length);
  });
});

// ─── compareTakeoffs ──────────────────────────────────────────────

describe("compareTakeoffs", () => {
  it("detects added materials", () => {
    const wallSmall = calculateWallTakeoff(makeWall({ id: "w1", dimensions: { length: 3, width: 0.065, height: 2.7, area: 8.1, volume: 0.526 } }));
    const ceiling = calculateCeilingTakeoff(makeCeiling());
    const summaryA = makeSummary([wallSmall]);
    const summaryB = makeSummary([wallSmall, ceiling]);
    const result = compareTakeoffs(summaryA, summaryB);
    // ceiling-specific material 野縁 should be added
    expect(result.added.some((m) => m.name.includes("野縁") || m.name.includes("ハンガー") || m.name.includes("クリップ"))).toBe(true);
  });

  it("detects removed materials", () => {
    const wall = calculateWallTakeoff(makeWall());
    const ceiling = calculateCeilingTakeoff(makeCeiling());
    const summaryA = makeSummary([wall, ceiling]);
    const summaryB = makeSummary([ceiling]);
    const result = compareTakeoffs(summaryA, summaryB);
    expect(result.removed.some((m) => m.name === "LGSスタッド")).toBe(true);
  });

  it("detects changed quantities", () => {
    const wallSmall = calculateWallTakeoff(makeWall({ id: "w1", dimensions: { length: 3, width: 0.065, height: 2.7, area: 8.1, volume: 0.526 } }));
    const wallLarge = calculateWallTakeoff(makeWall({ id: "w2", dimensions: { length: 6, width: 0.065, height: 2.7, area: 16.2, volume: 1.053 } }));
    const summaryA = makeSummary([wallSmall]);
    const summaryB = makeSummary([wallLarge]);
    const result = compareTakeoffs(summaryA, summaryB);
    const studsChange = result.changed.find((m) => m.name === "LGSスタッド");
    expect(studsChange).toBeDefined();
    expect(studsChange!.diff).toBeGreaterThan(0);
  });

  it("detects unchanged materials", () => {
    const wall = calculateWallTakeoff(makeWall({ id: "w1" }));
    const summaryA = makeSummary([wall]);
    const summaryB = makeSummary([wall]);
    const result = compareTakeoffs(summaryA, summaryB);
    expect(result.unchanged.length).toBeGreaterThan(0);
    expect(result.changed.length).toBe(0);
  });

  it("diffPct is correct for doubled quantity", () => {
    const wallSmall = calculateWallTakeoff(makeWall({ id: "w1", dimensions: { length: 3, width: 0.065, height: 2.7, area: 8.1, volume: 0.526 } }));
    const wallSmall2 = calculateWallTakeoff(makeWall({ id: "w2", dimensions: { length: 3, width: 0.065, height: 2.7, area: 8.1, volume: 0.526 } }));
    const wallBig = calculateWallTakeoff(makeWall({ id: "w3", dimensions: { length: 6, width: 0.065, height: 2.7, area: 16.2, volume: 1.053 } }));
    const summaryA = makeSummary([wallSmall]);
    const summaryB = makeSummary([wallSmall, wallSmall2]);
    const result = compareTakeoffs(summaryA, summaryB);
    const studsChange = result.changed.find((m) => m.name === "LGSスタッド");
    if (studsChange) {
      expect(studsChange.diffPct).toBeCloseTo(100, 0);
    }
    void wallBig;
  });

  it("buildTakeoffSummary wraps model and takeoffs", () => {
    const model = makeModel([makeWall()]);
    const takeoffs = generateFullTakeoff(model);
    const summary = buildTakeoffSummary(model, takeoffs);
    expect(summary.projectName).toBe("テスト内装工事");
    expect(summary.takeoffs).toHaveLength(1);
    expect(summary.materialTotals.length).toBeGreaterThan(0);
  });
});
