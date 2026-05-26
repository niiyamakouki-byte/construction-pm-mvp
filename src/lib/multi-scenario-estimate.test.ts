import { describe, expect, it } from "vitest";
import {
  buildComparisonTableHtml,
  buildScenarioDetailHtml,
  cloneScenario,
  createMultiScenario,
  createScenario,
  exportComparisonCSV,
  generateComparisons,
  getScenarioDiff,
  mergeScenarioItems,
  recommendScenario,
} from "./multi-scenario-estimate.js";
import type {
  EstimateGrade,
  Scenario,
  ScenarioItem,
} from "./multi-scenario-estimate.js";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ecoItems = [
  { name: "床材", unit: "㎡", quantity: 20, unitPrice: 3000 },
  { name: "壁紙", unit: "㎡", quantity: 50, unitPrice: 800 },
];

const stdItems = [
  { name: "床材", unit: "㎡", quantity: 20, unitPrice: 5000 },
  { name: "壁紙", unit: "㎡", quantity: 50, unitPrice: 1200 },
];

const premItems = [
  { name: "床材", unit: "㎡", quantity: 20, unitPrice: 8000 },
  { name: "壁紙", unit: "㎡", quantity: 50, unitPrice: 2000 },
  { name: "照明", unit: "式", quantity: 1, unitPrice: 150000 },
];

function makeEco(): Scenario {
  return createScenario("エコノミー案", "economy", ecoItems, 0.1, { id: "eco-1" });
}

function makeStd(): Scenario {
  return createScenario("スタンダード案", "standard", stdItems, 0.1, { id: "std-1" });
}

function makePrem(): Scenario {
  return createScenario("プレミアム案", "premium", premItems, 0.1, { id: "prem-1" });
}

// ── createScenario ────────────────────────────────────────────────────────────

describe("createScenario", () => {
  it("品目のamountを自動計算する", () => {
    const s = makeEco();
    expect(s.items[0].amount).toBe(3000 * 20);  // 60000
    expect(s.items[1].amount).toBe(800 * 50);   // 40000
  });

  it("小計・諸経費・合計・税込を正しく計算する", () => {
    const s = makeEco();
    const subtotal = 60000 + 40000;              // 100000
    const overhead = Math.round(subtotal * 0.1); // 10000
    const total = subtotal + overhead;            // 110000
    const totalWithTax = Math.round(total * 1.1); // 121000

    expect(s.subtotal).toBe(subtotal);
    expect(s.overhead).toBe(overhead);
    expect(s.total).toBe(total);
    expect(s.totalWithTax).toBe(totalWithTax);
  });

  it("gradeがitemにも付与される", () => {
    const s = makeEco();
    for (const item of s.items) {
      expect(item.grade).toBe("economy");
    }
  });

  it("小数量 × 整数単価で amount が整数になる（float drift 防止）", () => {
    // 1.1 * 3000 = 3300.0000000000005 without Math.round
    const s = createScenario("テスト", "standard", [
      { name: "塗料", unit: "L", quantity: 1.1, unitPrice: 3000 },
    ], 0);
    expect(s.items[0].amount).toBe(3300);
    expect(Number.isInteger(s.items[0].amount)).toBe(true);
    expect(s.subtotal).toBe(3300);
  });

  it("諸経費率0でも正常に動作する", () => {
    const s = createScenario("テスト", "standard", stdItems, 0);
    expect(s.overhead).toBe(0);
    expect(s.total).toBe(s.subtotal);
  });

  it("空品目でも0が返る", () => {
    const s = createScenario("空", "economy", []);
    expect(s.subtotal).toBe(0);
    expect(s.total).toBe(0);
    expect(s.totalWithTax).toBe(0);
  });

  it("descriptionが設定される", () => {
    const s = createScenario("テスト", "standard", [], 0.1, { description: "説明文" });
    expect(s.description).toBe("説明文");
  });
});

// ── generateComparisons ───────────────────────────────────────────────────────

