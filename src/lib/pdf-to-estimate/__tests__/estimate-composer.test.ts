import { describe, it, expect } from "vitest";
import { composeEstimate, DEFAULT_ASSEMBLY } from "../estimate-composer.js";
import type { QuantityTakeoff, CostMasterItem, DrawingModel, TakeoffItem } from "../types.js";

// ─── fixtures ─────────────────────────────────────────────────────

function makeTakeoffItem(overrides: Partial<TakeoffItem> = {}): TakeoffItem {
  return {
    category: "壁",
    item: "壁仕上げ面積",
    quantity: 30,
    unit: "m2",
    source: "pdf",
    confidence: 0.8,
    ...overrides,
  };
}

function makeTakeoff(items: TakeoffItem[]): QuantityTakeoff {
  return { items, ceilingHeightMm: 2400 };
}

function makeDrawing(): DrawingModel {
  return {
    source_pdf: "/path/to/test.pdf",
    page_index: 0,
    page_size_pt: { x: 842, y: 595 },
    scale: "1:50",
    scale_mm_per_pt: 0.3528,
    lines: [],
    rects: [],
    texts: [],
    layers: [],
    extracted_at: "2026-04-15T00:00:00Z",
  };
}

// cost-master のサブセット（テスト用）
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

// ─── Tests ────────────────────────────────────────────────────────

describe("composeEstimate", () => {
  it("壁面積から LGS65両面張り・クロスの2行が生成される（個別品目）", () => {
    const takeoff = makeTakeoff([makeTakeoffItem({ category: "壁", item: "壁仕上げ面積", quantity: 30 })]);
    const draft = composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing());
    const codes = draft.lines.map((l) => l.code);
    expect(codes).toContain("IN-045"); // LGS65 ボード両面張り（個別品目）
    expect(codes).toContain("IN-005"); // クロス
  });

  it("金額合計が各行の amount の合計と一致する", () => {
    const takeoff = makeTakeoff([
      makeTakeoffItem({ category: "壁", item: "壁仕上げ面積", quantity: 20 }),
      makeTakeoffItem({ category: "床", item: "床仕上げ面積", quantity: 15 }),
    ]);
    const draft = composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing());
    const expected = draft.lines.reduce((s, l) => s + l.amount, 0);
    expect(draft.totalExcludingTax).toBe(expected);
  });

  it("建具（ドア）1個の金額が FX-001 単価と一致する", () => {
    const takeoff = makeTakeoff([
      makeTakeoffItem({ category: "建具", item: "木製建具（ドア）", quantity: 1, unit: "個" }),
    ]);
    const draft = composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing());
    const door = draft.lines.find((l) => l.code === "FX-001");
    expect(door).toBeDefined();
    expect(door?.amount).toBe(65000);
  });

  it("cost-master に未登録のコードは notes に警告が追記される", () => {
    const customAssembly = {
      ...DEFAULT_ASSEMBLY,
      wall: [{ costMasterCode: "XX-999", quantityFactor: 1.0 }],
    };
    const takeoff = makeTakeoff([makeTakeoffItem({ category: "壁", item: "壁仕上げ面積", quantity: 10 })]);
    const draft = composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing(), { assemblyTemplate: customAssembly });
    expect(draft.notes.some((n) => n.includes("XX-999"))).toBe(true);
  });

  it("takeoff.items が空のとき lines が空で notes に警告が入る", () => {
    const draft = composeEstimate(makeTakeoff([]), TEST_COST_MASTER, makeDrawing());
    expect(draft.lines).toHaveLength(0);
    expect(draft.notes.length).toBeGreaterThan(0);
    expect(draft.totalExcludingTax).toBe(0);
  });

  it("sourcePdfPath が drawingModel の source_pdf と一致する", () => {
    const drawing = makeDrawing();
    const takeoff = makeTakeoff([makeTakeoffItem()]);
    const draft = composeEstimate(takeoff, TEST_COST_MASTER, drawing);
    expect(draft.sourcePdfPath).toBe(drawing.source_pdf);
  });

  it("confidence が 0〜1 の範囲に収まる", () => {
    const takeoff = makeTakeoff([
      makeTakeoffItem({ category: "壁", item: "壁仕上げ面積", quantity: 20, confidence: 0.9 }),
      makeTakeoffItem({ category: "床", item: "床仕上げ面積", quantity: 15, confidence: 0.7 }),
    ]);
    const draft = composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing());
    expect(draft.confidence).toBeGreaterThanOrEqual(0);
    expect(draft.confidence).toBeLessThanOrEqual(1);
    for (const line of draft.lines) {
      expect(line.confidence).toBeGreaterThanOrEqual(0);
      expect(line.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("廻り縁が IN-024 として追加される", () => {
    const takeoff = makeTakeoff([
      makeTakeoffItem({ category: "造作", item: "廻り縁", quantity: 10, unit: "m" }),
    ]);
    const draft = composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing());
    const crown = draft.lines.find((l) => l.code === "IN-024");
    expect(crown).toBeDefined();
    expect(crown?.amount).toBe(10 * 1200);
  });

  it("クロスに quantityFactor 1.05 のロスが反映される", () => {
    const takeoff = makeTakeoff([
      makeTakeoffItem({ category: "壁", item: "壁仕上げ面積", quantity: 10 }),
    ]);
    const draft = composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing());
    const cloth = draft.lines.find((l) => l.code === "IN-005");
    expect(cloth).toBeDefined();
    // 10㎡ × 1.05 = 10.5㎡
    expect(cloth?.quantity).toBeCloseTo(10.5, 2);
  });
});

