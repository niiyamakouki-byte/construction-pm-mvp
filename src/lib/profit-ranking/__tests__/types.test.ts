/**
 * Smoke tests for profit-ranking types.
 */

import { describe, expect, it } from "vitest";
import type {
  ProjectProfitMetrics,
  ProfitRankingEntry,
  ProfitRankingSnapshot,
  RankingSortKey,
  RankingBadge,
} from "../types.js";

describe("RankingSortKey values", () => {
  it("accepts all four sort keys", () => {
    const keys: RankingSortKey[] = ["marginRatioPct", "marginAmount", "marginPerMonth", "forecastDelta"];
    expect(keys).toHaveLength(4);
  });
});

describe("RankingBadge values", () => {
  it("accepts top / warning / stable", () => {
    const badges: RankingBadge[] = ["top", "warning", "stable"];
    expect(badges).toHaveLength(3);
  });
});

describe("ProjectProfitMetrics shape", () => {
  it("can create a valid metrics object", () => {
    const m: ProjectProfitMetrics = {
      projectId: "p1",
      projectName: "新築案件A",
      orderAmount: 10_000_000,
      actualCost: 6_500_000,
      forecastCost: 7_000_000,
      marginAmount: 3_500_000,
      marginRatioPct: 35,
      forecastMarginRatioPct: 30,
      durationMonths: 6,
      marginPerMonth: 3_500_000 / 6,
      clientName: "株式会社テスト",
      projectKind: "内装工事",
    };
    expect(m.projectId).toBe("p1");
    expect(m.marginRatioPct).toBe(35);
  });
});

describe("ProfitRankingEntry shape", () => {
  it("can create a valid entry", () => {
    const m: ProjectProfitMetrics = {
      projectId: "p2",
      projectName: "案件B",
      orderAmount: 5_000_000,
      actualCost: 3_000_000,
      forecastCost: 3_500_000,
      marginAmount: 2_000_000,
      marginRatioPct: 40,
      forecastMarginRatioPct: 30,
      durationMonths: 3,
      marginPerMonth: 666_666,
      clientName: "顧客B",
      projectKind: "リノベーション",
    };
    const entry: ProfitRankingEntry = {
      rank: 1,
      projectMetrics: m,
      scoreContribution: 100,
      badge: "top",
    };
    expect(entry.rank).toBe(1);
    expect(entry.badge).toBe("top");
  });
});

describe("ProfitRankingSnapshot shape", () => {
  it("can create a valid snapshot", () => {
    const snap: ProfitRankingSnapshot = {
      entries: [],
      generatedAt: new Date().toISOString(),
      sortKey: "marginRatioPct",
      totalProjects: 0,
      avgMarginRatioPct: 0,
    };
    expect(snap.totalProjects).toBe(0);
    expect(snap.sortKey).toBe("marginRatioPct");
  });
});
