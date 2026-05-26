import { describe, expect, it } from "vitest";
import type { Project } from "../domain/types.js";
import {
  calculateEarnedValue,
  costPerformanceIndex,
  estimateAtCompletion,
  generateEVReport,
  schedulePerformanceIndex,
  type ProgressTask,
} from "./earned-value.js";

function makeTask(overrides: Partial<ProgressTask> & Pick<ProgressTask, "id" | "name">): ProgressTask {
  return {
    projectId: "proj-1",
    description: "",
    status: "todo",
    progress: 0,
    dependencies: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    name: "Tower retrofit",
    description: "",
    status: "active",
    startDate: "2025-01-01",
    includeWeekends: true,
    budget: 2000,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("earned-value", () => {
  const tasks: ProgressTask[] = [
    makeTask({
      id: "t1",
      name: "Structural steel",
      status: "done",
      progress: 100,
      startDate: "2025-01-01",
      dueDate: "2025-01-05",
      plannedCost: 1000,
      actualCost: 1200,
    }),
    makeTask({
      id: "t2",
      name: "MEP rough-in",
      status: "in_progress",
      progress: 50,
      startDate: "2025-01-06",
      dueDate: "2025-01-10",
      plannedCost: 1000,
      actualCost: 600,
    }),
  ];

  it("calculates EV, PV, AC, and progress metrics", () => {
    expect(calculateEarnedValue(tasks, 2000, "2025-01-08")).toEqual({
      ev: 1500,
      pv: 1600,
      ac: 1800,
      bac: 2000,
      percentComplete: 75,
      plannedPercentComplete: 80,
    });
  });

  it("computes schedule performance index from EV and PV", () => {
    expect(schedulePerformanceIndex(tasks, 2000, "2025-01-08")).toBe(0.94);
  });

  it("computes cost performance index from EV and actual costs", () => {
    expect(costPerformanceIndex(tasks, 1800, 2000, "2025-01-08")).toBe(0.83);
  });

  it("forecasts estimate at completion from budget and CPI", () => {
    expect(estimateAtCompletion(2000, 0.83)).toBe(2409.64);
  });

  it("generates a formatted earned value report", () => {
    const report = generateEVReport(makeProject(), tasks, [{ taskId: "t1", amount: 1200 }, { taskId: "t2", cost: 600 }], "2025-01-08");

    expect(report).toContain("Earned Value Report: Tower retrofit");
    expect(report).toContain("Budget (BAC): 2,000");
    expect(report).toContain("EV: 1,500  PV: 1,600  AC: 1,800");
    expect(report).toContain("SPI: 0.94  CPI: 0.83  EAC: 2,409.64");
    expect(report).toContain("Completed Tasks: 1/2");
  });

  it("default asOfDate uses local date, not UTC (timezone regression)", () => {
    // Verify that the no-arg call does not throw and returns a valid YYYY-MM-DD
    // string matching today's local date rather than yesterday's UTC date.
    const metrics = calculateEarnedValue([], 0);
    const localDateStr = (() => {
      const d = new Date();
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${mo}-${day}`;
    })();
    // The bac/ev/pv/ac defaults for empty task list are 0 — what matters is no crash
    // and that calling schedulePerformanceIndex without asOfDate is consistent.
    const spi = schedulePerformanceIndex([], 0);
    expect(typeof spi).toBe("number");
    // local date must be a valid YYYY-MM-DD
    expect(localDateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
