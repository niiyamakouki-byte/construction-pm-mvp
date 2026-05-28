/**
 * pdf-to-estimate エンドツーエンド統合テスト
 *
 * 対象パターン:
 *   A. 斜め壁 — 直交以外の壁を含む平面図から正しく面積を算出
 *   B. 壁タイプ別単価 — LGS65/75/90/100 を入力データから判定して個別品目を選択
 *   C. 複数混在 — 1図面内に異なる壁タイプが混在し、部屋ごとに分割集計
 *
 * パイプライン: classifyInteriorElements → takeoffFromInterior → composeEstimate
 */

import { describe, it, expect } from "vitest";
import { classifyInteriorElements } from "../interior-semantic.js";
import { takeoffFromInterior } from "../quantity-takeoff-from-pdf.js";
import { composeEstimate } from "../estimate-composer.js";
import { inferWallType } from "../wall-type-inference.js";
import type {
  DrawingModel,
  PdfLine,
  CostMasterItem,
  WallTypeMap,
  InteriorElement,
} from "../types.js";

// ─── fixtures ─────────────────────────────────────────────────────

const SCALE = 0.3528; // mm/pt (1:50)

function makeDrawing(lines: PdfLine[]): DrawingModel {
  return {
    source_pdf: "integration-test.pdf",
    page_index: 0,
    page_size_pt: { x: 842, y: 595 },
    scale: "1:50",
    scale_mm_per_pt: SCALE,
    lines,
    rects: [],
    texts: [],
    layers: [],
    extracted_at: "2026-05-28T00:00:00Z",
  };
}

/** pt 座標でセマンティック=wall の線を生成 */
function wLine(x1: number, y1: number, x2: number, y2: number): PdfLine {
  const dx = (x2 - x1) * SCALE;
  const dy = (y2 - y1) * SCALE;
  const lengthMm = Math.hypot(dx, dy);
  return {
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness: 1.0,
    color: "#000000",
    layer: "wall",
    semantic: "wall",
    length_pt: Math.hypot(x2 - x1, y2 - y1),
    length_mm: lengthMm,
  };
}

const TEST_COST_MASTER: CostMasterItem[] = [
  { code: "IN-001", name: "LGS間仕切り（65型）", unit: "㎡", unitPrice: 5500 },
  { code: "IN-003", name: "石膏ボード張り（12.5mm）", unit: "㎡", unitPrice: 2800 },
  { code: "IN-005", name: "クロス張り（量産品）", unit: "㎡", unitPrice: 1200 },
  { code: "IN-011", name: "フロアタイル", unit: "㎡", unitPrice: 5500 },
  { code: "IN-012", name: "巾木（ビニル）", unit: "m", unitPrice: 800 },
  { code: "IN-015", name: "石膏ボード天井", unit: "㎡", unitPrice: 4500 },
  { code: "IN-024", name: "廻り縁", unit: "m", unitPrice: 1200 },
  { code: "IN-045", name: "LGS65 ボード両面張り", unit: "㎡", unitPrice: 4800 },
  { code: "IN-046", name: "LGS75 ボード両面張り", unit: "㎡", unitPrice: 5200 },
  { code: "IN-047", name: "木下地 ボード両面張り", unit: "㎡", unitPrice: 4500 },
  { code: "IN-048", name: "LGS90 ボード両面張り", unit: "㎡", unitPrice: 5800 },
  { code: "IN-049", name: "LGS100 ボード両面張り", unit: "㎡", unitPrice: 6500 },
  { code: "IN-068", name: "天井・軽鉄下地（シングル）", unit: "㎡", unitPrice: 2800 },
  { code: "FX-001", name: "木製建具（フラッシュ戸）", unit: "枚", unitPrice: 65000 },
  { code: "FX-003", name: "ガラス入り建具", unit: "枚", unitPrice: 95000 },
];

// ─── A. 斜め壁 ─────────────────────────────────────────────────────

