import { describe, it, expect } from "vitest";
import {
  simplifyStroke,
  classifyStroke,
  type PenSample,
} from "./pen-stroke.js";

function mkSample(x: number, y: number, t = 0, pressure = 0.5): PenSample {
  return { x, y, pressure, t };
}

describe("simplifyStroke", () => {
  it("returns empty for empty input", () => {
    expect(simplifyStroke([], 1)).toEqual([]);
  });

  it("returns single point unchanged", () => {
    expect(simplifyStroke([mkSample(3, 4)], 1)).toEqual([{ x: 3, y: 4 }]);
  });

  it("keeps both endpoints for a 2-point stroke", () => {
    const out = simplifyStroke([mkSample(0, 0), mkSample(10, 0)], 1);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[1]).toEqual({ x: 10, y: 0 });
  });

  it("collapses near-collinear noisy samples to endpoints", () => {
    // Almost-straight line with tiny noise — all noise within epsilon
    const samples: PenSample[] = [
      mkSample(0, 0),
      mkSample(2, 0.3),
      mkSample(4, -0.2),
      mkSample(6, 0.1),
      mkSample(8, -0.4),
      mkSample(10, 0),
    ];
    const out = simplifyStroke(samples, 1);
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[out.length - 1]).toEqual({ x: 10, y: 0 });
    expect(out.length).toBeLessThan(samples.length);
  });

  it("keeps corner points for an L-shape", () => {
    const samples: PenSample[] = [
      mkSample(0, 0),
      mkSample(5, 0),
      mkSample(10, 0), // corner
      mkSample(10, 5),
      mkSample(10, 10),
    ];
    const out = simplifyStroke(samples, 1);
    // Should retain (0,0), the corner around (10,0), and (10,10)
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[out.length - 1]).toEqual({ x: 10, y: 10 });
    const hasCorner = out.some((p) => p.x === 10 && p.y === 0);
    expect(hasCorner).toBe(true);
  });
});

describe("classifyStroke", () => {
  it("treats empty or single point as polyline", () => {
    expect(classifyStroke([])).toEqual({ kind: "polyline", points: [] });
    expect(classifyStroke([{ x: 1, y: 2 }])).toEqual({
      kind: "polyline",
      points: [{ x: 1, y: 2 }],
    });
  });

  it("classifies a 2-point stroke as line", () => {
    const result = classifyStroke([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    expect(result.kind).toBe("line");
    expect(result.points).toHaveLength(2);
  });

  it("classifies near-collinear points as line and reduces to endpoints", () => {
    const result = classifyStroke(
      [
        { x: 0, y: 0 },
        { x: 50, y: 1 },
        { x: 100, y: -1 },
        { x: 150, y: 0 },
      ],
      { straightnessEpsilonPx: 3 },
    );
    expect(result.kind).toBe("line");
    expect(result.points).toEqual([
      { x: 0, y: 0 },
      { x: 150, y: 0 },
    ]);
  });

  it("classifies an open コ-shape (U) as polyline", () => {
    const result = classifyStroke([
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
    ]);
    expect(result.kind).toBe("polyline");
    expect(result.points).toHaveLength(4);
  });

  it("classifies a closed 口-shape as polygon (snaps end to start)", () => {
    const result = classifyStroke([
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: 5, y: 3 }, // 終点が始点付近
    ]);
    expect(result.kind).toBe("polygon");
    // 終点が落とされ4頂点になる
    expect(result.points).toHaveLength(4);
    expect(result.points[0]).toEqual({ x: 0, y: 0 });
  });

  it("respects closeThresholdPx option", () => {
    // 始点と終点の距離 ≈ 30px → デフォルト24では非閉路
    const pts = [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: 20, y: 22 },
    ];
    const open = classifyStroke(pts);
    expect(open.kind).toBe("polyline");
    // しきい値を40に上げると閉路扱いになる
    const closed = classifyStroke(pts, { closeThresholdPx: 40 });
    expect(closed.kind).toBe("polygon");
  });
});
