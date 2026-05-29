import { describe, it, expect } from "vitest";
import { assembleDrawingModel } from "../to-drawing-model.js";
import type { RawSeg } from "../raw-types.js";

const baseOpts = {
  sourceName: "test.pdf",
  pageIndex: 0,
  pageSizePt: { x: 842, y: 595 },
  scale: "1:50",
  scaleMmPerPt: 17.63889,
};

describe("assembleDrawingModel", () => {
  it("約 0.8pt のドリフトを 0.5pt グリッドへスナップして端点を一致させる", () => {
    // 同一の角(100,0)を共有すべき 2 セグメントに微小ドリフト(<0.4pt)を入れる。
    // スナップ後は完全一致し、1pt 許容のループ判定が確実に通る。
    const segs: RawSeg[] = [
      // 角(0,0)→(100,0) の終点が 100.2,0.1 にドリフト
      { start: { x: 0.0, y: 0.0 }, end: { x: 100.2, y: 0.1 }, width: 1 },
      // 同じ角(100,0)を始点とするが 99.9,-0.1 にドリフト
      { start: { x: 99.9, y: -0.1 }, end: { x: 100.0, y: 80.0 }, width: 1 },
    ];
    const dm = assembleDrawingModel(segs, [], baseOpts);

    // 全座標が 0.5 の倍数
    for (const ln of dm.lines) {
      for (const p of [ln.start, ln.end]) {
        expect(Math.abs((p.x / 0.5) - Math.round(p.x / 0.5))).toBeLessThan(1e-9);
        expect(Math.abs((p.y / 0.5) - Math.round(p.y / 0.5))).toBeLessThan(1e-9);
      }
    }

    // 共有すべき角は完全一致する（ドリフトが吸収された）
    const e1 = dm.lines[0].end;
    const s2 = dm.lines[1].start;
    expect(e1).toEqual(s2);
    expect(e1).toEqual({ x: 100, y: 0 });
  });

  it("ヘアライン(0幅)を最小 0.5pt に底上げする", () => {
    const segs: RawSeg[] = [
      { start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, width: 0 },
    ];
    const dm = assembleDrawingModel(segs, [], baseOpts);
    expect(dm.lines[0].thickness).toBe(0.5);
  });

  it("必須フィールドを持つ妥当な DrawingModel を返す", () => {
    const segs: RawSeg[] = [
      { start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, width: 2 },
    ];
    const dm = assembleDrawingModel(segs, [], baseOpts);

    expect(dm.source_pdf).toBe("test.pdf");
    expect(dm.page_index).toBe(0);
    expect(dm.page_size_pt).toEqual({ x: 842, y: 595 });
    expect(dm.scale).toBe("1:50");
    expect(dm.scale_mm_per_pt).toBeCloseTo(17.63889, 4);
    expect(Array.isArray(dm.lines)).toBe(true);
    expect(Array.isArray(dm.rects)).toBe(true);
    expect(Array.isArray(dm.texts)).toBe(true);
    expect(Array.isArray(dm.layers)).toBe(true);
    expect(typeof dm.extracted_at).toBe("string");

    const ln = dm.lines[0];
    expect(ln.length_pt).toBeCloseTo(100, 6);
    expect(ln.length_mm).toBeCloseTo(100 * 17.63889, 2);
    expect(ln.thickness).toBe(2);
    expect(ln.color).toBeNull();
    expect(ln.semantic).toBeNull();
  });

  it("縮尺 null のとき length_mm は null", () => {
    const segs: RawSeg[] = [{ start: { x: 0, y: 0 }, end: { x: 50, y: 0 }, width: 1 }];
    const dm = assembleDrawingModel(segs, [], { ...baseOpts, scale: null, scaleMmPerPt: null });
    expect(dm.scale_mm_per_pt).toBeNull();
    expect(dm.lines[0].length_mm).toBeNull();
  });

  it("円弧セグメントは arc を保持し、length_pt を弧長で計算する", () => {
    const segs: RawSeg[] = [{
      start: { x: 10, y: 0 },
      end: { x: 0, y: 10 },
      width: 1,
      arc: {
        center: { x: 0, y: 0 },
        radius: 10,
        start_angle: 0,
        end_angle: Math.PI / 2,
      },
    }];
    const dm = assembleDrawingModel(segs, [], baseOpts);
    expect(dm.lines[0].arc).toBeDefined();
    expect(dm.lines[0].length_pt).toBeCloseTo((10 * Math.PI) / 2, 6);
  });

  it("スナップ後に退化したセグメントを除外する", () => {
    const segs: RawSeg[] = [
      { start: { x: 0.1, y: 0.1 }, end: { x: 0.2, y: 0.2 }, width: 1 }, // → (0,0)-(0,0)
      { start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, width: 1 },
    ];
    const dm = assembleDrawingModel(segs, [], baseOpts);
    expect(dm.lines.length).toBe(1);
  });
});
