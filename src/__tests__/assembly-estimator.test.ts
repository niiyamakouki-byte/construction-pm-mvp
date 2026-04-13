import { describe, it, expect } from "vitest";
import {
  getBuiltInAssemblies,
  createCustomAssembly,
  calculateAssembly,
  estimateFromAssemblies,
  findAssembliesByCategory,
  getAssemblyUnitCost,
  compareAssemblies,
  buildAssemblyEstimateHtml,
  exportAssemblyCSV,
} from "../lib/assembly-estimator";
import type {
  AssemblyComponent,
  Assembly,
} from "../lib/assembly-estimator";

// ─── Built-in assemblies ────────────────────────────────────────

describe("getBuiltInAssemblies", () => {
  it("returns assemblies with correct IDs", () => {
    const assemblies = getBuiltInAssemblies();
    const ids = assemblies.map((a) => a.id);
    expect(ids).toContain("lgs-wall-65");
    expect(ids).toContain("lgs-wall-75");
    expect(ids).toContain("lgs-wall-90");
    expect(ids).toContain("lgs-ceiling");
    expect(ids).toContain("floor-oa-carpet");
    expect(ids).toContain("floor-flooring-direct");
    expect(ids).toContain("wall-paint");
    expect(ids).toContain("toilet-booth");
  });

  it("each assembly has required fields", () => {
    for (const a of getBuiltInAssemblies()) {
      expect(a.id).toBeTruthy();
      expect(a.name).toBeTruthy();
      expect(a.category).toBeTruthy();
      expect(a.unit).toBeTruthy();
      expect(Array.isArray(a.components)).toBe(true);
      expect(a.components.length).toBeGreaterThan(0);
    }
  });

  it("LGS間仕切り壁65型 has the expected component types", () => {
    const wall = getBuiltInAssemblies().find((a) => a.id === "lgs-wall-65")!;
    const names = wall.components.map((c) => c.name);
    expect(names.some((n) => n.includes("スタッド"))).toBe(true);
    expect(names.some((n) => n.includes("ランナー"))).toBe(true);
    expect(names.some((n) => n.includes("石膏ボード"))).toBe(true);
    expect(names.some((n) => n.includes("ビス"))).toBe(true);
    expect(names.some((n) => n.includes("グラスウール"))).toBe(true);
    expect(names.some((n) => n.includes("クロス"))).toBe(true);
  });

  it("LGS天井 has Cチャン / シングルバー / ハンガー / クリップ / 全ネジ", () => {
    const ceiling = getBuiltInAssemblies().find((a) => a.id === "lgs-ceiling")!;
    const names = ceiling.components.map((c) => c.name);
    expect(names.some((n) => n.includes("Cチャンネル"))).toBe(true);
    expect(names.some((n) => n.includes("シングルバー"))).toBe(true);
    expect(names.some((n) => n.includes("ハンガー"))).toBe(true);
    expect(names.some((n) => n.includes("クリップ"))).toBe(true);
    expect(names.some((n) => n.includes("全ネジ"))).toBe(true);
  });

  it("OAフロア+タイルカーペット has OAフロアパネル / 支柱 / タイルカーペット", () => {
    const floor = getBuiltInAssemblies().find((a) => a.id === "floor-oa-carpet")!;
    const names = floor.components.map((c) => c.name);
    expect(names.some((n) => n.includes("OAフロアパネル"))).toBe(true);
    expect(names.some((n) => n.includes("支柱"))).toBe(true);
    expect(names.some((n) => n.includes("タイルカーペット"))).toBe(true);
  });

  it("フローリング直貼り has フローリング / 接着剤 / 巾木", () => {
    const floor = getBuiltInAssemblies().find((a) => a.id === "floor-flooring-direct")!;
    const names = floor.components.map((c) => c.name);
    expect(names.some((n) => n.includes("フローリング"))).toBe(true);
    expect(names.some((n) => n.includes("接着剤"))).toBe(true);
    expect(names.some((n) => n.includes("巾木"))).toBe(true);
  });

  it("塗装仕上げ壁 has 下地処理 / パテ / シーラー / EP塗料", () => {
    const paint = getBuiltInAssemblies().find((a) => a.id === "wall-paint")!;
    const names = paint.components.map((c) => c.name);
    expect(names.some((n) => n.includes("下地処理"))).toBe(true);
    expect(names.some((n) => n.includes("パテ"))).toBe(true);
    expect(names.some((n) => n.includes("シーラー"))).toBe(true);
    expect(names.some((n) => n.includes("EP塗料"))).toBe(true);
  });

  it("トイレブース has パネル / 金物 / ドア / 鍵", () => {
    const booth = getBuiltInAssemblies().find((a) => a.id === "toilet-booth")!;
    const names = booth.components.map((c) => c.name);
    expect(names.some((n) => n.includes("パネル"))).toBe(true);
    expect(names.some((n) => n.includes("金物"))).toBe(true);
    expect(names.some((n) => n.includes("ドア"))).toBe(true);
    expect(names.some((n) => n.includes("鍵"))).toBe(true);
  });
});

