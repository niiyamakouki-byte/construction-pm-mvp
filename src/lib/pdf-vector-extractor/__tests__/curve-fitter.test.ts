import { describe, it, expect } from "vitest";
import { jsPDF } from "jspdf";
import { flattenBezier } from "../curve-fitter.js";
import { loadPage } from "../pdf-loader.js";
import { extractRawSegments } from "../path-extractor.js";
import type { Point } from "../../pdf-to-estimate/types.js";

// 半径 R の 1/4 円を近似する 3 次ベジエ。
// 中心(0,0)、(R,0)→(0,R)。制御点係数 k = 4/3*(√2−1) ≈ 0.5523。
const R = 100;
const K = (4 / 3) * (Math.SQRT2 - 1);
const P0: Point = { x: R, y: 0 };
const C1: Point = { x: R, y: R * K };
const C2: Point = { x: R * K, y: R };
const P3: Point = { x: 0, y: R };

describe("flattenBezier", () => {
  it("弦本数が 4〜12 の範囲に収まる", () => {
    const chords = flattenBezier(P0, C1, C2, P3);
    expect(chords.length).toBeGreaterThanOrEqual(4);
    expect(chords.length).toBeLessThanOrEqual(12);
  });

  it("弦が連続し、始点・終点がベジエ端点に一致する", () => {
    const chords = flattenBezier(P0, C1, C2, P3);
    // 連続性: 各弦の終点が次の弦の始点
    for (let i = 1; i < chords.length; i++) {
      expect(chords[i].start.x).toBeCloseTo(chords[i - 1].end.x, 6);
      expect(chords[i].start.y).toBeCloseTo(chords[i - 1].end.y, 6);
    }
    expect(chords[0].start.x).toBeCloseTo(P0.x, 6);
    expect(chords[0].start.y).toBeCloseTo(P0.y, 6);
    const last = chords[chords.length - 1].end;
    expect(last.x).toBeCloseTo(P3.x, 6);
    expect(last.y).toBeCloseTo(P3.y, 6);
  });

  it("各弦の中点が真円（半径R）の近傍にある", () => {
    const chords = flattenBezier(P0, C1, C2, P3);
    // 弦上の中点は円の内側にわずかに入るが誤差は小さいはず（< 2pt）
    for (const ch of chords) {
      const mx = (ch.start.x + ch.end.x) / 2;
      const my = (ch.start.y + ch.end.y) / 2;
      const r = Math.hypot(mx, my);
      expect(Math.abs(r - R)).toBeLessThan(2);
    }
  });

  it("実 PDF の 1/4 円 curveTo は 1 本の円弧セグメントに復元される", async () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    // jspdf の lines() でベジエを描く: [c1, c2, end] の相対座標配列
    doc.setLineWidth(1);
    doc.lines(
      [[C1.x - P0.x, C1.y - P0.y, C2.x - P0.x, C2.y - P0.y, P3.x - P0.x, P3.y - P0.y]],
      P0.x,
      P0.y,
      [1, 1],
    );
    const pdf = doc.output("arraybuffer");
    const page = await loadPage(pdf, 0);
    const segs = await extractRawSegments(page);
    // ベジエが真円弧（ドア開閉弧と同形）の場合、fitArcFromBezier が 1 本の PdfArc に復元する。
    expect(segs.length).toBe(1);
    const arc = segs[0].arc;
    expect(arc).toBeDefined();
    expect(arc!.radius).toBeGreaterThan(R * 0.9);
    expect(arc!.radius).toBeLessThan(R * 1.1);
    const sweep = Math.abs(arc!.end_angle - arc!.start_angle);
    expect(sweep).toBeGreaterThan(Math.PI / 2 * 0.85);
    expect(sweep).toBeLessThan(Math.PI / 2 * 1.15);
  });
});