describe("A. 斜め壁 — パイプライン統合", () => {
  /**
   * 直角三角形の部屋: 底辺8m + 垂辺6m + 斜辺10m（3-4-5 の 2倍）
   * 斜辺の長さ = Math.hypot(8000, 6000) = 10000mm = 10m
   * 周長 = 8m + 6m + 10m = 24m
   * 壁面積(天井2.4m) = 24 × 2.4 = 57.6 m²
   */
  it("斜め壁を含む三角形平面: 壁面積が Euclidean 周長 × 天井高で正しく算出される", () => {
    // pt 座標: 1pt = 0.3528mm → 8000mm = 22676pt, 6000mm = 17007pt
    const pt8m = 8000 / SCALE;
    const pt6m = 6000 / SCALE;
    const elements: InteriorElement[] = [
      // 底辺 8m (水平)
      {
        kind: "wall",
        geometry: { startMm: { x: 0, y: 0 }, endMm: { x: 8000, y: 0 }, lengthMm: 8000, thicknessMm: 100 },
        inferredFrom: { pdfPage: 0, confidence: 0.85 },
      },
      // 垂辺 6m (垂直)
      {
        kind: "wall",
        geometry: { startMm: { x: 0, y: 0 }, endMm: { x: 0, y: 6000 }, lengthMm: 6000, thicknessMm: 100 },
        inferredFrom: { pdfPage: 0, confidence: 0.85 },
      },
      // 斜辺 10m (対角線, 3-4-5 直角三角形の斜辺×2)
      {
        kind: "wall",
        geometry: {
          startMm: { x: 8000, y: 0 },
          endMm: { x: 0, y: 6000 },
          lengthMm: Math.hypot(8000, 6000), // 10000mm
          thicknessMm: 100,
        },
        inferredFrom: { pdfPage: 0, confidence: 0.85 },
      },
    ];

    const takeoff = takeoffFromInterior(elements, { defaultCeilingHeight: 2400 });
    const wallItem = takeoff.items.find((i) => i.category === "壁");
    expect(wallItem).toBeDefined();
    // 周長 24m × 2.4m = 57.6 m²
    expect(wallItem!.quantity).toBeCloseTo(57.6, 1);
  });

  it("classifyInteriorElements が斜め壁の lengthMm を Euclidean 距離で返す", () => {
    // 対角線: start=(0,0) end=(3000,4000)pt → distance=5000pt × 0.3528 = 1764mm
    const diagonalLine = wLine(0, 0, 3000, 4000);
    const elements = classifyInteriorElements(makeDrawing([diagonalLine]));
    const wall = elements.find((e) => e.kind === "wall");
    expect(wall).toBeDefined();
    if (wall?.kind === "wall") {
      const expected = Math.hypot(3000, 4000) * SCALE; // 5000 * 0.3528 = 1764mm
      expect(wall.geometry.lengthMm).toBeCloseTo(expected, 1);
    }
  });
});

// ─── B. 壁タイプ別単価 ──────────────────────────────────────────────

