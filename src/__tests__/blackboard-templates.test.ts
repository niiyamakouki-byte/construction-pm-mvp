import { describe, it, expect } from "vitest";
import {
  INTERIOR_TEMPLATES,
  getTemplatesByCategory,
  getTemplateCount,
  type InteriorTemplate,
} from "../lib/digital-blackboard.js";

describe("INTERIOR_TEMPLATES", () => {
  it("contains exactly 50 templates", () => {
    expect(getTemplateCount()).toBe(50);
    expect(INTERIOR_TEMPLATES).toHaveLength(50);
  });

  it("all templates have required fields: id, category, workType, shootPoints, requiredFields", () => {
    for (const tpl of INTERIOR_TEMPLATES) {
      expect(tpl.id).toBeTruthy();
      expect(tpl.category).toBeTruthy();
      expect(tpl.workType).toBeTruthy();
      expect(Array.isArray(tpl.shootPoints)).toBe(true);
      expect(tpl.shootPoints.length).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(tpl.requiredFields)).toBe(true);
      expect(tpl.requiredFields.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("all template IDs are unique", () => {
    const ids = INTERIOR_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all shoot points arrays contain exactly 3 items", () => {
    for (const tpl of INTERIOR_TEMPLATES) {
      expect(tpl.shootPoints).toHaveLength(3);
    }
  });
});

describe("getTemplatesByCategory", () => {
  const EXPECTED_COUNTS: Record<string, number> = {
    解体: 5,
    下地: 8,
    仕上: 10,
    建具: 5,
    設備: 8,
    外装: 5,
    家具: 4,
    その他: 5,
  };

  for (const [category, count] of Object.entries(EXPECTED_COUNTS)) {
    it(`returns ${count} templates for category "${category}"`, () => {
      const result = getTemplatesByCategory(category);
      expect(result).toHaveLength(count);
    });
  }

  it("returns empty array for unknown category", () => {
    expect(getTemplatesByCategory("存在しないカテゴリ")).toEqual([]);
  });

  it("each returned template belongs to the requested category", () => {
    const result = getTemplatesByCategory("仕上");
    for (const tpl of result) {
      expect(tpl.category).toBe("仕上");
    }
  });

  it("returned objects are InteriorTemplate type with all required properties", () => {
    const result = getTemplatesByCategory("解体");
    for (const tpl of result) {
      const typed: InteriorTemplate = tpl;
      expect(typed.id).toBeTruthy();
      expect(typed.workType).toBeTruthy();
    }
  });
});

describe("getTemplateCount", () => {
  it("returns 50", () => {
    expect(getTemplateCount()).toBe(50);
  });

  it("matches INTERIOR_TEMPLATES array length", () => {
    expect(getTemplateCount()).toBe(INTERIOR_TEMPLATES.length);
  });
});
