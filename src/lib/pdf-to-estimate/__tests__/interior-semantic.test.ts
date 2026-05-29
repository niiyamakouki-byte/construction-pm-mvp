import { describe, it, expect } from "vitest";
import { classifyInteriorElements } from "../interior-semantic.js";
import type { DrawingModel, PdfLine, PdfRect } from "../types.js";

// ─── fixtures ─────────────────────────────────────────────────────

function makeDrawing(overrides: Partial<DrawingModel> = {}): DrawingModel {
  return {
    source_pdf: "test.pdf",
    page_index: 0,
    page_size_pt: { x: 842, y: 595 },
    scale: "1:50",
    scale_mm_per_pt: 0.3528,
    lines: [],
    rects: [],
    texts: [],
    layers: [],
    extracted_at: "2026-04-15T00:00:00Z",
    ...overrides,
  };
}

function wallLine(overrides: Partial<PdfLine> = {}): PdfLine {
  return {
    start: { x: 0, y: 0 },
    end: { x: 2000, y: 0 },
    thickness: 1.0,
    color: "#000000",
    layer: "wall",
    semantic: "wall",
    length_pt: 2000,
    length_mm: 5000,
    ...overrides,
  };
}

function openingLine(overrides: Partial<PdfLine> = {}): PdfLine {
  return {
    start: { x: 500, y: 0 },
    end: { x: 800, y: 0 },
    thickness: 0.3,
    color: "#000000",
    layer: null,
    semantic: "opening",
    length_pt: 300,
    length_mm: 750,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────

describe("classifyInteriorElements", () => {
  it("壁線を wall 要素として返す", () => {
    const drawing = makeDrawing({ lines: [wallLine()] });
    const elements = classifyInteriorElements(drawing);
    const walls = elements.filter((e) => e.kind === "wall");
    expect(walls.length).toBe(1);
  });

  it("wall 要素の lengthMm が正しい（Euclidean距離ベース）", () => {
    // wallLine() default: start={x:0,y:0}, end={x:2000,y:0}, scale=0.3528
    // endMm.x = 2000 * 0.3528 = 705.6mm → hypot(705.6, 0) = 705.6mm
    const drawing = makeDrawing({ lines: [wallLine()] });
    const elements = classifyInteriorElements(drawing);
    const wall = elements.find((e) => e.kind === "wall");
    expect(wall).toBeDefined();
    if (wall?.kind === "wall") {
      expect(wall.geometry.lengthMm).toBeCloseTo(2000 * 0.3528, 1);
    }
  });

  it("semantic=opening の線を opening 要素として返す", () => {
    const drawing = makeDrawing({ lines: [openingLine()] });
    const elements = classifyInteriorElements(drawing);
    const ops = elements.filter((e) => e.kind === "opening");
    expect(ops.length).toBe(1);
  });

  it("開口幅が OPENING_MIN_WIDTH_MM 未満の線は無視する", () => {
    // 200mm は最小値 400mm 未満
    const line = openingLine({ length_mm: 200, length_pt: 80 });
    const drawing = makeDrawing({ lines: [line] });
    const elements = classifyInteriorElements(drawing);
    const ops = elements.filter((e) => e.kind === "opening");
    expect(ops.length).toBe(0);
  });

  it("scale_mm_per_pt が null の場合 confidence が 0.3 以下", () => {
    const drawing = makeDrawing({ scale: null, scale_mm_per_pt: null, lines: [wallLine()] });
    const elements = classifyInteriorElements(drawing);
    const wall = elements.find((e) => e.kind === "wall");
    expect(wall?.inferredFrom.confidence).toBeLessThanOrEqual(0.3);
  });

  it("壁と開口が両方ある場合、両種類の要素を返す", () => {
    const drawing = makeDrawing({ lines: [wallLine(), openingLine()] });
    const elements = classifyInteriorElements(drawing);
    expect(elements.some((e) => e.kind === "wall")).toBe(true);
    expect(elements.some((e) => e.kind === "opening")).toBe(true);
  });

  it("矩形（建具記号）を opening 要素として検出する", () => {
    const rect: PdfRect = {
      top_left: { x: 100, y: 100 },
      bottom_right: { x: 400, y: 140 }, // 幅300pt×0.3528≈105.8mm → 400mm未満: スキップ
      layer: null,
    };
    // 幅を大きくして MIN_WIDTH 以上にする
    const rect2: PdfRect = {
      top_left: { x: 100, y: 100 },
      bottom_right: { x: 2500, y: 140 }, // 幅2400pt×0.3528≈847mm → door候補
      layer: null,
    };
    const drawing = makeDrawing({ rects: [rect, rect2] });
    const elements = classifyInteriorElements(drawing);
    const ops = elements.filter((e) => e.kind === "opening");
    expect(ops.length).toBeGreaterThanOrEqual(1);
  });

  it("線が空の場合は要素を返さない", () => {
    const drawing = makeDrawing({ lines: [], rects: [] });
    const elements = classifyInteriorElements(drawing);
    expect(elements.length).toBe(0);
  });

  it("斜め壁のみで構成される閉じた部屋の床面積が正しい", () => {
    // 一辺 5000mm の正方形を 45° 回転させた菱形（対角線が軸に並行）
    // 対角線 = 5000√2 ≈ 7071mm → 半対角線 ≈ 3535.5mm
    // scale=0.3528 → 3535.5mm / 0.3528 ≈ 10021pt
    // 頂点(pt): (0,-10021), (10021,0), (0,10021), (-10021,0)
    // 実面積 = 5000mm × 5000mm = 25,000,000mm² = 25㎡
    const v0 = { x: 0, y: -10021 };
    const v1 = { x: 10021, y: 0 };
    const v2 = { x: 0, y: 10021 };
    const v3 = { x: -10021, y: 0 };
    const diag = (a: typeof v0, b: typeof v0): PdfLine =>
      wallLine({ start: a, end: b, length_mm: 5000, length_pt: 14172 });
    const lines: PdfLine[] = [diag(v0, v1), diag(v1, v2), diag(v2, v3), diag(v3, v0)];
    const drawing = makeDrawing({ lines });
    const elements = classifyInteriorElements(drawing);
    const floors = elements.filter((e) => e.kind === "floor_area");
    expect(floors.length).toBe(1);
    if (floors[0]?.kind === "floor_area") {
      expect(floors[0].geometry.areaSqM).toBeCloseTo(25, 1);
    }
  });

  it("円弧壁を含む部屋の床面積が円弧分を含む", () => {
    // 直線3辺 + 円弧1辺で閉じた領域。
    // 半径 5000mm の半円（直径=10000mm）を底辺とする半円形の部屋を近似。
    // scale=0.3528 → 半径 5000mm / 0.3528 ≈ 14172pt
    const r = 14172;
    // 半円: 弦は (-r,0)→(r,0)、円弧は上側を通る（center=原点, angle π→0）
    const arcWall: PdfLine = wallLine({
      start: { x: r, y: 0 },
      end: { x: -r, y: 0 },
      length_mm: Math.PI * 5000,
      length_pt: Math.PI * r,
      arc: { center: { x: 0, y: 0 }, radius: r, start_angle: 0, end_angle: Math.PI },
    });
    // 直径方向に閉じる直線壁
    const chordWall: PdfLine = wallLine({
      start: { x: -r, y: 0 },
      end: { x: r, y: 0 },
      length_mm: 10000,
      length_pt: 2 * r,
    });
    const drawing = makeDrawing({ lines: [arcWall, chordWall] });
    const elements = classifyInteriorElements(drawing);
    const floors = elements.filter((e) => e.kind === "floor_area");
    expect(floors.length).toBe(1);
    if (floors[0]?.kind === "floor_area") {
      // 半円面積 = π r² / 2 = π × 5²/2 ≈ 39.27㎡（多角形近似のためやや小さめ）
      expect(floors[0].geometry.areaSqM).toBeGreaterThan(35);
      expect(floors[0].geometry.areaSqM).toBeLessThanOrEqual(39.3);
    }
  });

  it("直交壁4本から room と floor_area が生成される", () => {
    // 10m×4m の矩形部屋（1:50 scale、1pt=0.3528mm）
    // 4000mm / 0.3528 = 11338pt, 10000mm / 0.3528 = 28345pt
    const lines: PdfLine[] = [
      wallLine({ start: { x: 0, y: 0 }, end: { x: 28345, y: 0 }, length_mm: 10000, length_pt: 28345 }), // 上
      wallLine({ start: { x: 0, y: 11338 }, end: { x: 28345, y: 11338 }, length_mm: 10000, length_pt: 28345 }), // 下
      wallLine({ start: { x: 0, y: 0 }, end: { x: 0, y: 11338 }, length_mm: 4000, length_pt: 11338 }), // 左
      wallLine({ start: { x: 28345, y: 0 }, end: { x: 28345, y: 11338 }, length_mm: 4000, length_pt: 11338 }), // 右
    ];
    const drawing = makeDrawing({ lines });
    const elements = classifyInteriorElements(drawing);
    const rooms = elements.filter((e) => e.kind === "room");
    const floors = elements.filter((e) => e.kind === "floor_area");
    expect(rooms.length).toBeGreaterThanOrEqual(1);
    expect(floors.length).toBeGreaterThanOrEqual(1);
  });
});