// ─── 壁タイプ拡張テスト ───────────────────────────────────────────

const EXTENDED_COST_MASTER: CostMasterItem[] = [
  ...TEST_COST_MASTER,
  { code: "IN-004", name: "石膏ボード張り（二重張り）", unit: "㎡", unitPrice: 4200 },
];

describe("composeEstimate — wallType options", () => {
  it("wallTypeOverride: LGS45 は IN-001 × 0.85 で、LGS65 は IN-045 個別品目で計算される", () => {
    const takeoff = makeTakeoff([
      makeTakeoffItem({ category: "壁", item: "壁仕上げ面積", quantity: 20 }),
    ]);
    const draftLGS65 = composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing(), {
      wallTypeOverride: "LGS65",
    });
    const draftLGS45 = composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing(), {
      wallTypeOverride: "LGS45",
    });
    // LGS65 は IN-045(¥4,800) 個別品目を使用
    const lgs65Line = draftLGS65.lines.find((l) => l.code === "IN-045");
    expect(lgs65Line).toBeDefined();
    // LGS45 は IN-001(¥5,500×0.85=¥4,675) 係数ベースを使用
    const lgs45Line = draftLGS45.lines.find((l) => l.code === "IN-001");
    expect(lgs45Line).toBeDefined();
  });

  it("wallTypeOverride: LGS100 は notes に壁タイプ情報が含まれる", () => {
    const takeoff = makeTakeoff([
      makeTakeoffItem({ category: "壁", item: "壁仕上げ面積", quantity: 10 }),
    ]);
    const draft = composeEstimate(takeoff, EXTENDED_COST_MASTER, makeDrawing(), {
      wallTypeOverride: "LGS100",
    });
    expect(draft.notes.some((n) => n.includes("LGS100"))).toBe(true);
  });

  it("wallTypeInferenceHints: テキスト「LGS45」で LGS45 アセンブリが採用される", () => {
    const takeoff = makeTakeoff([
      makeTakeoffItem({ category: "壁", item: "壁仕上げ面積", quantity: 20 }),
    ]);
    const draftInferred = composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing(), {
      wallTypeInferenceHints: { texts: ["スタッド LGS45"] },
    });
    // LGS45 は IN-001 係数ベースアセンブリが採用される
    const lgs45Line = draftInferred.lines.find((l) => l.code === "IN-001");
    expect(lgs45Line).toBeDefined();
    // notes に推定情報が含まれる
    expect(draftInferred.notes.some((n) => n.includes("LGS45"))).toBe(true);
  });

  it("wallTypeOverride は assemblyTemplate より優先される", () => {
    const customAssembly = {
      ...DEFAULT_ASSEMBLY,
      wall: [{ costMasterCode: "IN-001", quantityFactor: 9.99 }], // 意図的に高い係数
    };
    const takeoff = makeTakeoff([
      makeTakeoffItem({ category: "壁", item: "壁仕上げ面積", quantity: 10 }),
    ]);
    const draft = composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing(), {
      assemblyTemplate: customAssembly,
      wallTypeOverride: "LGS65",
    });
    // wallTypeOverride が優先 → LGS65 個別品目 IN-045(quantityFactor 1.0) で計算
    const lgsLine = draft.lines.find((l) => l.code === "IN-045");
    expect(lgsLine?.quantity).toBeCloseTo(10, 1);
  });
});

// ─── 壁タイプ個別品目テスト（IN-045/046/047） ─────────────────────

