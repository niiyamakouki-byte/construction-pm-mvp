import { describe, expect, it } from "vitest";
import {
  ConstructionPhase,
  getPhaseLabel,
  getPhaseChecklist,
  evaluatePhaseCompletion,
} from "./construction-checklist.js";

describe("construction-checklist", () => {
  describe("ConstructionPhase", () => {
    it("has 8 phases", () => {
      expect(Object.keys(ConstructionPhase)).toHaveLength(8);
    });

    it("includes all expected phases", () => {
      const expected = [
        "demolition", "foundation", "framing", "roofing",
        "exterior", "interior", "finishing", "inspection",
      ];
      for (const phase of expected) {
        expect(ConstructionPhase).toHaveProperty(phase);
      }
    });
  });

  describe("getPhaseLabel", () => {
    it("returns Japanese labels for all phases", () => {
      expect(getPhaseLabel(ConstructionPhase.demolition)).toBe("解体工事");
      expect(getPhaseLabel(ConstructionPhase.foundation)).toBe("基礎工事");
      expect(getPhaseLabel(ConstructionPhase.framing)).toBe("躯体工事");
      expect(getPhaseLabel(ConstructionPhase.roofing)).toBe("屋根工事");
      expect(getPhaseLabel(ConstructionPhase.exterior)).toBe("外装工事");
      expect(getPhaseLabel(ConstructionPhase.interior)).toBe("内装工事");
      expect(getPhaseLabel(ConstructionPhase.finishing)).toBe("仕上げ工事");
      expect(getPhaseLabel(ConstructionPhase.inspection)).toBe("完了検査");
    });
  });

  describe("getPhaseChecklist", () => {
    it("returns items for demolition phase", () => {
      const items = getPhaseChecklist(ConstructionPhase.demolition);
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.phase === "demolition")).toBe(true);
    });

    it("returns items for foundation phase", () => {
      const items = getPhaseChecklist(ConstructionPhase.foundation);
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.phase === "foundation")).toBe(true);
    });

    it("assigns unique IDs to items", () => {
      const items = getPhaseChecklist(ConstructionPhase.framing);
      const ids = items.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("IDs follow phase-NN format", () => {
      const items = getPhaseChecklist(ConstructionPhase.roofing);
      for (const item of items) {
        expect(item.id).toMatch(/^roofing-\d{2}$/);
      }
    });

    it("each item has both English and Japanese description", () => {
      for (const phase of Object.values(ConstructionPhase)) {
        const items = getPhaseChecklist(phase);
        for (const item of items) {
          expect(item.description.length).toBeGreaterThan(0);
          expect(item.descriptionJa.length).toBeGreaterThan(0);
        }
      }
    });

    it("each phase has at least one required item", () => {
      for (const phase of Object.values(ConstructionPhase)) {
        const items = getPhaseChecklist(phase);
        expect(items.some((item) => item.required)).toBe(true);
      }
    });

    it("returns items for all 8 phases", () => {
      for (const phase of Object.values(ConstructionPhase)) {
        const items = getPhaseChecklist(phase);
        expect(items.length).toBeGreaterThan(0);
      }
    });
  });

  describe("evaluatePhaseCompletion", () => {
    it("passes when all required items completed", () => {
      const items = getPhaseChecklist(ConstructionPhase.demolition);
      const requiredIds = items.filter((i) => i.required).map((i) => i.id);
      const result = evaluatePhaseCompletion(ConstructionPhase.demolition, requiredIds);
      expect(result.passed).toBe(true);
      expect(result.requiredCompleted).toBe(result.requiredTotal);
    });

    it("fails when required items are missing", () => {
      const result = evaluatePhaseCompletion(ConstructionPhase.foundation, []);
      expect(result.passed).toBe(false);
      expect(result.requiredCompleted).toBe(0);
      expect(result.percentage).toBe(0);
    });

    it("calculates percentage correctly", () => {
      const items = getPhaseChecklist(ConstructionPhase.interior);
      const halfIds = items.slice(0, Math.floor(items.length / 2)).map((i) => i.id);
      const result = evaluatePhaseCompletion(ConstructionPhase.interior, halfIds);
      const expectedPct = Math.round((halfIds.length / items.length) * 100);
      expect(result.percentage).toBe(expectedPct);
    });

    it("100% when all items completed", () => {
      const items = getPhaseChecklist(ConstructionPhase.finishing);
      const allIds = items.map((i) => i.id);
      const result = evaluatePhaseCompletion(ConstructionPhase.finishing, allIds);
      expect(result.percentage).toBe(100);
      expect(result.passed).toBe(true);
      expect(result.completedCount).toBe(result.totalItems);
    });

    it("includes phase label in result", () => {
      const result = evaluatePhaseCompletion(ConstructionPhase.inspection, []);
      expect(result.phaseLabel).toBe("完了検査");
      expect(result.phase).toBe("inspection");
    });

    it("ignores unknown item IDs", () => {
      const result = evaluatePhaseCompletion(ConstructionPhase.roofing, ["unknown-01", "fake-02"]);
      expect(result.completedCount).toBe(0);
      expect(result.percentage).toBe(0);
    });

    it("passes with only required items (optional missing is ok)", () => {
      const items = getPhaseChecklist(ConstructionPhase.exterior);
      const requiredIds = items.filter((i) => i.required).map((i) => i.id);
      const result = evaluatePhaseCompletion(ConstructionPhase.exterior, requiredIds);
      expect(result.passed).toBe(true);
      expect(result.percentage).toBeLessThan(100);
    });
  });
});