// ─── Custom assembly ────────────────────────────────────────────

describe("createCustomAssembly", () => {
  it("creates assembly with provided fields", () => {
    const components: AssemblyComponent[] = [
      { name: "タイル", unit: "枚", quantityPer: 10, unitPrice: 500 },
    ];
    const a = createCustomAssembly("タイル壁", "壁仕上げ", "㎡", components, "テスト用");
    expect(a.name).toBe("タイル壁");
    expect(a.category).toBe("壁仕上げ");
    expect(a.unit).toBe("㎡");
    expect(a.description).toBe("テスト用");
    expect(a.components).toHaveLength(1);
  });

  it("generates a unique id for each call", () => {
    const comp: AssemblyComponent[] = [{ name: "X", unit: "個", quantityPer: 1, unitPrice: 100 }];
    const a1 = createCustomAssembly("A", "cat", "個", comp);
    const a2 = createCustomAssembly("A", "cat", "個", comp);
    expect(a1.id).not.toBe(a2.id);
  });

  it("id starts with 'custom-'", () => {
    const comp: AssemblyComponent[] = [{ name: "X", unit: "個", quantityPer: 1, unitPrice: 100 }];
    const a = createCustomAssembly("テスト", "cat", "個", comp);
    expect(a.id.startsWith("custom-")).toBe(true);
  });
});

// ─── Quantity and cost calculation ─────────────────────────────

describe("calculateAssembly", () => {
  it("LGS壁 100㎡ → component quantities are proportional", () => {
    const wall = getBuiltInAssemblies().find((a) => a.id === "lgs-wall-65")!;
    const result = calculateAssembly(wall, 100);

    // スタッド: quantityPer=1.05, wasteFactor=undefined → 1.05*100 = 105
    const stud = result.componentBreakdown.find((b) => b.name.includes("スタッド"));
    expect(stud).toBeDefined();
    expect(stud!.quantity).toBe(105);

    // ランナー: quantityPer=0.7 → 0.7*100 = 70
    const runner = result.componentBreakdown.find((b) => b.name.includes("ランナー"));
    expect(runner).toBeDefined();
    expect(runner!.quantity).toBe(70);

    // PB: quantityPer=0.55, wasteFactor=1.05 → 0.55*1.05*100 = 57.75
    const pb = result.componentBreakdown.find((b) => b.name.includes("石膏ボード"));
    expect(pb).toBeDefined();
    expect(pb!.quantity).toBe(57.75);
  });

  it("calculates component amounts correctly", () => {
    const assembly: Assembly = {
      id: "test",
      name: "テストアセンブリ",
      category: "test",
      unit: "㎡",
      components: [
        { name: "材料A", unit: "個", quantityPer: 2, unitPrice: 1000 },
        { name: "材料B", unit: "㎡", quantityPer: 1, unitPrice: 500, wasteFactor: 1.1 },
      ],
    };

    const result = calculateAssembly(assembly, 10);

    const compA = result.componentBreakdown[0];
    expect(compA.quantity).toBe(20);
    expect(compA.amount).toBe(20000);

    const compB = result.componentBreakdown[1];
    expect(compB.quantity).toBe(11);
    expect(compB.amount).toBe(5500);

    expect(result.totalAmount).toBe(25500);
  });

  it("totalAmount equals sum of all component amounts", () => {
    const wall = getBuiltInAssemblies().find((a) => a.id === "lgs-ceiling")!;
    const result = calculateAssembly(wall, 50);
    const sum = result.componentBreakdown.reduce((s, b) => s + b.amount, 0);
    expect(result.totalAmount).toBe(sum);
  });

  it("returns assembly and quantity on the result", () => {
    const wall = getBuiltInAssemblies().find((a) => a.id === "lgs-wall-65")!;
    const result = calculateAssembly(wall, 30);
    expect(result.assembly.id).toBe("lgs-wall-65");
    expect(result.quantity).toBe(30);
  });
});

// ─── Multi-assembly estimate with overhead ──────────────────────

