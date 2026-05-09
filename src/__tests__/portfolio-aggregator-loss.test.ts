/**
 * Tests for portfolio-aggregator — loss integration (Sprint 12-B extension).
 */

import { describe, expect, it } from "vitest";
import { aggregatePortfolio, type ProjectPortfolioEntry } from "../lib/exec-dashboard/portfolio-aggregator.js";
import type { Project } from "../domain/types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeProject(id: string): Project {
  return {
    id,
    name: `案件-${id}`,
    description: "",
    status: "active",
    startDate: "2025-01-01",
    budget: 10_000_000,
    includeWeekends: false,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

function emptyEntry(project: Project): ProjectPortfolioEntry {
  return {
    project,
    tasks: [],
    invoices: [],
    chatMessages: [],
    photos: [],
  };
}

// ── totalLossYen ──────────────────────────────────────────────────────────

describe("aggregatePortfolio — totalLossYen", () => {
  it("エントリなし → totalLossYen = 0", () => {
    const summary = aggregatePortfolio([]);
    expect(summary.totalLossYen).toBe(0);
  });

  it("totalLossYen 未指定のエントリ → 0 として扱う", () => {
    const summary = aggregatePortfolio([emptyEntry(makeProject("p1"))]);
    expect(summary.totalLossYen).toBe(0);
  });

  it("1 プロジェクトの totalLossYen を集計する", () => {
    const entry: ProjectPortfolioEntry = {
      ...emptyEntry(makeProject("p1")),
      totalLossYen: 200_000,
    };
    const summary = aggregatePortfolio([entry]);
    expect(summary.totalLossYen).toBe(200_000);
  });

  it("複数プロジェクトの totalLossYen を合算する", () => {
    const entries: ProjectPortfolioEntry[] = [
      { ...emptyEntry(makeProject("p1")), totalLossYen: 100_000 },
      { ...emptyEntry(makeProject("p2")), totalLossYen: 50_000 },
      { ...emptyEntry(makeProject("p3")), totalLossYen: 75_000 },
    ];
    const summary = aggregatePortfolio(entries);
    expect(summary.totalLossYen).toBe(225_000);
  });
});

// ── criticalLossCount ─────────────────────────────────────────────────────

describe("aggregatePortfolio — criticalLossCount", () => {
  it("エントリなし → criticalLossCount = 0", () => {
    const summary = aggregatePortfolio([]);
    expect(summary.criticalLossCount).toBe(0);
  });

  it("criticalLossCount 未指定のエントリ → 0 として扱う", () => {
    const summary = aggregatePortfolio([emptyEntry(makeProject("p1"))]);
    expect(summary.criticalLossCount).toBe(0);
  });

  it("1 プロジェクトの criticalLossCount を集計する", () => {
    const entry: ProjectPortfolioEntry = {
      ...emptyEntry(makeProject("p1")),
      criticalLossCount: 3,
    };
    const summary = aggregatePortfolio([entry]);
    expect(summary.criticalLossCount).toBe(3);
  });

  it("複数プロジェクトの criticalLossCount を合算する", () => {
    const entries: ProjectPortfolioEntry[] = [
      { ...emptyEntry(makeProject("p1")), criticalLossCount: 2 },
      { ...emptyEntry(makeProject("p2")), criticalLossCount: 1 },
      { ...emptyEntry(makeProject("p3")), criticalLossCount: 0 },
    ];
    const summary = aggregatePortfolio(entries);
    expect(summary.criticalLossCount).toBe(3);
  });
});

// ── 既存フィールドの非破壊テスト ──────────────────────────────────────────

describe("aggregatePortfolio — 既存フィールド非破壊確認", () => {
  it("loss フィールド追加後も totalProjects が正しい", () => {
    const entries = [
      { ...emptyEntry(makeProject("p1")), totalLossYen: 10_000 },
      { ...emptyEntry(makeProject("p2")), totalLossYen: 20_000 },
    ];
    expect(aggregatePortfolio(entries).totalProjects).toBe(2);
  });

  it("loss フィールド追加後も dangerProjectCount が計算される", () => {
    const entries = [emptyEntry(makeProject("p1"))];
    const summary = aggregatePortfolio(entries);
    expect(typeof summary.dangerProjectCount).toBe("number");
  });
});
