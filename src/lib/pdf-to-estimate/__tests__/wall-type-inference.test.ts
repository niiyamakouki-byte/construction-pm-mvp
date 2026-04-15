import { describe, it, expect } from "vitest";
import { inferWallType } from "../wall-type-inference.js";

describe("inferWallType", () => {
  // ─── テキスト抽出（Stage 1） ────────────────────────────────────

  it("「LGS65」テキストから LGS65 を高 confidence で抽出する", () => {
    const result = inferWallType({ nearbyTexts: ["LGS65 間仕切り"] });
    expect(result.type).toBe("LGS65");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("「C-75」テキストから LGS75 を抽出する", () => {
    const result = inferWallType({ nearbyTexts: ["C-75 スタッド"] });
    expect(result.type).toBe("LGS75");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("「45型」テキストから LGS45 を抽出する", () => {
    const result = inferWallType({ nearbyTexts: ["スタッド 45型"] });
    expect(result.type).toBe("LGS45");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("「LGS 100」（スペース区切り）から LGS100 を抽出する", () => {
    const result = inferWallType({ nearbyTexts: ["LGS 100 遮音壁"] });
    expect(result.type).toBe("LGS100");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  // ─── 壁厚推定（Stage 2） ────────────────────────────────────────

  it("壁厚 80mm → LGS45（範囲 75〜95）を推定する", () => {
    const result = inferWallType({ measuredThicknessMm: 80 });
    expect(result.type).toBe("LGS45");
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("壁厚 100mm → LGS65（範囲 95〜115）を推定する", () => {
    const result = inferWallType({ measuredThicknessMm: 100 });
    expect(result.type).toBe("LGS65");
  });

  it("壁厚 135mm → LGS90/LGS100 いずれか（両方の範囲内）を推定する", () => {
    // LGS90: 120-140, LGS100: 130-150 → 135mm は両方マッチ
    // priority 同じ(1)→ ソート安定性に依存するため型は問わず range 内であることを確認
    const result = inferWallType({ measuredThicknessMm: 135 });
    expect(["LGS90", "LGS100"]).toContain(result.type);
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  // ─── Fallback（Stage 3） ────────────────────────────────────────

  it("ヒントなしの場合 LGS65 にフォールバックする", () => {
    const result = inferWallType({});
    expect(result.type).toBe("LGS65");
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("defaultType を指定した場合そちらにフォールバックする", () => {
    const result = inferWallType({ defaultType: "LGS45" });
    expect(result.type).toBe("LGS45");
  });

  // ─── テキスト優先（Stage 1 > Stage 2） ─────────────────────────

  it("テキストと壁厚が矛盾する場合テキストを優先する", () => {
    // テキストは LGS90、壁厚は LGS65 範囲
    const result = inferWallType({
      nearbyTexts: ["LGS90 遮音壁"],
      measuredThicknessMm: 100,
    });
    expect(result.type).toBe("LGS90");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  // ─── priority 比較 ──────────────────────────────────────────────

  it("壁厚 95mm（LGS45 上端 = LGS65 下端）は priority 10 同士 → LGS65 を優先", () => {
    // LGS45: 75-95, LGS65: 95-115 → 両方マッチ。同 priority なら LGS65 優先
    const result = inferWallType({ measuredThicknessMm: 95 });
    expect(result.type).toBe("LGS65");
  });
});