describe("estimateFromAssemblies", () => {
  it("computes subtotal, overhead, total, totalWithTax correctly", () => {
    const result = estimateFromAssemblies(
      [{ assemblyId: "lgs-wall-65", quantity: 10 }],
      0.1,
    );

    expect(result.subtotal).toBeGreaterThan(0);
    expect(result.overhead).toBe(Math.round(result.subtotal * 0.1));
    expect(result.total).toBe(result.subtotal + result.overhead);
    expect(result.totalWithTax).toBe(Math.round(result.total * 1.1));
  });

  it("accepts multiple assemblies", () => {
    const result = estimateFromAssemblies([
      { assemblyId: "lgs-wall-65", quantity: 50 },
      { assemblyId: "lgs-ceiling", quantity: 30 },
      { assemblyId: "floor-oa-carpet", quantity: 30 },
    ]);
    expect(result.items).toHaveLength(3);
    expect(result.subtotal).toBeGreaterThan(0);
  });

  it("uses default overheadRate of 0.1 when not provided", () => {
    const withDefault = estimateFromAssemblies([{ assemblyId: "lgs-wall-65", quantity: 10 }]);
    const explicit = estimateFromAssemblies([{ assemblyId: "lgs-wall-65", quantity: 10 }], 0.1);
    expect(withDefault.overhead).toBe(explicit.overhead);
  });

  it("throws on unknown assemblyId", () => {
    expect(() =>
      estimateFromAssemblies([{ assemblyId: "nonexistent-id", quantity: 1 }]),
    ).toThrow("アセンブリID");
  });

  it("supports zero overhead rate", () => {
    const result = estimateFromAssemblies(
      [{ assemblyId: "wall-paint", quantity: 20 }],
      0,
    );
    expect(result.overhead).toBe(0);
    expect(result.total).toBe(result.subtotal);
  });
});

// ─── findAssembliesByCategory ────────────────────────────────────

describe("findAssembliesByCategory", () => {
  it("returns correct assemblies for 間仕切り壁", () => {
    const walls = findAssembliesByCategory("間仕切り壁");
    expect(walls.length).toBe(3);
    expect(walls.every((a) => a.category === "間仕切り壁")).toBe(true);
  });

  it("returns correct assemblies for 床", () => {
    const floors = findAssembliesByCategory("床");
    expect(floors.length).toBe(2);
  });

  it("returns empty array for unknown category", () => {
    const none = findAssembliesByCategory("存在しないカテゴリ");
    expect(none).toHaveLength(0);
  });
});

// ─── getAssemblyUnitCost ─────────────────────────────────────────

describe("getAssemblyUnitCost", () => {
  it("computes unit cost as sum of component costs per unit", () => {
    const assembly: Assembly = {
      id: "test",
      name: "テスト",
      category: "test",
      unit: "㎡",
      components: [
        { name: "A", unit: "個", quantityPer: 2, unitPrice: 1000 },
        { name: "B", unit: "㎡", quantityPer: 3, unitPrice: 200 },
      ],
    };
    // A: 2 * 1000 = 2000, B: 3 * 200 = 600, total = 2600
    expect(getAssemblyUnitCost(assembly)).toBe(2600);
  });

  it("applies wasteFactor to unit cost", () => {
    const assembly: Assembly = {
      id: "test",
      name: "テスト",
      category: "test",
      unit: "㎡",
      components: [
        { name: "C", unit: "枚", quantityPer: 1, unitPrice: 1000, wasteFactor: 1.1 },
      ],
    };
    // 1 * 1.1 * 1000 = 1100
    expect(getAssemblyUnitCost(assembly)).toBeCloseTo(1100, 5);
  });

  it("returns positive cost for built-in assemblies", () => {
    for (const a of getBuiltInAssemblies()) {
      expect(getAssemblyUnitCost(a)).toBeGreaterThan(0);
    }
  });
});

// ─── compareAssemblies ────────────────────────────────────────────

