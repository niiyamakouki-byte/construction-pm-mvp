/**
 * Tests for ranker.
 */

import { describe, expect, it } from "vitest";
import { rankProjects } from "../ranker.js";
import type { ProjectProfitMetrics } from "../types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeMetrics(
  id: string,
  overrides: Partial<ProjectProfitMetrics> = {},
): ProjectProfitMetrics {
  return {
    projectId: id,
    projectName: `案件${id}`,
    orderAmount: 10_000_000,
    actualCost: 7_000_000,
    forecastCost: 7_500_000,
    marginAmount: 3_000_000,
    marginRatioPct: 30,
    forecastMarginRatioPct: 25,
    durationMonths: 6,
    marginPerMonth: 500_000,
    clientName: "顧客A",
    projectKind: "内装工事",
    ...overrides,
  };
}

// ── 基本ソート ─────────────────────────────────────────────────────────────

describe("rankProjects - 基本ソート", () => {
  it("空配列 → 空配列を返す", () => {
    expect(rankProjects([], "marginRatioPct")).toHaveLength(0);
  });

  it("1件 → rank=1", () => {
    const entries = rankProjects([makeMetrics("p1")], "marginRatioPct");
    expect(entries).toHaveLength(1);
    expect(entries[0].rank).toBe(1);
  });

  it("marginRatioPct で降順ソート", () => {
    const m1 = makeMetrics("p1", { marginRatioPct: 40 });
    const m2 = makeMetrics("p2", { marginRatioPct: 20 });
    const m3 = makeMetrics("p3", { marginRatioPct: 35 });
    const entries = rankProjects([m1, m2, m3], "marginRatioPct");
    expect(entries[0].projectMetrics.projectId).toBe("p1");
    expect(entries[1].projectMetrics.projectId).toBe("p3");
    expect(entries[2].projectMetrics.projectId).toBe("p2");
  });

  it("marginAmount で降順ソート", () => {
    const m1 = makeMetrics("p1", { marginAmount: 5_000_000 });
    const m2 = makeMetrics("p2", { marginAmount: 2_000_000 });
    const entries = rankProjects([m1, m2], "marginAmount");
    expect(entries[0].projectMetrics.projectId).toBe("p1");
  });

  it("marginPerMonth で降順ソート", () => {
    const m1 = makeMetrics("p1", { marginPerMonth: 1_000_000 });
    const m2 = makeMetrics("p2", { marginPerMonth: 300_000 });
    const entries = rankProjects([m1, m2], "marginPerMonth");
    expect(entries[0].projectMetrics.projectId).toBe("p1");
  });

  it("forecastDelta で降順ソート (forecast - actual)", () => {
    // m1: forecastDelta = 30 - 20 = +10
    const m1 = makeMetrics("p1", { marginRatioPct: 20, forecastMarginRatioPct: 30 });
    // m2: forecastDelta = 25 - 25 = 0
    const m2 = makeMetrics("p2", { marginRatioPct: 25, forecastMarginRatioPct: 25 });
    const entries = rankProjects([m1, m2], "forecastDelta");
    expect(entries[0].projectMetrics.projectId).toBe("p1");
  });
});

// ── limit ──────────────────────────────────────────────────────────────────

describe("rankProjects - limit", () => {
  it("limit=2 → 2件のみ返す", () => {
    const entries = rankProjects(
      [makeMetrics("a"), makeMetrics("b"), makeMetrics("c")],
      "marginRatioPct",
      2,
    );
    expect(entries).toHaveLength(2);
  });

  it("limit=undefined → 全件返す", () => {
    const entries = rankProjects(
      [makeMetrics("a"), makeMetrics("b"), makeMetrics("c")],
      "marginRatioPct",
    );
    expect(entries).toHaveLength(3);
  });
});

// ── badge ──────────────────────────────────────────────────────────────────

describe("rankProjects - badge", () => {
  it("rank 1–3 は top badge", () => {
    const metrics = ["a", "b", "c", "d"].map((id, i) =>
      makeMetrics(id, { marginRatioPct: 40 - i * 5 }),
    );
    const entries = rankProjects(metrics, "marginRatioPct");
    expect(entries[0].badge).toBe("top");
    expect(entries[1].badge).toBe("top");
    expect(entries[2].badge).toBe("top");
    expect(entries[3].badge).toBe("stable");
  });

  it("marginRatioPct < 15 → warning badge (どんな rank でも)", () => {
    const m = makeMetrics("p-warn", {
      marginRatioPct: 10,
      forecastMarginRatioPct: 8,
    });
    const entries = rankProjects([m], "marginRatioPct");
    expect(entries[0].badge).toBe("warning");
  });

  it("forecastMarginRatioPct < 15 → warning badge", () => {
    const m = makeMetrics("p-forecast-warn", {
      marginRatioPct: 30,
      forecastMarginRatioPct: 12,
    });
    const entries = rankProjects([m], "marginRatioPct");
    expect(entries[0].badge).toBe("warning");
  });

  it("rank > 3 かつ margin 正常 → stable badge", () => {
    const metrics = ["a", "b", "c", "d"].map((id, i) =>
      makeMetrics(id, { marginRatioPct: 40 - i * 2 }),
    );
    const entries = rankProjects(metrics, "marginRatioPct");
    expect(entries[3].badge).toBe("stable");
  });
});

// ── tie handling ───────────────────────────────────────────────────────────

describe("rankProjects - タイ処理", () => {
  it("同率の場合は同じ rank を共有する", () => {
    const m1 = makeMetrics("p1", { marginRatioPct: 30 });
    const m2 = makeMetrics("p2", { marginRatioPct: 30 });
    const m3 = makeMetrics("p3", { marginRatioPct: 20 });
    const entries = rankProjects([m1, m2, m3], "marginRatioPct");
    expect(entries[0].rank).toBe(1);
    expect(entries[1].rank).toBe(1);
    expect(entries[2].rank).toBe(3);
  });
});

// ── scoreContribution ──────────────────────────────────────────────────────

describe("rankProjects - scoreContribution", () => {
  it("最高スコアの案件は scoreContribution=100", () => {
    const m1 = makeMetrics("p1", { marginRatioPct: 50 });
    const m2 = makeMetrics("p2", { marginRatioPct: 25 });
    const entries = rankProjects([m1, m2], "marginRatioPct");
    expect(entries[0].scoreContribution).toBe(100);
    expect(entries[1].scoreContribution).toBe(50);
  });
});
