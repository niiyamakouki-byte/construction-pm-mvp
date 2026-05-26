/**
 * suggestion-pdf-builder.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  renderSuggestionMarkdown,
  renderSuggestionHtml,
  renderSuggestionPdfData,
  renderSuggestion,
  buildPlanComparison,
} from "../suggestion-pdf-builder.js";
import type { OwnerSuggestion } from "../types.js";
import { makeOwnerSuggestionId } from "../types.js";

function makeSuggestion(): OwnerSuggestion {
  return {
    id: makeOwnerSuggestionId("os-test-1"),
    projectId: "proj-001",
    ownerProfile: {
      ownerName: "山田太郎",
      budget: 8000000,
      familySize: 3,
      ageRange: "40s",
      lifestyle: ["cooking", "pet_owner"],
      priorityRanking: "qualityFirst",
    },
    plans: [
      {
        id: "p1", kind: "budget_focused", status: "draft", titleJa: "コストプラン",
        conceptJa: "コストを重視したプランです。", estimatedCost: 6800000, estimatedDays: 45,
        rationaleJa: "料理好きとペット飼育を考慮。",
        materialHighlights: [{ location: "床材", materialName: "CFシート", featureJa: "耐水性" }],
        maintenanceForecast: [{ intervalMonths: 12, descriptionJa: "年次点検" }],
        riskNotes: ["コストプランのリスク"],
      },
      {
        id: "p2", kind: "balanced", status: "draft", titleJa: "バランスプラン",
        conceptJa: "バランスを重視したプランです。", estimatedCost: 8000000, estimatedDays: 55,
        rationaleJa: "バランス根拠。",
        materialHighlights: [{ location: "LDK壁紙", materialName: "1000番クロス", featureJa: "コスパ良" }],
        maintenanceForecast: [{ intervalMonths: 6, descriptionJa: "半年点検" }],
        riskNotes: [],
      },
      {
        id: "p3", kind: "premium", status: "draft", titleJa: "プレミアムプラン",
        conceptJa: "上質な素材を使用したプランです。", estimatedCost: 9600000, estimatedDays: 70,
        rationaleJa: "プレミアム根拠。",
        materialHighlights: [{ location: "床", materialName: "無垢フロア", featureJa: "高品質" }],
        maintenanceForecast: [{ intervalMonths: 60, descriptionJa: "5年点検" }],
        riskNotes: ["予算超過リスク"],
      },
    ],
    generatedAt: "2025-05-01T00:00:00.000Z",
  };
}

describe("renderSuggestionMarkdown", () => {
  it("施主名が含まれる", () => {
    const md = renderSuggestionMarkdown(makeSuggestion());
    expect(md).toContain("山田太郎");
  });

  it("3案比較表が含まれる", () => {
    const md = renderSuggestionMarkdown(makeSuggestion());
    expect(md).toContain("3案比較");
  });

  it("材料ハイライトが含まれる", () => {
    const md = renderSuggestionMarkdown(makeSuggestion());
    expect(md).toContain("材料ハイライト");
  });

  it("メンテナンス計画が含まれる", () => {
    const md = renderSuggestionMarkdown(makeSuggestion());
    expect(md).toContain("メンテナンス計画");
  });

  it("presentedAt がある場合は提示日が含まれる", () => {
    const s = makeSuggestion();
    s.presentedAt = "2025-05-10T00:00:00.000Z";
    const md = renderSuggestionMarkdown(s);
    expect(md).toContain("提示日");
  });
});

describe("renderSuggestionHtml", () => {
  it("DOCTYPE html が含まれる", () => {
    const html = renderSuggestionHtml(makeSuggestion());
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("v2-cozy カラー #6B8E5A が含まれる", () => {
    const html = renderSuggestionHtml(makeSuggestion());
    expect(html).toContain("#6B8E5A");
  });

  it("施主名がタイトルに含まれる", () => {
    const html = renderSuggestionHtml(makeSuggestion());
    expect(html).toContain("山田太郎");
  });
});

describe("renderSuggestionPdfData", () => {
  it("Markdown と同じ内容を返す", () => {
    const s = makeSuggestion();
    expect(renderSuggestionPdfData(s)).toBe(renderSuggestionMarkdown(s));
  });
});

describe("renderSuggestion dispatch", () => {
  it("markdown で renderMarkdown を呼ぶ", () => {
    const s = makeSuggestion();
    const result = renderSuggestion(s, "markdown");
    expect(result).toContain("# 施主提案書");
  });

  it("html で renderHtml を呼ぶ", () => {
    const s = makeSuggestion();
    const result = renderSuggestion(s, "html");
    expect(result).toContain("<!DOCTYPE html>");
  });

  it("pdf_data で Markdown ベースの文字列を返す", () => {
    const s = makeSuggestion();
    const result = renderSuggestion(s, "pdf_data");
    expect(result).toContain("施主提案書");
  });
});

describe("buildPlanComparison", () => {
  it("3件の比較データを返す", () => {
    const comparison = buildPlanComparison(makeSuggestion());
    expect(comparison).toHaveLength(3);
  });

  it("budgetGap が正しく計算される (plan[0]: budget_focused)", () => {
    const comparison = buildPlanComparison(makeSuggestion());
    expect(comparison[0].budgetGap).toBe(6800000 - 8000000); // -1200000
  });

  it("各比較エントリは caseStudies を持つ", () => {
    const comparison = buildPlanComparison(makeSuggestion());
    for (const c of comparison) {
      expect(c.caseStudies).toHaveLength(3);
    }
  });
});