describe("generateComparisons", () => {
  it("同名品目をグレードをまたいで比較する", () => {
    const comparisons = generateComparisons([makeEco(), makeStd()]);

    const floorCmp = comparisons.find((c) => c.itemName === "床材");
    expect(floorCmp).toBeDefined();
    expect(floorCmp!.economy).toEqual({ unitPrice: 3000, amount: 60000 });
    expect(floorCmp!.standard).toEqual({ unitPrice: 5000, amount: 100000 });
  });

  it("片方のグレードにしかない品目はundefinedになる", () => {
    const comparisons = generateComparisons([makeStd(), makePrem()]);
    const lightCmp = comparisons.find((c) => c.itemName === "照明");
    expect(lightCmp).toBeDefined();
    expect(lightCmp!.standard).toBeUndefined();
    expect(lightCmp!.premium).toBeDefined();
  });

  it("savingsはstandard - economyの差額", () => {
    const comparisons = generateComparisons([makeEco(), makeStd()]);
    const floorCmp = comparisons.find((c) => c.itemName === "床材")!;
    // standard amount 100000, economy amount 60000 → savings = 40000
    expect(floorCmp.savings).toBe(40000);
  });

  it("単一シナリオでも動作する", () => {
    const comparisons = generateComparisons([makeStd()]);
    expect(comparisons).toHaveLength(2);
    expect(comparisons[0].standard).toBeDefined();
    expect(comparisons[0].economy).toBeUndefined();
    // economy が存在しない(=0)場合、savings = standard.amount - 0
    expect(comparisons[0].savings).toBe(comparisons[0].standard!.amount);
  });

  it("空シナリオ配列は空配列を返す", () => {
    expect(generateComparisons([])).toEqual([]);
  });
});

// ── createMultiScenario ───────────────────────────────────────────────────────