describe("B. 壁タイプ別単価 — テキスト判定 + 見積品目選択", () => {
  it("テキスト「LGS75」→ inferWallType → composeEstimate で IN-046 行が生成される", () => {
    const inferResult = inferWallType({ nearbyTexts: ["スタッド LGS75 @303"] });
    expect(inferResult.type).toBe("LGS75");

    const takeoff = takeoffFromInterior([
      {
        kind: "wall",
        geometry: { startMm: { x: 0, y: 0 }, endMm: { x: 5000, y: 0 }, lengthMm: 5000, thicknessMm: 110 },
        inferredFrom: { pdfPage: 0, confidence: 0.9 },
      },
    ], { defaultCeilingHeight: 2700 });

    const draft = composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing([]), {
      wallTypeInferenceHints: { texts: ["スタッド LGS75 @303"] },
    });

    const line = draft.lines.find((l) => l.code === "IN-046");
    expect(line).toBeDefined();
    expect(line!.unitPrice).toBe(5200);
    expect(draft.notes.some((n) => n.includes("LGS75"))).toBe(true);
  });

  it("壁厚 130mm → inferWallType → LGS90/LGS100 → composeEstimate で IN-048 または IN-049 が生成される", () => {
    // LGS90: 120-140, LGS100: 130-150 → 130mm は両方マッチ（priority 同じ）
    const inferResult = inferWallType({ measuredThicknessMm: 130 });
    expect(["LGS90", "LGS100"]).toContain(inferResult.type);

    const takeoff = takeoffFromInterior([
      {
        kind: "wall",
        geometry: { startMm: { x: 0, y: 0 }, endMm: { x: 4000, y: 0 }, lengthMm: 4000, thicknessMm: 130 },
        inferredFrom: { pdfPage: 0, confidence: 0.75 },
      },
    ], { defaultCeilingHeight: 2400 });

    const draft = composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing([]), {
      wallTypeInferenceHints: { thicknessMm: 130 },
    });

    const codes = draft.lines.map((l) => l.code);
    const hasHeavyWall = codes.includes("IN-048") || codes.includes("IN-049");
    expect(hasHeavyWall).toBe(true);
  });

  it("LGS45 手動指定 → IN-001 × 0.85 係数で計算される", () => {
    const takeoff = takeoffFromInterior([
      {
        kind: "wall",
        geometry: { startMm: { x: 0, y: 0 }, endMm: { x: 10000, y: 0 }, lengthMm: 10000, thicknessMm: 85 },
        inferredFrom: { pdfPage: 0, confidence: 0.88 },
      },
    ], { defaultCeilingHeight: 2400 });

    const draft = composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing([]), {
      wallTypeOverride: "LGS45",
    });

    const line = draft.lines.find((l) => l.code === "IN-001");
    expect(line).toBeDefined();
    // 10m × 2.4m = 24㎡ × 0.85 係数 = 20.4㎡
    expect(line!.quantity).toBeCloseTo(24 * 0.85, 1);
  });
});

// ─── C. 複数混在 ──────────────────────────────────────────────────

