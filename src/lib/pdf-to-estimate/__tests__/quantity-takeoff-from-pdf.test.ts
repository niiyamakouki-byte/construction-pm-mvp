import { describe, it, expect } from "vitest";
import { takeoffFromInterior } from "../quantity-takeoff-from-pdf.js";
import type { InteriorElement } from "../types.js";

// ─── fixtures ─────────────────────────────────────────────────────

function wallElement(lengthMm: number, confidence = 0.8): InteriorElement {
  return {
    kind: "wall",
    geometry: {
      startMm: { x: 0, y: 0 },
      endMm: { x: lengthMm, y: 0 },
      lengthMm,
      thicknessMm: 100,
    },
    inferredFrom: { pdfPage: 0, confidence },
  };
}

/** 任意の始点・終点から壁要素を生成（斜め壁テスト用）。lengthMm は Euclidean 距離で自動計算 */
function wallElementFromPoints(
  x1: number, y1: number, x2: number, y2: number, confidence = 0.8,
): InteriorElement {
  const lengthMm = Math.hypot(x2 - x1, y2 - y1);
  return {
    kind: "wall",
    geometry: { startMm: { x: x1, y: y1 }, endMm: { x: x2, y: y2 }, lengthMm, thicknessMm: 100 },
    inferredFrom: { pdfPage: 0, confidence },
  };
}

function doorElement(widthMm = 800, confidence = 0.75): InteriorElement {
  return {
    kind: "opening",
    geometry: {
      centerMm: { x: 500, y: 0 },
      widthMm,
      heightMm: 2100,
      openingType: "door",
    },
    inferredFrom: { pdfPage: 0, confidence },
  };
}

function windowElement(widthMm = 1200, confidence = 0.7): InteriorElement {
  return {
    kind: "opening",
    geometry: {
      centerMm: { x: 1000, y: 0 },
      widthMm,
      heightMm: 1200,
      openingType: "window",
    },
    inferredFrom: { pdfPage: 0, confidence },
  };
}

function floorElement(areaSqM: number, confidence = 0.7): InteriorElement {
  return {
    kind: "floor_area",
    geometry: {
      polygonMm: [
        { x: 0, y: 0 },
        { x: Math.sqrt(areaSqM) * 1000, y: 0 },
        { x: Math.sqrt(areaSqM) * 1000, y: Math.sqrt(areaSqM) * 1000 },
        { x: 0, y: Math.sqrt(areaSqM) * 1000 },
      ],
      areaSqM,
    },
    inferredFrom: { pdfPage: 0, confidence },
  };
}

// ─── Tests ────────────────────────────────────────────────────────

