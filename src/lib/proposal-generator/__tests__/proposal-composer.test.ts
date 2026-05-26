/**
 * proposal-composer unit tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { compose, _resetComposerIdCounter } from "../proposal-composer.js";
import type {
  ProposalGenerationInput,
  ProposalGenerationOptions,
  LaportaStrength,
  CaseStudy,
  DifferentiationPoint,
} from "../types.js";

beforeEach(() => {
  _resetComposerIdCounter();
});

function makeInput(overrides: Partial<ProposalGenerationInput> = {}): ProposalGenerationInput {
  return {
    customerName: "田中花子",
    workCategory: "full_renovation",
    workScale: "medium",
    locationCity: "世田谷区",
    ...overrides,
  };
}

const DEFAULT_OPTS: ProposalGenerationOptions = {
  includeCases: true,
  includeDifferentiation: true,
  language: "ja",
};

const sampleStrengths: LaportaStrength[] = [
  { id: "str-001", titleJa: "世田谷区密着25年", bodyJa: "説明A", weight: 0.8 },
  { id: "str-002", titleJa: "内装専門特化", bodyJa: "説明B", weight: 0.9 },
  { id: "str-003", titleJa: "自社職人多数", bodyJa: "説明C", weight: 0.85 },
];

const sampleCases: CaseStudy[] = [
  {
    id: "case-001",
    projectName: "テスト案件1",
    workCategory: "full_renovation",
    workScale: "medium",
    scaleJa: "中規模",
    completedYearMonth: "2025-06",
    anonymizedClient: "世田谷区K様邸",
    summaryJa: "概要1",
    achievementJa: "実績1",
  },
];

const sampleDiff: DifferentiationPoint[] = [
  {
    id: "diff-001",
    axisJa: "価格",
    laportaPositionJa: "ラポルタ優位",
    competitorPositionJa: "競合劣位",
    advantageJa: "優位性説明",
  },
];

describe("compose", () => {
  it("ProposalDocument を返す", () => {
    const doc = compose(makeInput(), DEFAULT_OPTS, {
      strengths: sampleStrengths,
      cases: sampleCases,
      diffPoints: sampleDiff,
    });
    expect(doc).toBeDefined();
    expect(doc.id).toBeTruthy();
  });

  it("customerName が引き継がれる", () => {
    const doc = compose(makeInput({ customerName: "佐藤太郎" }), DEFAULT_OPTS, {
      strengths: sampleStrengths,
      cases: sampleCases,
      diffPoints: sampleDiff,
    });
    expect(doc.customerName).toBe("佐藤太郎");
  });

  it("sections にカバーページが含まれる", () => {
    const doc = compose(makeInput(), DEFAULT_OPTS, {
      strengths: sampleStrengths,
      cases: sampleCases,
      diffPoints: sampleDiff,
    });
    expect(doc.sections.some((s) => s.kind === "cover")).toBe(true);
  });

  it("sections に our_strengths が含まれる", () => {
    const doc = compose(makeInput(), DEFAULT_OPTS, {
      strengths: sampleStrengths,
      cases: sampleCases,
      diffPoints: sampleDiff,
    });
    expect(doc.sections.some((s) => s.kind === "our_strengths")).toBe(true);
  });

  it("includeCases=false のとき case_studies セクションがない", () => {
    const opts = { ...DEFAULT_OPTS, includeCases: false };
    const doc = compose(makeInput(), opts, {
      strengths: sampleStrengths,
      cases: sampleCases,
      diffPoints: sampleDiff,
    });
    expect(doc.sections.some((s) => s.kind === "case_studies")).toBe(false);
  });

  it("includeDifferentiation=false のとき differentiation セクションがない", () => {
    const opts = { ...DEFAULT_OPTS, includeDifferentiation: false };
    const doc = compose(makeInput(), opts, {
      strengths: sampleStrengths,
      cases: sampleCases,
      diffPoints: sampleDiff,
    });
    expect(doc.sections.some((s) => s.kind === "differentiation")).toBe(false);
  });

  it("price_range セクションが含まれる", () => {
    const doc = compose(makeInput(), DEFAULT_OPTS, {
      strengths: sampleStrengths,
      cases: sampleCases,
      diffPoints: sampleDiff,
    });
    expect(doc.sections.some((s) => s.kind === "price_range")).toBe(true);
  });

  it("schedule セクションが含まれる", () => {
    const doc = compose(makeInput(), DEFAULT_OPTS, {
      strengths: sampleStrengths,
      cases: sampleCases,
      diffPoints: sampleDiff,
    });
    expect(doc.sections.some((s) => s.kind === "schedule")).toBe(true);
  });

  it("next_step と appendix が含まれる", () => {
    const doc = compose(makeInput(), DEFAULT_OPTS, {
      strengths: sampleStrengths,
      cases: sampleCases,
      diffPoints: sampleDiff,
    });
    expect(doc.sections.some((s) => s.kind === "next_step")).toBe(true);
    expect(doc.sections.some((s) => s.kind === "appendix")).toBe(true);
  });

  it("totalPriceJpyLower <= totalPriceJpyUpper", () => {
    const doc = compose(makeInput(), DEFAULT_OPTS, {
      strengths: sampleStrengths,
      cases: sampleCases,
      diffPoints: sampleDiff,
    });
    expect(doc.totalPriceJpyLower).toBeLessThanOrEqual(doc.totalPriceJpyUpper);
  });

  it("durationDays が正の整数", () => {
    const doc = compose(makeInput(), DEFAULT_OPTS, {
      strengths: sampleStrengths,
      cases: sampleCases,
      diffPoints: sampleDiff,
    });
    expect(doc.durationDays).toBeGreaterThan(0);
  });

  it("validUntil が generatedAt より後", () => {
    const doc = compose(makeInput(), DEFAULT_OPTS, {
      strengths: sampleStrengths,
      cases: sampleCases,
      diffPoints: sampleDiff,
    });
    expect(new Date(doc.validUntil) > new Date(doc.generatedAt)).toBe(true);
  });

  it("{{customerName}} プレースホルダーが展開される", () => {
    const doc = compose(makeInput({ customerName: "山田次郎" }), DEFAULT_OPTS, {
      strengths: sampleStrengths,
      cases: sampleCases,
      diffPoints: sampleDiff,
    });
    const coverSection = doc.sections.find((s) => s.kind === "cover");
    expect(coverSection?.bodyJa).toContain("山田次郎");
    expect(coverSection?.bodyJa).not.toContain("{{customerName}}");
  });

  it("inquiryId / dealId が引き継がれる", () => {
    const doc = compose(
      makeInput({ inquiryId: "inq-001", dealId: "deal-001" }),
      DEFAULT_OPTS,
      { strengths: sampleStrengths, cases: sampleCases, diffPoints: sampleDiff },
    );
    expect(doc.inquiryId).toBe("inq-001");
    expect(doc.dealId).toBe("deal-001");
  });
});
