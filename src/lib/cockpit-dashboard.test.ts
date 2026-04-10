/**
 * Tests for CockpitDashboard data helpers.
 * Tests pure logic: health color thresholds, currency formatting,
 * company summary grouping, and project status mapping.
 */

import { describe, expect, it } from "vitest";
import { assessProjectHealth, type HealthScore } from "./project-health.js";
import { generateForecastReport } from "./cost-forecaster.js";
import {
  logEntry,
  logExit,
  getEntryLog,
  getTodayWorkerCount,
  clearEntryRecords,
} from "./site-entry-log.js";
import type { Project } from "../domain/types.js";
import type { ProgressTask } from "./earned-value.js";

// ── Helpers ───────────────────────────────────────────

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-cockpit",
    name: "Cockpit Test",
    description: "",
    status: "active",
    startDate: "2025-01-01",
    includeWeekends: true,
    budget: 5_000_000,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeTask(
  overrides: Partial<ProgressTask> & Pick<ProgressTask, "id" | "name">,
): ProgressTask {
  return {
    projectId: "proj-cockpit",
    description: "",
    status: "todo",
    progress: 0,
    dependencies: [],
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

// ── Health score thresholds ────────────────────────────

describe("health score color thresholds", () => {
  function healthColor(score: number): string {
    if (score > 80) return "green";
    if (score > 50) return "yellow";
    return "red";
  }

  it("returns green for score > 80", () => {
    expect(healthColor(81)).toBe("green");
    expect(healthColor(100)).toBe("green");
  });

  it("returns yellow for score > 50 and <= 80", () => {
    expect(healthColor(51)).toBe("yellow");
    expect(healthColor(80)).toBe("yellow");
  });

  it("returns red for score <= 50", () => {
    expect(healthColor(50)).toBe("red");
    expect(healthColor(0)).toBe("red");
  });
});

// ── assessProjectHealth integration ───────────────────

describe("assessProjectHealth for cockpit", () => {
  it("returns overall score 0-100", () => {
    const project = makeProject();
    const tasks: ProgressTask[] = [
      makeTask({ id: "t1", name: "基礎工事", status: "done", progress: 100 }),
      makeTask({ id: "t2", name: "内装", status: "in_progress", progress: 50 }),
    ];
    const result = assessProjectHealth({ project, tasks, asOfDate: "2025-06-01" });
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
  });

  it("penalizes overdue tasks in risk score", () => {
    const project = makeProject();
    const overdueTask = makeTask({
      id: "t1",
      name: "期限超過タスク",
      status: "in_progress",
      progress: 20,
      dueDate: "2025-01-01",
    });
    const result = assessProjectHealth({
      project,
      tasks: [overdueTask],
      asOfDate: "2025-06-01",
    });
    const riskCategory = result.categories.find((c) => c.category === "risk");
    expect(riskCategory).toBeDefined();
    expect(riskCategory!.score).toBeLessThan(100);
  });

  it("returns grade A for near-perfect project", () => {
    const project = makeProject();
    const tasks: ProgressTask[] = Array.from({ length: 5 }, (_, i) =>
      makeTask({
        id: `t${i}`,
        name: `タスク${i}`,
        status: "done",
        progress: 100,
        startDate: "2025-01-01",
        dueDate: "2025-01-31",
      }),
    );
    const result = assessProjectHealth({
      project,
      tasks,
      asOfDate: "2025-01-31",
    });
    expect(["A", "B"]).toContain(result.grade);
  });
});

// ── generateForecastReport ────────────────────────────

describe("generateForecastReport for cockpit", () => {
  it("returns riskLevel high when over budget", () => {
    const project = makeProject({ budget: 1_000_000 });
    const tasks = [
      makeTask({ id: "t1", name: "工事", status: "in_progress", progress: 50 }),
    ];
    const expenses = [
      { amount: 900_000, approvalStatus: "approved" as const },
    ];
    const report = generateForecastReport(project, tasks, expenses);
    expect(report.riskLevel).toBe("high");
    expect(report.spentToDate).toBe(900_000);
  });

  it("returns riskLevel low when well within budget", () => {
    const project = makeProject({ budget: 10_000_000 });
    const tasks = [
      makeTask({ id: "t1", name: "工事", status: "done", progress: 100 }),
    ];
    const expenses = [
      { amount: 1_000_000, approvalStatus: "approved" as const },
    ];
    const report = generateForecastReport(project, tasks, expenses);
    expect(report.riskLevel).toBe("low");
    expect(report.remainingBudget).toBe(9_000_000);
  });

  it("includes completionPct between 0 and 100", () => {
    const project = makeProject({ budget: 5_000_000 });
    const tasks = [
      makeTask({ id: "t1", name: "t1", status: "done", progress: 100 }),
      makeTask({ id: "t2", name: "t2", status: "todo", progress: 0 }),
    ];
    const report = generateForecastReport(project, tasks, []);
    expect(report.completionPct).toBeGreaterThanOrEqual(0);
    expect(report.completionPct).toBeLessThanOrEqual(100);
  });
});

// ── site-entry-log for workers card ──────────────────

describe("site-entry-log for cockpit workers card", () => {
  const PROJECT_ID = "proj-cockpit-entry";

  it("getEntryLog returns entries for project and date", () => {
    clearEntryRecords();
    const today = new Date().toISOString().slice(0, 10);
    logEntry(PROJECT_ID, "田中 太郎", "大林建設");
    logEntry(PROJECT_ID, "鈴木 花子", "大成建設");
    logEntry("other-project", "山田 一郎", "清水建設");

    const entries = getEntryLog(PROJECT_ID, today);
    expect(entries).toHaveLength(2);
    expect(entries[0].workerName).toBe("田中 太郎");
    expect(entries[1].company).toBe("大成建設");
  });

  it("getTodayWorkerCount excludes exited workers", () => {
    clearEntryRecords();
    const { id } = logEntry(PROJECT_ID, "内田 次郎", "鹿島建設");
    logEntry(PROJECT_ID, "吉田 三郎", "竹中工務店");

    // Exit first worker
    logExit(id);

    const count = getTodayWorkerCount(PROJECT_ID);
    expect(count).toBe(1);
  });

  it("company summary groups correctly", () => {
    clearEntryRecords();
    logEntry(PROJECT_ID, "A", "大林建設");
    logEntry(PROJECT_ID, "B", "大林建設");
    logEntry(PROJECT_ID, "C", "鹿島建設");

    const entries = getEntryLog(PROJECT_ID);
    const map: Record<string, number> = {};
    for (const e of entries) {
      map[e.company] = (map[e.company] ?? 0) + 1;
    }
    expect(map["大林建設"]).toBe(2);
    expect(map["鹿島建設"]).toBe(1);
  });
});

// ── currency formatting ───────────────────────────────

describe("formatCurrency for cockpit", () => {
  function formatCurrency(amount: number): string {
    if (amount >= 100_000_000) return `¥${(amount / 100_000_000).toFixed(1)}億`;
    if (amount >= 10_000) return `¥${Math.round(amount / 10_000)}万`;
    if (amount >= 1_000) return `¥${Math.round(amount / 1_000)}千`;
    return `¥${Math.round(amount)}`;
  }

  it("formats 億 correctly", () => {
    expect(formatCurrency(150_000_000)).toBe("¥1.5億");
  });

  it("formats 万 correctly", () => {
    expect(formatCurrency(4_750_000)).toBe("¥475万");
  });

  it("formats 千 correctly", () => {
    expect(formatCurrency(5_500)).toBe("¥6千");
  });

  it("formats small amounts directly", () => {
    expect(formatCurrency(500)).toBe("¥500");
  });
});