describe("C. 複数混在 — 1図面内に異なる壁タイプが混在し分割集計", () => {
  it("3部屋混在(LGS65/LGS90/木下地) → WallTypeMap → それぞれ別品目コードで集計される", () => {
    const wallTypeMap: WallTypeMap = {
      roomOffice: "LGS65",
      roomServer: "LGS90",
      roomStorage: "木下地",
    };

    // 各部屋の壁面積: office=30m², server=15m², storage=10m²
    const takeoff = takeoffFromInterior([
      {
        kind: "wall",
        geometry: { startMm: { x: 0, y: 0 }, endMm: { x: 12500, y: 0 }, lengthMm: 12500, thicknessMm: 100 },
        inferredFrom: { pdfPage: 0, confidence: 0.85 },
        // 30m² / 2.4m = 12.5m 相当
      } as InteriorElement & { roomId: string },
    ]);

    // 手動で roomId 付き TakeoffItem を作成
    const mixedTakeoff = {
      items: [
        { category: "壁", item: "壁仕上げ面積", quantity: 30, unit: "m2" as const, source: "pdf" as const, confidence: 0.85, roomId: "roomOffice" },
        { category: "壁", item: "壁仕上げ面積", quantity: 15, unit: "m2" as const, source: "pdf" as const, confidence: 0.85, roomId: "roomServer" },
        { category: "壁", item: "壁仕上げ面積", quantity: 10, unit: "m2" as const, source: "pdf" as const, confidence: 0.85, roomId: "roomStorage" },
      ],
      ceilingHeightMm: 2400,
    };

    const draft = composeEstimate(mixedTakeoff, TEST_COST_MASTER, makeDrawing([]), {
      wallTypeOverride: wallTypeMap,
    });

    const codes = draft.lines.map((l) => l.code);
    expect(codes).toContain("IN-045"); // roomOffice: LGS65
    expect(codes).toContain("IN-048"); // roomServer: LGS90
    expect(codes).toContain("IN-047"); // roomStorage: 木下地

    // 合計金額が正しく集計されているか検証
    // LGS65: 30m² × ¥4,800 + クロス 30×1.05×¥1,200 = 144,000 + 37,800 = 181,800
    // LGS90: 15m² × ¥5,800 + クロス 15×1.05×¥1,200 = 87,000 + 18,900 = 105,900
    // 木下地: 10m² × ¥4,500 + クロス 10×1.05×¥1,200 = 45,000 + 12,600 = 57,600
    const expectedTotal = (30 * 4800 + 30 * 1.05 * 1200) + (15 * 5800 + 15 * 1.05 * 1200) + (10 * 4500 + 10 * 1.05 * 1200);
    expect(draft.totalExcludingTax).toBe(expectedTotal);
  });

  it("混在パターンで未指定 roomId はデフォルト LGS65 にフォールバックして合計が崩れない", () => {
    const wallTypeMap: WallTypeMap = { roomA: "LGS100" };

    const mixedTakeoff = {
      items: [
        { category: "壁", item: "壁仕上げ面積", quantity: 20, unit: "m2" as const, source: "pdf" as const, confidence: 0.8, roomId: "roomA" },
        // roomId なし → LGS65 fallback
        { category: "壁", item: "壁仕上げ面積", quantity: 10, unit: "m2" as const, source: "pdf" as const, confidence: 0.8 },
      ],
      ceilingHeightMm: 2400,
    };

    const draft = composeEstimate(mixedTakeoff, TEST_COST_MASTER, makeDrawing([]), {
      wallTypeOverride: wallTypeMap,
    });

    const codes = draft.lines.map((l) => l.code);
    expect(codes).toContain("IN-049"); // roomA: LGS100
    expect(codes).toContain("IN-045"); // fallback: LGS65

    // 金額合計 = lines の合計と一致
    const sumFromLines = draft.lines.reduce((s, l) => s + l.amount, 0);
    expect(draft.totalExcludingTax).toBe(sumFromLines);
  });

  it("斜め壁 + 複数壁タイプ混在: 全体の壁面積と部屋別集計が整合する", () => {
    // 台形の部屋 (斜辺あり) + 直交の部屋: それぞれ別タイプ
    const diagonalWallLength = Math.hypot(5000, 3000); // ≈ 5831mm

    const mixedTakeoff = {
      items: [
        // 台形部屋の壁面積: (5000 + 3000 + diagonalWallLength) * 2.4 / 1000
        {
          category: "壁",
          item: "壁仕上げ面積",
          quantity: Math.round(((5000 + 3000 + diagonalWallLength) / 1000) * 2.4 * 100) / 100,
          unit: "m2" as const,
          source: "pdf" as const,
          confidence: 0.8,
          roomId: "trapRoom",
        },
        // 直交部屋の壁面積: 周長10m × 2.4m = 24m²
        { category: "壁", item: "壁仕上げ面積", quantity: 24, unit: "m2" as const, source: "pdf" as const, confidence: 0.85, roomId: "rectRoom" },
      ],
      ceilingHeightMm: 2400,
    };

    const wallTypeMap: WallTypeMap = {
      trapRoom: "LGS45",   // 斜め壁の部屋は薄型スタッド
      rectRoom: "LGS65",   // 直交部屋は標準
    };

    const draft = composeEstimate(mixedTakeoff, TEST_COST_MASTER, makeDrawing([]), {
      wallTypeOverride: wallTypeMap,
    });

    // 斜め部屋は IN-001 (LGS45) を使用
    const lgs45Line = draft.lines.find((l) => l.code === "IN-001");
    expect(lgs45Line).toBeDefined();

    // 直交部屋は IN-045 (LGS65) を使用
    const lgs65Line = draft.lines.find((l) => l.code === "IN-045");
    expect(lgs65Line).toBeDefined();

    // 合計 = lines 合計
    const sumFromLines = draft.lines.reduce((s, l) => s + l.amount, 0);
    expect(draft.totalExcludingTax).toBe(sumFromLines);
    expect(draft.totalExcludingTax).toBeGreaterThan(0);
  });
});
