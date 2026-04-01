import { describe, it, expect } from "vitest";
import {
  parseNaturalLanguage,
  nlToEstimateInputs,
  formatParseResult,
} from "../estimate/nl-estimate-parser";
import { generateEstimate } from "../estimate";

describe("nl-estimate-parser", () => {
  describe("parseNaturalLanguage", () => {
    it("parses '6畳の壁紙張替え' correctly", () => {
      const result = parseNaturalLanguage("6畳の壁紙張替え");

      expect(result.detectedTatami).toBe(6);
      // 6畳 = 9.72㎡
      expect(result.detectedArea?.sqm).toBeCloseTo(9.72, 1);

      // 壁紙 → IN-005 (クロス張り量産品)
      const wallpaper = result.items.find((i) => i.code === "IN-005");
      expect(wallpaper).toBeDefined();
      // 壁面積: 周長(sqrt(9.72)*4 = 12.47m) × 2.4m = 29.9㎡ → ceil = 30
      expect(wallpaper!.quantity).toBeGreaterThan(0);
      expect(wallpaper!.quantity).toBeLessThan(50);
    });

    it("parses sqm input '20㎡のクロス張替えとフローリング'", () => {
      const result = parseNaturalLanguage("20㎡のクロス張替えとフローリング");

      expect(result.detectedArea?.sqm).toBe(20);
      expect(result.detectedArea?.source).toBe("sqm");

      const wallpaper = result.items.find((i) => i.code === "IN-005");
      const floor = result.items.find((i) => i.code === "IN-009");
      expect(wallpaper).toBeDefined();
      expect(floor).toBeDefined();
      // フローリング数量は床面積=20㎡
      expect(floor!.quantity).toBe(20);
    });

    it("parses tsubo input '10坪のタイルカーペット'", () => {
      const result = parseNaturalLanguage("10坪のタイルカーペット");

      expect(result.detectedArea?.source).toBe("tsubo");
      // 10坪 = 33.06㎡
      expect(result.detectedArea?.sqm).toBeCloseTo(33.06, 1);

      const carpet = result.items.find((i) => i.code === "IN-008");
      expect(carpet).toBeDefined();
      expect(carpet!.quantity).toBe(34); // ceil(33.06)
    });

    it("parses count-based items: 'ダウンライト8台'", () => {
      const result = parseNaturalLanguage("ダウンライト8台");

      const dl = result.items.find((i) => i.code === "EL-005");
      expect(dl).toBeDefined();
      expect(dl!.quantity).toBe(8);
    });

    it("uses default count when no count specified: 'エアコン設置'", () => {
      const result = parseNaturalLanguage("エアコン設置");

      const ac = result.items.find((i) => i.code === "HV-001");
      expect(ac).toBeDefined();
      expect(ac!.quantity).toBe(1); // defaultCount for エアコン
    });

    it("parses fixed items: 'ユニットバス交換'", () => {
      const result = parseNaturalLanguage("ユニットバス交換");

      const ub = result.items.find((i) => i.code === "PL-007");
      expect(ub).toBeDefined();
      expect(ub!.quantity).toBe(1);
    });

    it("parses multiple items in one sentence", () => {
      const result = parseNaturalLanguage(
        "8畳のリビング、壁紙張替え、フローリング、ダウンライト6台、エアコン1台"
      );

      expect(result.detectedTatami).toBe(8);
      expect(result.items.length).toBeGreaterThanOrEqual(3);

      const wallpaper = result.items.find((i) => i.code === "IN-005");
      const floor = result.items.find((i) => i.code === "IN-009");
      const lights = result.items.find((i) => i.code === "EL-005");
      const ac = result.items.find((i) => i.code === "HV-001");

      expect(wallpaper).toBeDefined();
      expect(floor).toBeDefined();
      expect(lights).toBeDefined();
      expect(lights!.quantity).toBe(6);
      expect(ac).toBeDefined();
    });

    it("handles full-width numbers: '６畳の壁紙'", () => {
      const result = parseNaturalLanguage("６畳の壁紙");

      expect(result.detectedTatami).toBe(6);
      expect(result.items.find((i) => i.code === "IN-005")).toBeDefined();
    });

    it("adds protection and cleaning when options are set", () => {
      const result = parseNaturalLanguage("6畳のフローリング", {
        includeProtection: true,
        includeCleaning: true,
      });

      expect(result.items.find((i) => i.code === "DM-009")).toBeDefined(); // 養生
      expect(result.items.find((i) => i.code === "OH-006")).toBeDefined(); // クリーニング
    });

    it("returns empty items for unrecognizable input", () => {
      const result = parseNaturalLanguage("おはようございます");

      expect(result.items).toHaveLength(0);
      expect(result.unmatched.length).toBeGreaterThan(0);
    });

    it("defaults to 10㎡ when no area is specified", () => {
      const result = parseNaturalLanguage("タイルカーペット張替え");

      const carpet = result.items.find((i) => i.code === "IN-008");
      expect(carpet).toBeDefined();
      expect(carpet!.quantity).toBe(10); // default 10㎡
    });

    it("allows custom default area", () => {
      const result = parseNaturalLanguage("タイルカーペット張替え", {
        defaultAreaSqm: 30,
      });

      const carpet = result.items.find((i) => i.code === "IN-008");
      expect(carpet!.quantity).toBe(30);
    });

    it("handles perimeter-based items (巾木)", () => {
      const result = parseNaturalLanguage("6畳の巾木交換");

      const baseboard = result.items.find((i) => i.code === "IN-012");
      expect(baseboard).toBeDefined();
      // 6畳 → sqrt(9.72)*4 = 12.47m → ceil = 13
      expect(baseboard!.quantity).toBeGreaterThan(10);
      expect(baseboard!.quantity).toBeLessThan(20);
    });
  });

  describe("nlToEstimateInputs", () => {
    it("returns EstimateInput[] compatible with generateEstimate", () => {
      const inputs = nlToEstimateInputs("6畳の壁紙張替え");

      expect(inputs.length).toBeGreaterThan(0);
      expect(inputs[0]).toHaveProperty("code");
      expect(inputs[0]).toHaveProperty("quantity");
      // Should NOT have extra properties
      expect(inputs[0]).not.toHaveProperty("matchedKeyword");
    });

    it("integrates with generateEstimate end-to-end", () => {
      const inputs = nlToEstimateInputs("8畳のフローリング張替えとクロス張替え");

      const estimate = generateEstimate({
        propertyName: "テストマンション101",
        clientName: "テスト太郎",
        items: inputs,
      });

      expect(estimate.total).toBeGreaterThan(0);
      expect(estimate.sections.length).toBeGreaterThan(0);
      expect(estimate.propertyName).toBe("テストマンション101");
    });
  });

  describe("realistic construction descriptions", () => {
    it("20坪オフィスリノベ: クロス・タイルカーペット・岩綿吸音板・LED20台・エアコン3台", () => {
      const result = parseNaturalLanguage(
        "20坪のオフィスのリノベーション、壁はクロス張替え、床はタイルカーペット、天井は岩綿吸音板、LED照明20台、エアコン3台",
      );

      expect(result.detectedArea?.source).toBe("tsubo");
      expect(result.detectedArea?.sqm).toBeCloseTo(66.12, 0);

      // クロス
      const cross = result.items.find((i) => i.code === "IN-005");
      expect(cross).toBeDefined();
      expect(cross!.quantity).toBe(78); // 壁面積 ceil

      // タイルカーペット
      const carpet = result.items.find((i) => i.code === "IN-008");
      expect(carpet).toBeDefined();
      expect(carpet!.quantity).toBe(67); // 床面積 ceil(66.12)

      // 岩綿吸音板 → システム天井 IN-014
      const ceiling = result.items.find((i) => i.code === "IN-014");
      expect(ceiling).toBeDefined();
      expect(ceiling!.quantity).toBe(67);

      // 天井が2重マッチしていないこと
      expect(result.items.filter((i) => i.code === "IN-015")).toHaveLength(0);

      // LED照明20台
      const led = result.items.find((i) => i.code === "EL-004");
      expect(led).toBeDefined();
      expect(led!.quantity).toBe(20);

      // エアコン3台 (20台ではない!)
      const ac = result.items.find((i) => i.code === "HV-001");
      expect(ac).toBeDefined();
      expect(ac!.quantity).toBe(3);

      // 5品目マッチ
      expect(result.items).toHaveLength(5);

      // 不要な未マッチ警告がないこと
      expect(result.unmatched).toHaveLength(0);
    });

    it("6畳の洋室、壁紙張替えとフローリング", () => {
      const result = parseNaturalLanguage("6畳の洋室、壁紙張替えとフローリング");

      expect(result.detectedTatami).toBe(6);

      const wallpaper = result.items.find((i) => i.code === "IN-005");
      expect(wallpaper).toBeDefined();
      expect(wallpaper!.quantity).toBe(30); // 壁面積

      const floor = result.items.find((i) => i.code === "IN-009");
      expect(floor).toBeDefined();
      expect(floor!.quantity).toBe(10); // 床面積 ceil(9.72)

      expect(result.items).toHaveLength(2);
      expect(result.unmatched).toHaveLength(0);
    });

    it("店舗の内装解体とスケルトン戻し50㎡", () => {
      const result = parseNaturalLanguage("店舗の内装解体とスケルトン戻し50㎡");

      expect(result.detectedArea?.sqm).toBe(50);
      expect(result.detectedArea?.source).toBe("sqm");

      // 内装解体 DM-001
      const demolition = result.items.find((i) => i.code === "DM-001");
      expect(demolition).toBeDefined();
      expect(demolition!.quantity).toBe(50);

      // "スケルトン"もDM-001にマッチするが、同一コードなのでdedup
      expect(result.items.filter((i) => i.code === "DM-001")).toHaveLength(1);
    });

    it("間仕切りLGS壁新設5m×2.4m、両面PB+クロス", () => {
      const result = parseNaturalLanguage("間仕切りLGS壁新設5m×2.4m、両面PB+クロス");

      // 寸法検出: 5×2.4=12㎡
      expect(result.detectedArea?.sqm).toBe(12);
      expect(result.detectedArea?.source).toBe("dimensions");

      // 間仕切り IN-002 (両面) → 12㎡
      const partition = result.items.find((i) => i.code === "IN-002");
      expect(partition).toBeDefined();
      expect(partition!.quantity).toBe(12);

      // クロス IN-005 → 両面なので24㎡
      const cross = result.items.find((i) => i.code === "IN-005");
      expect(cross).toBeDefined();
      expect(cross!.quantity).toBe(24); // 12㎡ × 両面 = 24㎡
    });
  });

  describe("count extraction across clauses", () => {
    it("does not bleed counts across comma-separated items", () => {
      const result = parseNaturalLanguage("LED照明20台、エアコン3台");

      const led = result.items.find((i) => i.code === "EL-004");
      expect(led!.quantity).toBe(20);

      const ac = result.items.find((i) => i.code === "HV-001");
      expect(ac!.quantity).toBe(3);
    });

    it("handles counts before keyword: '3台エアコン'", () => {
      const result = parseNaturalLanguage("3台エアコン設置");
      const ac = result.items.find((i) => i.code === "HV-001");
      expect(ac).toBeDefined();
      expect(ac!.quantity).toBe(3);
    });
  });

  describe("scaffolding keywords", () => {
    it("枠組足場", () => {
      const result = parseNaturalLanguage("20㎡の枠組足場");
      const item = result.items.find((i) => i.code === "SC-001");
      expect(item).toBeDefined();
    });

    it("単管足場", () => {
      const result = parseNaturalLanguage("単管足場30㎡");
      const item = result.items.find((i) => i.code === "SC-002");
      expect(item).toBeDefined();
    });

    it("ローリングタワー", () => {
      const result = parseNaturalLanguage("ローリングタワー2台");
      const item = result.items.find((i) => i.code === "SC-003");
      expect(item).toBeDefined();
      expect(item!.quantity).toBe(2);
    });

    it("足場 (generic)", () => {
      const result = parseNaturalLanguage("足場設置");
      const item = result.items.find((i) =>
        i.code.startsWith("SC-"),
      );
      expect(item).toBeDefined();
    });
  });

  describe("plastering / mortar keywords", () => {
    it("左官 → PL2-001", () => {
      const result = parseNaturalLanguage("10㎡の左官工事");
      const item = result.items.find((i) => i.code === "PL2-001");
      expect(item).toBeDefined();
    });

    it("モルタル造形 → PL2-009", () => {
      const result = parseNaturalLanguage("壁モルタル造形5㎡");
      const item = result.items.find((i) => i.code === "PL2-009");
      expect(item).toBeDefined();
    });

    it("モルタル造形レンガ → PL2-011", () => {
      const result = parseNaturalLanguage("レンガ調造形10㎡");
      const item = result.items.find((i) => i.code === "PL2-011");
      expect(item).toBeDefined();
    });

    it("エイジング塗装 → PL2-012", () => {
      const result = parseNaturalLanguage("エイジング塗装8㎡");
      const item = result.items.find((i) => i.code === "PL2-012");
      expect(item).toBeDefined();
    });

    it("セルフレベリング → PL2-008", () => {
      const result = parseNaturalLanguage("セルフレベリング20㎡");
      const item = result.items.find((i) => i.code === "PL2-008");
      expect(item).toBeDefined();
      expect(item!.quantity).toBe(20);
    });
  });

  describe("edge cases", () => {
    it("unknown items produce unmatched warning", () => {
      const result = parseNaturalLanguage("謎の特殊工事");
      expect(result.items).toHaveLength(0);
      expect(result.unmatched.length).toBeGreaterThan(0);
    });

    it("extremely large area (10000㎡) still works", () => {
      const result = parseNaturalLanguage("10000㎡のクロス張替え");
      const cross = result.items.find((i) => i.code === "IN-005");
      expect(cross).toBeDefined();
      expect(cross!.quantity).toBeGreaterThan(100);
    });

    it("zero area produces minimum quantity 1", () => {
      const result = parseNaturalLanguage("0㎡のクロス");
      const cross = result.items.find((i) => i.code === "IN-005");
      expect(cross).toBeDefined();
      expect(cross!.quantity).toBeGreaterThanOrEqual(1);
    });

    it("dimension notation: 3m×2m", () => {
      const result = parseNaturalLanguage("3m×2mのクロス");
      expect(result.detectedArea?.sqm).toBe(6);
      expect(result.detectedArea?.source).toBe("dimensions");
    });
  });

  describe("formatParseResult", () => {
    it("formats output with detected area and items", () => {
      const result = parseNaturalLanguage("6畳の壁紙張替え");
      const text = formatParseResult(result);

      expect(text).toContain('入力: "6畳の壁紙張替え"');
      expect(text).toContain("6畳");
      expect(text).toContain("IN-005");
      expect(text).toContain("クロス張り");
    });

    it("shows unmatched phrases", () => {
      const result = parseNaturalLanguage("特注デスク設置");
      const text = formatParseResult(result);

      expect(text).toContain("未マッチ");
    });
  });

  describe("kanji numeral conversion", () => {
    it("十五畳 → 15畳 (not 105)", () => {
      const result = parseNaturalLanguage("十五畳の壁紙張替え");
      expect(result.detectedTatami).toBe(15);
      expect(result.detectedArea?.sqm).toBeCloseTo(15 * 1.62, 1);
    });

    it("二十㎡ → 20㎡ (not 210)", () => {
      const result = parseNaturalLanguage("二十㎡のクロス張替え");
      expect(result.detectedArea?.sqm).toBe(20);
    });

    it("百二十㎡ → 120㎡", () => {
      const result = parseNaturalLanguage("百二十㎡のタイルカーペット");
      expect(result.detectedArea?.sqm).toBe(120);
      const carpet = result.items.find((i) => i.code === "IN-008");
      expect(carpet!.quantity).toBe(120);
    });

    it("六畳 → 6畳 (single kanji digit still works)", () => {
      const result = parseNaturalLanguage("六畳の壁紙張替え");
      expect(result.detectedTatami).toBe(6);
    });
  });

  describe("keyword exclusion (specific overrides generic)", () => {
    it("業務用エアコン → HV-003 only, not HV-001", () => {
      const result = parseNaturalLanguage("業務用エアコン2台");
      const hvac003 = result.items.find((i) => i.code === "HV-003");
      const hvac001 = result.items.find((i) => i.code === "HV-001");
      expect(hvac003).toBeDefined();
      expect(hvac003!.quantity).toBe(2);
      expect(hvac001).toBeUndefined();
    });

    it("天カセ → HV-003 only, not HV-001", () => {
      const result = parseNaturalLanguage("天カセ3台");
      expect(result.items.find((i) => i.code === "HV-003")).toBeDefined();
      expect(result.items.find((i) => i.code === "HV-001")).toBeUndefined();
    });

    it("タンクレストイレ → PL-004 only, not PL-003", () => {
      const result = parseNaturalLanguage("タンクレストイレ1台");
      const pl004 = result.items.find((i) => i.code === "PL-004");
      const pl003 = result.items.find((i) => i.code === "PL-003");
      expect(pl004).toBeDefined();
      expect(pl003).toBeUndefined();
    });

    it("generic エアコン still works when no specific keyword", () => {
      const result = parseNaturalLanguage("エアコン2台");
      expect(result.items.find((i) => i.code === "HV-001")).toBeDefined();
      expect(result.items.find((i) => i.code === "HV-003")).toBeUndefined();
    });
  });

  describe("シーリング false positive fix", () => {
    it("シーリングライト → EL-006", () => {
      const result = parseNaturalLanguage("シーリングライト2台");
      expect(result.items.find((i) => i.code === "EL-006")).toBeDefined();
    });

    it("シーリング打ち替え → NOT EL-006 (construction sealant)", () => {
      const result = parseNaturalLanguage("シーリング打ち替え");
      expect(result.items.find((i) => i.code === "EL-006")).toBeUndefined();
    });
  });

  describe("material loss rate", () => {
    it("5% loss rate increases floor quantity", () => {
      const result = parseNaturalLanguage("20㎡のタイルカーペット", {
        materialLossRate: 0.05,
      });
      const carpet = result.items.find((i) => i.code === "IN-008");
      expect(carpet).toBeDefined();
      // 20 * 1.05 = 21
      expect(carpet!.quantity).toBe(21);
      expect(carpet!.quantityBasis).toContain("ロス5%込");
    });

    it("0% loss rate (default) does not change quantity", () => {
      const result = parseNaturalLanguage("20㎡のタイルカーペット");
      const carpet = result.items.find((i) => i.code === "IN-008");
      expect(carpet!.quantity).toBe(20);
    });
  });
});
