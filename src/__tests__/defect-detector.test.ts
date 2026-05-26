/**
 * RuleBasedDetector のユニットテスト
 *
 * Node 環境では OffscreenCanvas/ImageData が使えないため、
 * ImageDataLike フィクスチャ (RGBA 数値配列) を直接 detect() に渡す。
 */
import { describe, it, expect } from "vitest";
import { RuleBasedDetector } from "../lib/photo-inspection/defect-detector.js";
import type { ImageDataLike } from "../lib/photo-inspection/defect-detector.js";
import { DEFECT_KINDS } from "../lib/photo-inspection/types.js";

// ── フィクスチャ生成ユーティリティ ────────────────────────────────────────────

/** width x height の RGBA フラット配列を生成 (全ピクセル同色) */
function solidColor(w: number, h: number, r: number, g: number, b: number, a = 255): ImageDataLike {
  const data = new Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
  return { width: w, height: h, data };
}

/** チェッカーボード — 白黒交互 (高エッジ = crack候補) */
function checkerboard(w: number, h: number): ImageDataLike {
  const data = new Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = (x + y) % 2 === 0 ? 255 : 0;
      const idx = (y * w + x) * 4;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

/** 水平ストライプ — 明暗交互 (中程度エッジ = scratch候補) */
function horizontalStripes(w: number, h: number, stripeH = 2): ImageDataLike {
  const data = new Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const v = Math.floor(y / stripeH) % 2 === 0 ? 200 : 60;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

/** 青みがかった暗色 (水濡れ候補) */
function blueishDark(w: number, h: number): ImageDataLike {
  return solidColor(w, h, 40, 50, 110);
}

/** 赤茶色 (汚れ候補) */
function reddishBrown(w: number, h: number): ImageDataLike {
  return solidColor(w, h, 150, 80, 50);
}

/** 黄変色 (変色候補) */
function yellowish(w: number, h: number): ImageDataLike {
  return solidColor(w, h, 200, 180, 60);
}

/** 極端に暗い (部品欠損候補) */
function nearBlack(w: number, h: number): ImageDataLike {
  return solidColor(w, h, 10, 10, 10);
}

// ── テスト ────────────────────────────────────────────────────────────────────

const detector = new RuleBasedDetector();

describe("RuleBasedDetector — 基本", () => {
  it("空画像 (0x0) → 欠陥なし", async () => {
    const result = await detector.detect({ width: 0, height: 0, data: [] });
    expect(result).toHaveLength(0);
  });

  it("1x1 純白 → 欠陥なし", async () => {
    const result = await detector.detect(solidColor(1, 1, 255, 255, 255));
    expect(result).toHaveLength(0);
  });

  it("返り値は配列", async () => {
    const result = await detector.detect(solidColor(4, 4, 200, 200, 200));
    expect(Array.isArray(result)).toBe(true);
  });

  it("各 Defect に id/kind/bbox/confidence が存在する", async () => {
    const result = await detector.detect(checkerboard(8, 8));
    if (result.length > 0) {
      for (const d of result) {
        expect(d.id).toBeTruthy();
        expect(DEFECT_KINDS).toContain(d.kind);
        expect(d.confidence).toBeGreaterThanOrEqual(0);
        expect(d.confidence).toBeLessThanOrEqual(1);
        expect(d.bbox.x).toBeGreaterThanOrEqual(0);
        expect(d.bbox.y).toBeGreaterThanOrEqual(0);
        expect(d.bbox.w).toBeGreaterThan(0);
        expect(d.bbox.h).toBeGreaterThan(0);
      }
    }
  });

  it("bbox は正規化 0-1 の範囲内", async () => {
    const result = await detector.detect(checkerboard(8, 8));
    for (const d of result) {
      expect(d.bbox.x + d.bbox.w).toBeLessThanOrEqual(1.001);
      expect(d.bbox.y + d.bbox.h).toBeLessThanOrEqual(1.001);
    }
  });
});

describe("RuleBasedDetector — エッジ検出 (crack/scratch)", () => {
  it("チェッカーボード → crack または scratch を検出", async () => {
    const result = await detector.detect(checkerboard(8, 8));
    const hasCrackOrScratch = result.some((d) => d.kind === "crack" || d.kind === "scratch");
    expect(hasCrackOrScratch).toBe(true);
  });

  it("チェッカーボード → confidence >= 0.3", async () => {
    const result = await detector.detect(checkerboard(8, 8));
    const edge = result.filter((d) => d.kind === "crack" || d.kind === "scratch");
    expect(edge.every((d) => d.confidence >= 0.3)).toBe(true);
  });

  it("水平ストライプ → 何らかのエッジ系欠陥を検出", async () => {
    const result = await detector.detect(horizontalStripes(8, 8, 1));
    expect(result.length).toBeGreaterThan(0);
  });

  it("純白 4x4 → crack/scratch を検出しない", async () => {
    const result = await detector.detect(solidColor(4, 4, 240, 240, 240));
    const edge = result.filter((d) => d.kind === "crack" || d.kind === "scratch");
    expect(edge).toHaveLength(0);
  });
});

describe("RuleBasedDetector — 色解析 (stain/water_damage/discoloration)", () => {
  it("青みがかった暗色 → water_damage を検出", async () => {
    const result = await detector.detect(blueishDark(8, 8));
    const hasWater = result.some((d) => d.kind === "water_damage");
    expect(hasWater).toBe(true);
  });

  it("赤茶色 → stain を検出", async () => {
    const result = await detector.detect(reddishBrown(8, 8));
    const hasStain = result.some((d) => d.kind === "stain");
    expect(hasStain).toBe(true);
  });

  it("黄変 → discoloration を検出", async () => {
    const result = await detector.detect(yellowish(8, 8));
    const hasDisco = result.some((d) => d.kind === "discoloration");
    expect(hasDisco).toBe(true);
  });

  it("純白 → stain/water_damage を検出しない", async () => {
    const result = await detector.detect(solidColor(4, 4, 255, 255, 255));
    const color = result.filter((d) => d.kind === "stain" || d.kind === "water_damage");
    expect(color).toHaveLength(0);
  });
});

describe("RuleBasedDetector — 輝度解析 (missing_part)", () => {
  it("極端に暗い → missing_part を検出", async () => {
    const result = await detector.detect(nearBlack(4, 4));
    const hasMissing = result.some((d) => d.kind === "missing_part");
    expect(hasMissing).toBe(true);
  });

  it("明るい画像 → missing_part を検出しない", async () => {
    const result = await detector.detect(solidColor(4, 4, 200, 200, 200));
    const missing = result.filter((d) => d.kind === "missing_part");
    expect(missing).toHaveLength(0);
  });
});

describe("RuleBasedDetector — コントラスト解析 (misalignment/peeling)", () => {
  it("左右で輝度が大きく違う画像 → 何らかの欠陥を検出する", async () => {
    // 左半分が暗く右半分が明るい 8x4 の ImageData
    // 境界でエッジが強く出るため crack/scratch になる場合もある
    const w = 8, h = 4;
    const data = new Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = x < 4 ? 20 : 220;
        const idx = (y * w + x) * 4;
        data[idx] = v; data[idx + 1] = v; data[idx + 2] = v; data[idx + 3] = 255;
      }
    }
    const result = await detector.detect({ width: w, height: h, data });
    // 強コントラスト境界は crack/scratch/misalignment/peeling のいずれかで検出される
    const hasBoundaryDefect = result.some(
      (d) => d.kind === "crack" || d.kind === "scratch" || d.kind === "misalignment" || d.kind === "peeling",
    );
    expect(hasBoundaryDefect).toBe(true);
  });

  it("均一な中間グレー画像では misalignment を検出しない", async () => {
    const result = await detector.detect(solidColor(8, 8, 128, 128, 128));
    const hasAlign = result.some((d) => d.kind === "misalignment" || d.kind === "peeling");
    expect(hasAlign).toBe(false);
  });
});

describe("RuleBasedDetector — 冪等性", () => {
  it("同じ画像を 2 回処理すると同じ kind セットを返す", async () => {
    const img = checkerboard(8, 8);
    const r1 = await detector.detect(img);
    const r2 = await detector.detect(img);
    const kinds1 = [...new Set(r1.map((d) => d.kind))].sort();
    const kinds2 = [...new Set(r2.map((d) => d.kind))].sort();
    expect(kinds1).toEqual(kinds2);
  });

  it("各呼び出しで Defect の id は異なる", async () => {
    const img = checkerboard(8, 8);
    const r1 = await detector.detect(img);
    const r2 = await detector.detect(img);
    if (r1.length > 0 && r2.length > 0) {
      expect(r1[0].id).not.toBe(r2[0].id);
    }
  });
});

describe("RuleBasedDetector — 大サイズ画像", () => {
  it("16x16 画像を正常に処理できる", async () => {
    const result = await detector.detect(checkerboard(16, 16));
    expect(Array.isArray(result)).toBe(true);
  });

  it("1x8 (縦長) 画像でエラーにならない", async () => {
    const result = await detector.detect(horizontalStripes(1, 8));
    expect(Array.isArray(result)).toBe(true);
  });
});
