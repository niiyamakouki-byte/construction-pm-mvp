/**
 * Tests for score-explainer.
 */

import { describe, expect, it } from "vitest";
import { explainScore_ja } from "../score-explainer.js";
import type { ProfitRankingEntry, ProjectProfitMetrics } from "../types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeEntry(
  badge: ProfitRankingEntry["badge"],
  rank: number,
  metricOverrides: Partial<ProjectProfitMetrics> = {},
): ProfitRankingEntry {
  const m: ProjectProfitMetrics = {
    projectId: "p1",
    projectName: "案件A",
    orderAmount: 10_000_000,
    actualCost: 6_500_000,
    forecastCost: 7_000_000,
    marginAmount: 3_500_000,
    marginRatioPct: 35,
    forecastMarginRatioPct: 30,
    durationMonths: 6,
    marginPerMonth: 583_333,
    clientName: "顧客A",
    projectKind: "内装工事",
    ...metricOverrides,
  };
  return { rank, projectMetrics: m, scoreContribution: 80, badge };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("explainScore_ja - warning badge", () => {
  it("warning badge → 要注意メッセージを含む", () => {
    const entry = makeEntry("warning", 5, { marginRatioPct: 10, forecastMarginRatioPct: 8 });
    const result = explainScore_ja(entry);
    expect(result).toMatch(/要注意|赤字リスク/);
  });

  it("予測粗利が実粗利より低い → 低下メッセージを含む", () => {
    const entry = makeEntry("warning", 3, {
      marginRatioPct: 14,
      forecastMarginRatioPct: 10,
    });
    const result = explainScore_ja(entry);
    expect(result).toMatch(/低下|赤字リスク/);
  });

  it("粗利率が文字列に含まれる", () => {
    const entry = makeEntry("warning", 5, { marginRatioPct: 12, forecastMarginRatioPct: 8 });
    const result = explainScore_ja(entry);
    expect(result).toMatch(/12%/);
  });
});

describe("explainScore_ja - top badge", () => {
  it("top badge → rank番号を含む", () => {
    const entry = makeEntry("top", 1);
    const result = explainScore_ja(entry);
    expect(result).toMatch(/1位/);
  });

  it("工期3ヶ月以下 → 工期短縮メッセージ", () => {
    const entry = makeEntry("top", 2, { durationMonths: 2 });
    const result = explainScore_ja(entry);
    expect(result).toMatch(/工期短縮/);
  });

  it("工期6ヶ月 → 高粗利重点案件メッセージ", () => {
    const entry = makeEntry("top", 1, { durationMonths: 6 });
    const result = explainScore_ja(entry);
    expect(result).toMatch(/高粗利重点案件/);
  });

  it("粗利率が文字列に含まれる", () => {
    const entry = makeEntry("top", 1, { marginRatioPct: 40 });
    const result = explainScore_ja(entry);
    expect(result).toMatch(/40%/);
  });
});

describe("explainScore_ja - stable badge", () => {
  it("安定 → 安定推移中メッセージ", () => {
    const entry = makeEntry("stable", 4, {
      marginRatioPct: 28,
      forecastMarginRatioPct: 29,
    });
    const result = explainScore_ja(entry);
    expect(result).toMatch(/安定推移中/);
  });

  it("予測改善傾向 (+2超) → 予測改善メッセージ", () => {
    const entry = makeEntry("stable", 4, {
      marginRatioPct: 25,
      forecastMarginRatioPct: 30,
    });
    const result = explainScore_ja(entry);
    expect(result).toMatch(/予測改善中/);
  });

  it("予測悪化傾向 (-2未満) → 予測悪化メッセージ", () => {
    const entry = makeEntry("stable", 4, {
      marginRatioPct: 30,
      forecastMarginRatioPct: 25,
    });
    const result = explainScore_ja(entry);
    expect(result).toMatch(/予測悪化傾向/);
  });

  it("文字列は空でない", () => {
    const entry = makeEntry("stable", 5);
    const result = explainScore_ja(entry);
    expect(result.length).toBeGreaterThan(0);
  });
});