describe("compareAssemblies", () => {
  it("identifies the cheaper assembly", () => {
    const a65 = getBuiltInAssemblies().find((a) => a.id === "lgs-wall-65")!;
    const a90 = getBuiltInAssemblies().find((a) => a.id === "lgs-wall-90")!;
    const result = compareAssemblies(a65, a90);
    // 65型 should be cheaper than 90型
    expect(result.cheaperAssemblyId).toBe("lgs-wall-65");
  });

  it("returns assemblyA and assemblyB details", () => {
    const a65 = getBuiltInAssemblies().find((a) => a.id === "lgs-wall-65")!;
    const a75 = getBuiltInAssemblies().find((a) => a.id === "lgs-wall-75")!;
    const result = compareAssemblies(a65, a75);
    expect(result.assemblyA.id).toBe("lgs-wall-65");
    expect(result.assemblyB.id).toBe("lgs-wall-75");
    expect(result.assemblyA.componentCount).toBe(a65.components.length);
    expect(result.assemblyB.componentCount).toBe(a75.components.length);
  });

  it("costDifference sign matches assemblyA vs assemblyB cost", () => {
    const a65 = getBuiltInAssemblies().find((a) => a.id === "lgs-wall-65")!;
    const a75 = getBuiltInAssemblies().find((a) => a.id === "lgs-wall-75")!;
    const result = compareAssemblies(a65, a75);
    // costDifference negative means A is cheaper than B
    const sign = result.assemblyA.unitCost < result.assemblyB.unitCost ? -1 : 1;
    expect(Math.sign(result.costDifference)).toBe(sign);
    // absolute value within 1 yen of rounding
    const approx = result.assemblyA.unitCost - result.assemblyB.unitCost;
    expect(Math.abs(result.costDifference - approx)).toBeLessThanOrEqual(1);
  });

  it("costDifferenceRate is non-negative", () => {
    const a65 = getBuiltInAssemblies().find((a) => a.id === "lgs-wall-65")!;
    const a90 = getBuiltInAssemblies().find((a) => a.id === "lgs-wall-90")!;
    const result = compareAssemblies(a65, a90);
    expect(result.costDifferenceRate).toBeGreaterThan(0);
  });
});

// ─── HTML generation ─────────────────────────────────────────────

describe("buildAssemblyEstimateHtml", () => {
  function makeResult() {
    return estimateFromAssemblies([
      { assemblyId: "lgs-wall-65", quantity: 100 },
      { assemblyId: "lgs-ceiling", quantity: 50 },
    ]);
  }

  it("returns a string containing DOCTYPE", () => {
    const html = buildAssemblyEstimateHtml(makeResult(), {
      projectName: "南青山テスト",
      clientName: "テスト株式会社",
    });
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("escapes HTML special chars in project name", () => {
    const html = buildAssemblyEstimateHtml(makeResult(), {
      projectName: "<script>evil()</script>",
      clientName: "A&B",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A&amp;B");
  });

  it("contains subtotal and total rows", () => {
    const result = makeResult();
    const html = buildAssemblyEstimateHtml(result, { projectName: "P", clientName: "C" });
    expect(html).toContain("小計");
    expect(html).toContain("合計（税込");
  });

  it("contains assembly names from the result", () => {
    const result = makeResult();
    const html = buildAssemblyEstimateHtml(result, { projectName: "P", clientName: "C" });
    expect(html).toContain("LGS間仕切り壁 65型");
    expect(html).toContain("LGS軽量天井");
  });
});

// ─── CSV export ───────────────────────────────────────────────────

describe("exportAssemblyCSV", () => {
  function makeResult() {
    return estimateFromAssemblies([{ assemblyId: "wall-paint", quantity: 20 }]);
  }

  it("starts with a header line", () => {
    const csv = exportAssemblyCSV(makeResult());
    const firstLine = csv.split("\n")[0];
    expect(firstLine).toContain("アセンブリ名");
    expect(firstLine).toContain("金額");
  });

  it("contains totals at the end", () => {
    const csv = exportAssemblyCSV(makeResult());
    expect(csv).toContain("小計");
    expect(csv).toContain("合計（税込）");
  });

  it("has quoted fields", () => {
    const csv = exportAssemblyCSV(makeResult());
    // All data rows should use double-quoted fields
    const dataLines = csv.split("\n").filter((l) => l.startsWith('"'));
    expect(dataLines.length).toBeGreaterThan(0);
  });

  it("escapes double quotes in field values", () => {
    const comp: AssemblyComponent[] = [
      { name: 'Material "X"', unit: "個", quantityPer: 1, unitPrice: 100 },
    ];
    const assembly = createCustomAssembly('Assembly "A"', "cat", "個", comp);
    const result = {
      items: [calculateAssembly(assembly, 1)],
      subtotal: 100,
      overhead: 10,
      total: 110,
      totalWithTax: 121,
    };
    const csv = exportAssemblyCSV(result);
    expect(csv).toContain('""X""');
  });

  it("outputs a row per component per assembly", () => {
    const result = makeResult();
    const csv = exportAssemblyCSV(result);
    const lines = csv.split("\n").filter((l) => l.startsWith('"'));
    // wall-paint has 5 components + 4 totals rows
    expect(lines.length).toBeGreaterThanOrEqual(5);
  });
});
