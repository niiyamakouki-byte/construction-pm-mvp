import { describe, expect, it } from "vitest";
import {
  DEFAULT_RENDER_PX_PER_PT,
  scaleMmPerPtToPxPerMm,
  resolveDrawingScale,
} from "./drawing-scale-auto.js";

const PT_TO_MM = 25.4 / 72;

describe("scaleMmPerPtToPxPerMm", () => {
  it("縮尺 1:50 / 標準96dpi の変換が正しい", () => {
    // scaleMmPerPt = 50 * (25.4/72)
    const scaleMmPerPt = 50 * PT_TO_MM;
    const result = scaleMmPerPtToPxPerMm(scaleMmPerPt, DEFAULT_RENDER_PX_PER_PT);
    expect(result).not.toBeNull();
    // px/mm = (96/72) / (50 * 25.4/72) = 96 / (50 * 25.4) = 96/1270 ≈ 0.07559
    const expected = 96 / (50 * 25.4);
    expect(result!).toBeCloseTo(expected, 6);
  });

  it("縮尺 1:100 の変換が正しい", () => {
    const scaleMmPerPt = 100 * PT_TO_MM;
    const result = scaleMmPerPtToPxPerMm(scaleMmPerPt, DEFAULT_RENDER_PX_PER_PT);
    expect(result).not.toBeNull();
    const expected = 96 / (100 * 25.4);
    expect(result!).toBeCloseTo(expected, 6);
  });

  it("縮尺 1:200 の変換が正しい", () => {
    const scaleMmPerPt = 200 * PT_TO_MM;
    const result = scaleMmPerPtToPxPerMm(scaleMmPerPt, DEFAULT_RENDER_PX_PER_PT);
    expect(result).not.toBeNull();
    const expected = 96 / (200 * 25.4);
    expect(result!).toBeCloseTo(expected, 6);
  });

  it("renderPxPerPt カスタム値（2.0）を反映する", () => {
    const scaleMmPerPt = 50 * PT_TO_MM;
    const result = scaleMmPerPtToPxPerMm(scaleMmPerPt, 2.0);
    expect(result).not.toBeNull();
    const expected = 2.0 / (50 * PT_TO_MM);
    expect(result!).toBeCloseTo(expected, 6);
  });

  it("scaleMmPerPt が 0 以下のとき null を返す", () => {
    expect(scaleMmPerPtToPxPerMm(0)).toBeNull();
    expect(scaleMmPerPtToPxPerMm(-1)).toBeNull();
  });

  it("scaleMmPerPt が Infinity / NaN のとき null を返す", () => {
    expect(scaleMmPerPtToPxPerMm(Infinity)).toBeNull();
    expect(scaleMmPerPtToPxPerMm(NaN)).toBeNull();
  });

  it("renderPxPerPt が 0 以下のとき null を返す", () => {
    expect(scaleMmPerPtToPxPerMm(50 * PT_TO_MM, 0)).toBeNull();
    expect(scaleMmPerPtToPxPerMm(50 * PT_TO_MM, -1)).toBeNull();
  });

  it("renderPxPerPt 省略時は DEFAULT_RENDER_PX_PER_PT (96/72) を使う", () => {
    const scaleMmPerPt = 50 * PT_TO_MM;
    expect(scaleMmPerPtToPxPerMm(scaleMmPerPt)).toBeCloseTo(
      scaleMmPerPtToPxPerMm(scaleMmPerPt, DEFAULT_RENDER_PX_PER_PT)!,
      10,
    );
  });
});

describe("resolveDrawingScale", () => {
  const scaleMmPerPt = 50 * PT_TO_MM;

  it("手動保存値が最優先 — 自動検出があっても上書きしない", () => {
    const result = resolveDrawingScale(0.1, scaleMmPerPt, "1:50");
    expect(result.scale).toBeCloseTo(0.1);
    expect(result.isAutoDetected).toBe(false);
    expect(result.detectedScaleLabel).toBeNull();
  });

  it("手動保存値なし + 自動検出あり → 自動検出値を返す", () => {
    const result = resolveDrawingScale(null, scaleMmPerPt, "1:50");
    expect(result.scale).not.toBeNull();
    expect(result.isAutoDetected).toBe(true);
    expect(result.detectedScaleLabel).toBe("1:50");
  });

  it("自動検出値から算出した px/mm が正しい", () => {
    const result = resolveDrawingScale(null, scaleMmPerPt, "1:50");
    const expected = scaleMmPerPtToPxPerMm(scaleMmPerPt, DEFAULT_RENDER_PX_PER_PT)!;
    expect(result.scale!).toBeCloseTo(expected, 10);
  });

  it("手動保存値なし + 自動検出なし → null", () => {
    const result = resolveDrawingScale(null, null, null);
    expect(result.scale).toBeNull();
    expect(result.isAutoDetected).toBe(false);
    expect(result.detectedScaleLabel).toBeNull();
  });

  it("手動保存値が 0 以下（無効値）は無視して自動検出にフォールバック", () => {
    // loadScale は 0 以下を null で返すが、念のため saveScale が誤って 0 を保存したケースも考慮
    const result = resolveDrawingScale(0, scaleMmPerPt, "1:50");
    // 0 は無効値なので自動検出にフォールバック
    expect(result.isAutoDetected).toBe(true);
    expect(result.scale).not.toBeNull();
  });

  it("カスタム renderPxPerPt を受け入れる", () => {
    const renderPxPerPt = 2.0;
    const result = resolveDrawingScale(null, scaleMmPerPt, "1:50", renderPxPerPt);
    const expected = scaleMmPerPtToPxPerMm(scaleMmPerPt, renderPxPerPt)!;
    expect(result.scale!).toBeCloseTo(expected, 10);
  });

  it("detectedMmPerPt が不正値のとき null を返す", () => {
    const result = resolveDrawingScale(null, 0, null);
    expect(result.scale).toBeNull();
    expect(result.isAutoDetected).toBe(false);
  });
});
