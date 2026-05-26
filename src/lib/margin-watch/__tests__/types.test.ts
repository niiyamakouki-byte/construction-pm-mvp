/**
 * Smoke tests for margin-watch types.
 */

import { describe, expect, it } from "vitest";
import type { MarginAlertLevel, ProjectFinanceSnapshot, MarginAlert, MarginWatchConfig } from "../types.js";
import { DEFAULT_MARGIN_WATCH_CONFIG } from "../types.js";

describe("MarginAlertLevel", () => {
  it("valid level values", () => {
    const levels: MarginAlertLevel[] = ["safe", "caution", "warning", "critical"];
    expect(levels).toHaveLength(4);
  });
});

describe("DEFAULT_MARGIN_WATCH_CONFIG", () => {
  it("targetMarginPct defaults to 25", () => {
    expect(DEFAULT_MARGIN_WATCH_CONFIG.targetMarginPct).toBe(25);
  });

  it("criticalMarginPct defaults to 15", () => {
    expect(DEFAULT_MARGIN_WATCH_CONFIG.criticalMarginPct).toBe(15);
  });

  it("cautionMarginPct defaults to 30", () => {
    expect(DEFAULT_MARGIN_WATCH_CONFIG.cautionMarginPct).toBe(30);
  });
});

describe("ProjectFinanceSnapshot shape", () => {
  it("can create a valid snapshot", () => {
    const snap: ProjectFinanceSnapshot = {
      projectId: "p1",
      projectName: "テスト案件",
      contractAmountYen: 10_000_000,
      totalCostYen: 6_000_000,
      estimatedRemainingCostYen: 1_000_000,
      marginRatioPct: 40,
      forecastMarginRatioPct: 30,
    };
    expect(snap.projectId).toBe("p1");
    expect(snap.contractAmountYen).toBe(10_000_000);
  });
});

describe("MarginAlert shape", () => {
  it("can create a valid alert", () => {
    const alert: MarginAlert = {
      id: "ma-1",
      projectId: "p1",
      projectName: "テスト案件",
      level: "warning",
      marginRatioPct: 22,
      forecastMarginRatioPct: 20,
      deltaFromTargetPct: -5,
      causeTag: ["原価増"],
      suggestedAction_ja: "週次レビュー対象。粗利改善案を3つ用意",
      raisedAt: new Date().toISOString(),
    };
    expect(alert.level).toBe("warning");
    expect(alert.deltaFromTargetPct).toBe(-5);
  });
});

describe("MarginWatchConfig shape", () => {
  it("can create a custom config", () => {
    const config: MarginWatchConfig = {
      targetMarginPct: 30,
      criticalMarginPct: 10,
      cautionMarginPct: 35,
    };
    expect(config.targetMarginPct).toBe(30);
  });
});
