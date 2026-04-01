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
});