describe("composeEstimate — 壁タイプ個別単価行", () => {
  it("LGS65 は IN-045（¥4,800/㎡）の個別品目行が生成される", () => {
    const takeoff = makeTakeoff([
      makeTakeoffItem({ category: "壁", item: "壁仕上げ面積", quantity: 10 }),
    ]);
    const draft = composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing(), {
      wallTypeOverride: "LGS65",
    });
    const line = draft.lines.find((l) => l.code === "IN-045");
    expect(line).toBeDefined();
    expect(line?.unitPrice).toBe(4800);
    expect(line?.quantity).toBeCloseTo(10, 2);
    expect(line?.amount).toBe(48000);
  });

  it("LGS75 は IN-046（¥5,200/㎡）の個別品目行が生成される", () => {
    const takeoff = makeTakeoff([
      makeTakeoffItem({ category: "壁", item: "壁仕上げ面積", quantity: 10 }),
    ]);
    const draft = composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing(), {
      wallTypeOverride: "LGS75",
    });
    const line = draft.lines.find((l) => l.code === "IN-046");
    expect(line).toBeDefined();
    expect(line?.unitPrice).toBe(5200);
    expect(line?.quantity).toBeCloseTo(10, 2);
    expect(line?.amount).toBe(52000);
  });

  it("木下地 は IN-047（¥4,500/㎡）の個別品目行が生成される", () => {
    const takeoff = makeTakeoff([
      makeTakeoffItem({ category: "壁", item: "壁仕上げ面積", quantity: 10 }),
    ]);
    const draft = composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing(), {
      wallTypeOverride: "木下地",
    });
    const line = draft.lines.find((l) => l.code === "IN-047");
    expect(line).toBeDefined();
    expect(line?.unitPrice).toBe(4500);
    expect(line?.quantity).toBeCloseTo(10, 2);
    expect(line?.amount).toBe(45000);
  });

  it("LGS65/LGS75/木下地 はそれぞれ異なる品目コードの行を生成する", () => {
    const takeoff = makeTakeoff([
      makeTakeoffItem({ category: "壁", item: "壁仕上げ面積", quantity: 20 }),
    ]);
    const drafts = (["LGS65", "LGS75", "木下地"] as const).map((wt) =>
      composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing(), { wallTypeOverride: wt }),
    );
    const [dLGS65, dLGS75, d木下地] = drafts;
    expect(dLGS65.lines.find((l) => l.code === "IN-045")).toBeDefined();
    expect(dLGS75.lines.find((l) => l.code === "IN-046")).toBeDefined();
    expect(d木下地.lines.find((l) => l.code === "IN-047")).toBeDefined();
    // 係数依存の IN-001 は使われていない
    expect(dLGS65.lines.find((l) => l.code === "IN-001")).toBeUndefined();
    expect(dLGS75.lines.find((l) => l.code === "IN-001")).toBeUndefined();
    expect(d木下地.lines.find((l) => l.code === "IN-001")).toBeUndefined();
  });

  it("wallTypeInferenceHints: テキスト「木下地」で 木下地 アセンブリが採用される", () => {
    const takeoff = makeTakeoff([
      makeTakeoffItem({ category: "壁", item: "壁仕上げ面積", quantity: 15 }),
    ]);
    const draft = composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing(), {
      wallTypeInferenceHints: { texts: ["木下地 間柱@303"] },
    });
    const line = draft.lines.find((l) => l.code === "IN-047");
    expect(line).toBeDefined();
    expect(draft.notes.some((n) => n.includes("木下地"))).toBe(true);
  });

  it("LGS90 は IN-048（¥5,800/㎡）の個別品目行が生成される", () => {
    const takeoff = makeTakeoff([
      makeTakeoffItem({ category: "壁", item: "壁仕上げ面積", quantity: 10 }),
    ]);
    const draft = composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing(), {
      wallTypeOverride: "LGS90",
    });
    const line = draft.lines.find((l) => l.code === "IN-048");
    expect(line).toBeDefined();
    expect(line?.unitPrice).toBe(5800);
    expect(line?.quantity).toBeCloseTo(10, 2);
    expect(line?.amount).toBe(58000);
    // 係数依存の IN-001 は使われていない
    expect(draft.lines.find((l) => l.code === "IN-001")).toBeUndefined();
  });

  it("LGS100 は IN-049（¥6,500/㎡）の個別品目行が生成される", () => {
    const takeoff = makeTakeoff([
      makeTakeoffItem({ category: "壁", item: "壁仕上げ面積", quantity: 10 }),
    ]);
    const draft = composeEstimate(takeoff, TEST_COST_MASTER, makeDrawing(), {
      wallTypeOverride: "LGS100",
    });
    const line = draft.lines.find((l) => l.code === "IN-049");
    expect(line).toBeDefined();
    expect(line?.unitPrice).toBe(6500);
    expect(line?.quantity).toBeCloseTo(10, 2);
    expect(line?.amount).toBe(65000);
    // 係数依存の IN-001 は使われていない
    expect(draft.lines.find((l) => l.code === "IN-001")).toBeUndefined();
  });
});
