/**
 * rule-based-fallback.ts のテスト (Sprint 12-A)
 */
import { describe, it, expect } from "vitest";
import { RULE_BASED_GUIDES } from "../lib/site-ai-assistant/rule-based-fallback.js";
import { IssueCategory } from "../lib/site-ai-assistant/types.js";

describe("RULE_BASED_GUIDES", () => {
  it("全8カテゴリのガイドが定義されている", () => {
    const categories = Object.values(IssueCategory);
    expect(categories.length).toBe(8);
    for (const cat of categories) {
      expect(RULE_BASED_GUIDES[cat]).toBeDefined();
    }
  });

  it("material_shortage は3手順を持つ", () => {
    expect(RULE_BASED_GUIDES[IssueCategory.material_shortage].steps).toHaveLength(3);
  });

  it("weather_delay は3手順を持つ", () => {
    expect(RULE_BASED_GUIDES[IssueCategory.weather_delay].steps).toHaveLength(3);
  });

  it("tool_breakdown は3手順を持つ", () => {
    expect(RULE_BASED_GUIDES[IssueCategory.tool_breakdown].steps).toHaveLength(3);
  });

  it("coordination は3手順を持つ", () => {
    expect(RULE_BASED_GUIDES[IssueCategory.coordination].steps).toHaveLength(3);
  });

  it("safety_concern は3手順を持つ", () => {
    expect(RULE_BASED_GUIDES[IssueCategory.safety_concern].steps).toHaveLength(3);
  });

  it("quality_issue は3手順を持つ", () => {
    expect(RULE_BASED_GUIDES[IssueCategory.quality_issue].steps).toHaveLength(3);
  });

  it("client_request は3手順を持つ", () => {
    expect(RULE_BASED_GUIDES[IssueCategory.client_request].steps).toHaveLength(3);
  });

  it("other は3手順を持つ", () => {
    expect(RULE_BASED_GUIDES[IssueCategory.other].steps).toHaveLength(3);
  });

  it("各ガイドの category フィールドが正しい", () => {
    for (const [cat, guide] of Object.entries(RULE_BASED_GUIDES)) {
      expect(guide.category).toBe(cat);
    }
  });

  it("各ガイドに summary が存在する", () => {
    for (const guide of Object.values(RULE_BASED_GUIDES)) {
      expect(guide.summary.length).toBeGreaterThan(0);
    }
  });

  it("material_shortage の1番目の手順に「仕入先」が含まれる", () => {
    expect(RULE_BASED_GUIDES[IssueCategory.material_shortage].steps[0]).toContain("仕入先");
  });

  it("safety_concern の1番目の手順に「立入禁止」が含まれる", () => {
    expect(RULE_BASED_GUIDES[IssueCategory.safety_concern].steps[0]).toContain("立入禁止");
  });

  it("client_request の1番目の手順に「書面」が含まれる", () => {
    expect(RULE_BASED_GUIDES[IssueCategory.client_request].steps[0]).toContain("書面");
  });
});
