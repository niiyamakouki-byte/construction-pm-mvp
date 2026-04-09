import { describe, expect, it } from "vitest";
import type { Project } from "../domain/types.js";
import {
  calculateEarnedValue,
  calculateProjectProgress,
  costPerformanceIndex,
  estimateAtCompletion,
  generateProgressReport,
  schedulePerformanceIndex,
  type ProgressTask,
} from "./progress-tracker.js";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    name: "Downtown Tenant Fit-out",
    description: "",
    status: "active",
    startDate: "2025-01-01",
    includeWeekends: true,
    budget: 1000,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTask(overrides: Partial<ProgressTask> = {}): ProgressTask {
  return {
    id: "task-1",
    projectId: "project-1",
    name: "Task",
    description: "",
    status: "todo",
    progress: 0,
    dependencies: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("progress-tracker", () => {
  it("calculates duration-weighted project progress", () => {
    const tasks = [
      makeTask({
        id: "a",
        name: "Survey",
        startDate: "2025-01-01",
        dueDate: "2025-01-02",
        progress: 100,
        status: "done",
      }),
      makeTask({
        id: "b",
        name: "Framing",
        startDate: "2025-01-03",
        dueDate: "2025-01-06",
        progress: 50,
        status: "in_progress",
      }),
    ];

    expect(calculateProjectProgress(tasks)).toBeCloseTo(66.67, 2);
  });

  it("computes earned value metrics and performance indices", () => {
    const tasks = [
      makeTask({
        id: "a",
        name: "Survey",
        startDate: "2025-01-01",
        dueDate: "2025-01-02",
        progress: 100,
        status: "done",
        actualCost: 400,
      }),
      makeTask({
        id: "b",
        name: "Framing",
        startDate: "2025-01-03",
        dueDate: "2025-01-06",
        progress: 50,
        status: "in_progress",
        dependencies: ["a"],
        actualCost: 500,
      }),
    ];

    const evm = calculateEarnedValue(tasks, 1000, "2025-01-04");

    expect(evm.ev).toBeCloseTo(666.67, 2);
    expect(evm.pv).toBeCloseTo(666.67, 2);
    expect(evm.ac).toBe(900);
    expect(schedulePerformanceIndex(tasks, 1000, "2025-01-04")).toBe(1);
    expect(costPerformanceIndex(tasks, { a: 400, b: 500 }, 1000, "2025-01-04")).toBe(0.74);
    expect(estimateAtCompletion(1000, 0.74)).toBeCloseTo(1351.35, 2);
  });

  it("generates a formatted progress report", () => {
    const project = makeProject({ name: "North Tower Renovation" });
    const tasks = [
      makeTask({
        id: "a",
        name: "Survey",
        startDate: "2025-01-01",
        dueDate: "2025-01-02",
        progress: 100,
        status: "done",
        actualCost: 400,
      }),
      makeTask({
        id: "b",
        name: "Framing",
        startDate: "2025-01-03",
        dueDate: "2025-01-06",
        progress: 50,
        status: "in_progress",
        dependencies: ["a"],
        actualCost: 500,
      }),
    ];

    const report = generateProgressReport(project, tasks, "2025-01-04");

    expect(report).toContain("Progress Report: North Tower Renovation");
    expect(report).toContain("Overall Progress: 66.67%");
    expect(report).toContain("SPI: 1");
    expect(report).toContain("Critical Path: Survey -> Framing");
  });
});
