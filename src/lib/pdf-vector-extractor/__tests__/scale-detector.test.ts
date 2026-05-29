import { describe, it, expect } from "vitest";
import { detectScale } from "../scale-detector.js";
import type { TextItem } from "../../pdf-to-estimate/types.js";

function text(s: string): TextItem {
  return {
    text: s,
    position: { x: 0, y: 0 },
    font_size: 10,
    is_dimension_value: false,
    parsed_mm: null,
  };
}

const PT_TO_MM = 25.4 / 72;

describe("detectScale", () => {
  it("明示指定を最優先で返す", () => {
    const r = detectScale([text("1/50")], 0.123);
    expect(r.scaleMmPerPt).toBe(0.123);
  });

  it('"1/50" を ratio*25.4/72 として解釈する', () => {
    const r = detectScale([text("縮尺 1/50"), text("ROOM-A")]);
    expect(r.scale).toBe("1:50");
    // ratio=50 → 50 * (25.4/72) ≈ 17.6389
    expect(r.scaleMmPerPt).toBeCloseTo(50 * PT_TO_MM, 6);
    expect(r.scaleMmPerPt).toBeCloseTo(17.63889, 4);
  });

  it('"1:100" も解釈できる', () => {
    const r = detectScale([text("S=1:100")]);
    expect(r.scale).toBe("1:100");
    expect(r.scaleMmPerPt).toBeCloseTo(100 * PT_TO_MM, 6);
  });

  it("縮尺テキストが無ければ null", () => {
    const r = detectScale([text("ROOM-A"), text("3640")]);
    expect(r.scale).toBeNull();
    expect(r.scaleMmPerPt).toBeNull();
  });
});