describe("takeoffFromInterior", () => {
  it("空の要素リストで呼び出しても items が空配列で返る", () => {
    const takeoff = takeoffFromInterior([]);
    expect(takeoff.items).toEqual([]);
    expect(takeoff.ceilingHeightMm).toBe(2400);
  });

  it("壁面積 = 壁長さ × 天井高 で計算される", () => {
    // 壁10m、天井2.4m → 壁面積24㎡
    const elements: InteriorElement[] = [wallElement(10000)];
    const takeoff = takeoffFromInterior(elements, { defaultCeilingHeight: 2400 });
    const wallItem = takeoff.items.find((i) => i.category === "壁");
    expect(wallItem).toBeDefined();
    expect(wallItem?.quantity).toBeCloseTo(24, 1);
  });

  it("天井高オプションが反映される", () => {
    const elements: InteriorElement[] = [wallElement(5000)];
    const t1 = takeoffFromInterior(elements, { defaultCeilingHeight: 2400 });
    const t2 = takeoffFromInterior(elements, { defaultCeilingHeight: 3000 });
    const a1 = t1.items.find((i) => i.category === "壁")?.quantity ?? 0;
    const a2 = t2.items.find((i) => i.category === "壁")?.quantity ?? 0;
    expect(a2).toBeGreaterThan(a1);
  });

  it("床面積が部屋面積と一致する", () => {
    const elements: InteriorElement[] = [floorElement(20)];
    const takeoff = takeoffFromInterior(elements);
    const floorItem = takeoff.items.find((i) => i.category === "床");
    expect(floorItem?.quantity).toBeCloseTo(20, 1);
  });

  it("天井面積 = 床面積", () => {
    const elements: InteriorElement[] = [floorElement(15)];
    const takeoff = takeoffFromInterior(elements);
    const floorQ = takeoff.items.find((i) => i.category === "床")?.quantity ?? 0;
    const ceilQ = takeoff.items.find((i) => i.category === "天井")?.quantity ?? 0;
    expect(ceilQ).toBeCloseTo(floorQ, 2);
  });

  it("ドアが items に含まれる", () => {
    const elements: InteriorElement[] = [doorElement(800)];
    const takeoff = takeoffFromInterior(elements);
    const door = takeoff.items.find((i) => i.item === "木製建具（ドア）");
    expect(door).toBeDefined();
    expect(door?.quantity).toBe(1);
    expect(door?.unit).toBe("個");
  });

  it("窓が items に含まれる", () => {
    const elements: InteriorElement[] = [windowElement(1200)];
    const takeoff = takeoffFromInterior(elements);
    const win = takeoff.items.find((i) => i.item === "窓");
    expect(win).toBeDefined();
    expect(win?.quantity).toBe(1);
  });

  it("巾木 = 壁長さ − 開口幅", () => {
    // 壁10m、開口0.8m → 巾木9.2m
    const elements: InteriorElement[] = [wallElement(10000), doorElement(800)];
    const takeoff = takeoffFromInterior(elements, { includeFootmolding: true });
    const skirting = takeoff.items.find((i) => i.item === "巾木");
    expect(skirting).toBeDefined();
    expect(skirting?.quantity).toBeCloseTo(9.2, 1);
  });

  it("includeFootmolding=false のとき巾木が含まれない", () => {
    const elements: InteriorElement[] = [wallElement(5000)];
    const takeoff = takeoffFromInterior(elements, { includeFootmolding: false });
    const skirting = takeoff.items.find((i) => i.item === "巾木");
    expect(skirting).toBeUndefined();
  });

  it("信頼度が 0〜1 の範囲に収まる", () => {
    const elements: InteriorElement[] = [
      wallElement(8000, 0.9),
      doorElement(800, 0.7),
      floorElement(25, 0.6),
    ];
    const takeoff = takeoffFromInterior(elements);
    for (const item of takeoff.items) {
      expect(item.confidence).toBeGreaterThanOrEqual(0);
      expect(item.confidence).toBeLessThanOrEqual(1);
    }
  });

  // ─── 斜め壁テスト ──────────────────────────────────────────────────

  it("45°斜め壁の周長が Euclidean 距離で正しく算出される（台形部屋）", () => {
    // 台形部屋: 底辺6m(水平) + 右辺4m(垂直) + 斜辺(6000,4000→0,0) + 左辺4m(垂直)
    // 斜辺: hypot(6000, 4000) ≈ 7211.1mm
    const diagonal = Math.hypot(6000, 4000); // ≈ 7211.1mm
    const elements: InteriorElement[] = [
      wallElementFromPoints(0, 0, 6000, 0),        // 底辺 6m
      wallElementFromPoints(6000, 0, 6000, 4000),  // 右辺 4m
      wallElementFromPoints(6000, 4000, 0, 0),     // 斜辺 ≈ 7211.1mm
      wallElementFromPoints(0, 4000, 0, 0),        // 左辺 4m
    ];
    const takeoff = takeoffFromInterior(elements, { defaultCeilingHeight: 2400 });
    const wallItem = takeoff.items.find((i) => i.category === "壁");
    expect(wallItem).toBeDefined();
    const expectedPerimeterM = (6000 + 4000 + diagonal + 4000) / 1000;
    const expectedAreaSqM = expectedPerimeterM * 2.4;
    expect(wallItem!.quantity).toBeCloseTo(expectedAreaSqM, 1);
  });

  it("直交矩形は wallElement と同じ結果（回帰）", () => {
    // 3m×4m 矩形: 周長14m → 壁面積14×2.4=33.6㎡
    const elements: InteriorElement[] = [
      wallElement(3000),  // 上辺
      wallElement(4000),  // 右辺
      wallElement(3000),  // 下辺
      wallElement(4000),  // 左辺
    ];
    const takeoff = takeoffFromInterior(elements, { defaultCeilingHeight: 2400 });
    const wallItem = takeoff.items.find((i) => i.category === "壁");
    expect(wallItem).toBeDefined();
    expect(wallItem!.quantity).toBeCloseTo(33.6, 1);
  });
});