describe("createMultiScenario", () => {
  it("scenariosとcomparisonsがまとめられる", () => {
    const result = createMultiScenario("Aプロジェクト", [makeEco(), makeStd(), makePrem()]);
    expect(result.projectName).toBe("Aプロジェクト");
    expect(result.scenarios).toHaveLength(3);
    expect(result.comparisons.length).toBeGreaterThan(0);
  });

  it("createdAtがDateオブジェクト", () => {
    const result = createMultiScenario("テスト", [makeStd()]);
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it("推薦グレードを明示指定できる", () => {
    const result = createMultiScenario("テスト", [makeEco(), makeStd()], "economy");
    expect(result.recommendation).toBe("economy");
  });
});

// ── getScenarioDiff ───────────────────────────────────────────────────────────

describe("getScenarioDiff", () => {
  it("片方にしかない品目を正しく分類する", () => {
    const diff = getScenarioDiff(makeStd(), makePrem());
    const lightOnly = diff.onlyInB.find((i) => i.name === "照明");
    expect(lightOnly).toBeDefined();
    expect(diff.onlyInA).toHaveLength(0);
  });

  it("共通品目の単価差を計算する", () => {
    const diff = getScenarioDiff(makeEco(), makeStd());
    const floorDiff = diff.inBoth.find((i) => i.name === "床材")!;
    expect(floorDiff.unitPriceA).toBe(3000);
    expect(floorDiff.unitPriceB).toBe(5000);
    expect(floorDiff.priceDiff).toBe(2000);
  });

  it("totalDiffはB.total - A.total", () => {
    const eco = makeEco();
    const std = makeStd();
    const diff = getScenarioDiff(eco, std);
    expect(diff.totalDiff).toBe(std.total - eco.total);
  });

  it("同一シナリオの差分は全てゼロ", () => {
    const std = makeStd();
    const diff = getScenarioDiff(std, std);
    expect(diff.onlyInA).toHaveLength(0);
    expect(diff.onlyInB).toHaveLength(0);
    for (const b of diff.inBoth) {
      expect(b.priceDiff).toBe(0);
    }
    expect(diff.totalDiff).toBe(0);
  });
});

// ── recommendScenario ────────────────────────────────────────────────────────

describe("recommendScenario", () => {
  it("予算なしはstandardを推薦", () => {
    const result = recommendScenario([makeEco(), makeStd(), makePrem()]);
    expect(result.grade).toBe("standard");
  });

  it("予算内で最高品質のグレードを選ぶ", () => {
    const eco = makeEco();   // totalWithTax = 121000
    const std = makeStd();   // totalWithTax = 181500

    const result = recommendScenario([eco, std], 150000);
    expect(result.grade).toBe("economy");
    expect(result.scenario?.id).toBe(eco.id);
  });

  it("premiumが予算内に収まる場合はpremiumを推薦", () => {
    const eco = makeEco();
    const std = makeStd();
    const prem = makePrem();

    // prem.totalWithTax を確認して十分大きな予算を渡す
    const result = recommendScenario([eco, std, prem], prem.totalWithTax + 1);
    expect(result.grade).toBe("premium");
  });

  it("全案が予算超過の場合は最安を推薦", () => {
    const result = recommendScenario([makeEco(), makeStd()], 1000);
    expect(result.grade).toBe("economy");
  });

  it("シナリオ空の場合は標準グレードとundefinedシナリオを返す", () => {
    const result = recommendScenario([]);
    expect(result.grade).toBe("standard");
    expect(result.scenario).toBeUndefined();
  });
});

// ── cloneScenario ────────────────────────────────────────────────────────────

describe("cloneScenario", () => {
  it("乗数を掛けた単価でシナリオをクローンする", () => {
    const eco = makeEco();
    const std = cloneScenario(eco, "standard", 1.5, { id: "std-clone" });

    expect(std.grade).toBe("standard");
    expect(std.items[0].unitPrice).toBe(Math.round(3000 * 1.5)); // 4500
    expect(std.items[1].unitPrice).toBe(Math.round(800 * 1.5));  // 1200
  });

  it("クローン後のamountが再計算される", () => {
    const eco = makeEco();
    const std = cloneScenario(eco, "standard", 2.0);
    expect(std.items[0].amount).toBe(6000 * 20); // 120000
  });

  it("1.0倍クローンは元と同じ合計になる", () => {
    const eco = makeEco();
    const clone = cloneScenario(eco, "economy", 1.0);
    expect(clone.totalWithTax).toBe(eco.totalWithTax);
  });

  it("nameオプションが適用される", () => {
    const eco = makeEco();
    const clone = cloneScenario(eco, "premium", 2.0, { name: "カスタム案" });
    expect(clone.name).toBe("カスタム案");
  });
});

// ── mergeScenarioItems ────────────────────────────────────────────────────────

describe("mergeScenarioItems", () => {
  const makeItem = (
    name: string,
    unitPrice: number,
    grade: EstimateGrade = "standard",
  ): ScenarioItem => ({
    name,
    unit: "式",
    quantity: 1,
    unitPrice,
    amount: unitPrice,
    grade,
  });

  it("既存品目はアップグレード側で上書きされる", () => {
    const base = [makeItem("床材", 5000), makeItem("壁紙", 1000)];
    const upgrade = [makeItem("床材", 8000, "premium")];
    const result = mergeScenarioItems(base, upgrade);

    const floor = result.find((i) => i.name === "床材")!;
    expect(floor.unitPrice).toBe(8000);
    expect(floor.grade).toBe("premium");
    expect(result).toHaveLength(2);
  });

  it("アップグレードにしかない品目は追加される", () => {
    const base = [makeItem("床材", 5000)];
    const upgrade = [makeItem("照明", 150000, "premium")];
    const result = mergeScenarioItems(base, upgrade);
    expect(result).toHaveLength(2);
    expect(result.find((i) => i.name === "照明")).toBeDefined();
  });

  it("upgradeが空の場合はbaseをそのまま返す", () => {
    const base = [makeItem("床材", 5000)];
    const result = mergeScenarioItems(base, []);
    expect(result).toEqual(base);
  });

  it("baseが空の場合はupgradeのみになる", () => {
    const upgrade = [makeItem("照明", 150000)];
    const result = mergeScenarioItems([], upgrade);
    expect(result).toEqual(upgrade);
  });
});

// ── buildComparisonTableHtml ──────────────────────────────────────────────────

describe("buildComparisonTableHtml", () => {
  it("3列レイアウトのHTMLを生成する", () => {
    const result = createMultiScenario("テストP", [makeEco(), makeStd(), makePrem()]);
    const html = buildComparisonTableHtml(result);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("テストP");
    // 3グレードのヘッダーが存在する
    expect(html).toContain("松（エコノミー）");
    expect(html).toContain("竹（スタンダード）");
    expect(html).toContain("梅（プレミアム）");
  });

  it("品目名と金額が含まれる", () => {
    const result = createMultiScenario("P", [makeEco(), makeStd()]);
    const html = buildComparisonTableHtml(result);
    expect(html).toContain("床材");
    expect(html).toContain("壁紙");
  });

  it("HTMLエスケープが機能する（XSS防止）", () => {
    const xssScenario = createScenario('<script>alert(1)</script>', "standard", [], 0, {
      id: "xss-test",
    });
    const result = createMultiScenario('<img src=x onerror=alert(1)>', [xssScenario]);
    const html = buildComparisonTableHtml(result);
    // プロジェクト名の <img> タグがエスケープされていること
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    // <title> に埋め込まれたプロジェクト名もエスケープ済み
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("税込合計が footer に表示される", () => {
    const eco = makeEco();
    const result = createMultiScenario("P", [eco]);
    const html = buildComparisonTableHtml(result);
    expect(html).toContain("税込合計");
    expect(html).toContain(eco.totalWithTax.toLocaleString());
  });

  it("単一シナリオでも動作する", () => {
    const result = createMultiScenario("P", [makeStd()]);
    const html = buildComparisonTableHtml(result);
    expect(html).toContain("竹（スタンダード）");
  });
});

// ── buildScenarioDetailHtml ───────────────────────────────────────────────────

describe("buildScenarioDetailHtml", () => {
  it("品目一覧と合計を含むHTMLを生成する", () => {
    const std = makeStd();
    const html = buildScenarioDetailHtml(std);
    expect(html).toContain("床材");
    expect(html).toContain("壁紙");
    expect(html).toContain("小計");
    expect(html).toContain("税込合計");
    expect(html).toContain(std.totalWithTax.toLocaleString());
  });

  it("descriptionが設定されている場合は表示される", () => {
    const s = createScenario("テスト", "standard", stdItems, 0.1, {
      description: "高品質仕様",
    });
    const html = buildScenarioDetailHtml(s);
    expect(html).toContain("高品質仕様");
  });

  it("noteが空の場合でもエラーにならない", () => {
    const std = makeStd();
    expect(() => buildScenarioDetailHtml(std)).not.toThrow();
  });
});

// ── exportComparisonCSV ───────────────────────────────────────────────────────

describe("exportComparisonCSV", () => {
  it("CSVヘッダーに品目列とグレード列が含まれる", () => {
    const result = createMultiScenario("CSVテスト", [makeEco(), makeStd()]);
    const csv = exportComparisonCSV(result);

    const lines = csv.split("\n");
    expect(lines[0]).toContain("品目");
    expect(lines[0]).toContain("松（エコノミー）");
    expect(lines[0]).toContain("竹（スタンダード）");
  });

  it("品目行が存在する", () => {
    const result = createMultiScenario("CSVテスト", [makeEco(), makeStd()]);
    const csv = exportComparisonCSV(result);
    expect(csv).toContain("床材");
    expect(csv).toContain("壁紙");
  });

  it("税込合計行が末尾にある", () => {
    const result = createMultiScenario("CSVテスト", [makeEco()]);
    const csv = exportComparisonCSV(result);
    const lines = csv.trim().split("\n");
    const lastLine = lines[lines.length - 1];
    expect(lastLine).toContain("税込合計");
  });

  it("カンマを含む文字列はダブルクォートでエスケープされる", () => {
    const result = createMultiScenario("プロジェクト,テスト", [makeStd()]);
    const csv = exportComparisonCSV(result);
    expect(csv).toContain('"プロジェクト,テスト"');
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("エッジケース", () => {
  it("同一シナリオを2つ渡しても比較が動作する", () => {
    const std1 = makeStd();
    const std2 = { ...makeStd(), id: "std-2", grade: "standard" as EstimateGrade };
    expect(() => generateComparisons([std1, std2])).not.toThrow();
  });

  it("空品目のシナリオでHTML生成がエラーにならない", () => {
    const empty = createScenario("空", "economy", [], 0.1, { id: "empty" });
    const result = createMultiScenario("P", [empty]);
    expect(() => buildComparisonTableHtml(result)).not.toThrow();
    expect(() => buildScenarioDetailHtml(empty)).not.toThrow();
  });

  it("空品目のシナリオでCSVエクスポートがエラーにならない", () => {
    const empty = createScenario("空", "economy", [], 0.1, { id: "empty" });
    const result = createMultiScenario("P", [empty]);
    expect(() => exportComparisonCSV(result)).not.toThrow();
  });
});
