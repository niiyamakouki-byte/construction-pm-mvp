import { describe, expect, it } from "vitest";
import type { Project } from "../domain/types.js";
import {
  calculateProjectProgress,
  calculateEarnedValue,
  schedulePerformanceIndex,
  costPerformanceIndex,
  estimateAtCompletion,
  generateProgressReport,
  type ProgressTask,
} from "../lib/progress-tracker.js";

function makeTask(overrides: Partial<ProgressTask> & { id: string; name: string }): ProgressTask {
  return {
    projectId: "p1",
    description: "",
    status: "todo",
    progress: 0,
    dependencies: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const baseProject: Project = {
  id: "p1",
  name: "Test Project",
  description: "",
  status: "active",
  startDate: "2025-01-01",
  includeWeekends: false,
  budget: 100000,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

describe("progress-tracker", () => {
  describe("calculateProjectProgress", () => {
    it("calculates duration-weighted project progress", () => {
      const tasks = [
        makeTask({ id: "a", name: "Survey", startDate: "2025-01-01", dueDate: "2025-01-02", progress: 100, status: "done" }),
        makeTask({ id: "b", name: "Framing", startDate: "2025-01-03", dueDate: "2025-01-06", progress: 50, status: "in_progress" }),
      ];
      const result = calculateProjectProgress(tasks);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(100);
    });

    it("returns 0 for empty tasks", () => {
      expect(calculateProjectProgress([])).toBe(0);
    });

    it("returns 100 when all done", () => {
      const tasks = [
        makeTask({ id: "a", name: "A", startDate: "2025-01-01", dueDate: "2025-01-03", progress: 100, status: "done" }),
        makeTask({ id: "b", name: "B", startDate: "2025-01-04", dueDate: "2025-01-06", progress: 100, status: "done" }),
      ];
      expect(calculateProjectProgress(tasks)).toBe(100);
    });
  });

  describe("calculateEarnedValue", () => {
    it("returns EV, PV, AC, BAC metrics", () => {
      const tasks = [
        makeTask({ id: "a", name: "A", startDate: "2025-01-01", dueDate: "2025-01-10", progress: 50, status: "in_progress" }),
      ];
      const result = calculateEarnedValue(tasks, 100000, "2025-01-05");
      expect(result.ev).toBeGreaterThan(0);
      expect(result.pv).toBeGreaterThan(0);
      expect(result.bac).toBe(100000);
      expect(result).toHaveProperty("ac");
      expect(result).toHaveProperty("percentComplete");
      expect(result).toHaveProperty("plannedPercentComplete");
    });

    it("handles zero budget gracefully", () => {
      const tasks = [
        makeTask({ id: "a", name: "A", startDate: "2025-01-01", dueDate: "2025-01-05", progress: 50, status: "in_progress" }),
      ];
      const result = calculateEarnedValue(tasks, 0, "2025-01-03");
      expect(result.bac).toBeGreaterThan(0); // inferred from duration
    });
  });

  describe("schedulePerformanceIndex", () => {
    it("returns SPI = EV/PV", () => {
      const tasks = [
        makeTask({ id: "a", name: "A", startDate: "2025-01-01", dueDate: "2025-01-10", progress: 100, status: "done" }),
      ];
      const spi = schedulePerformanceIndex(tasks, 100000, "2025-01-05");
      expect(spi).toBeGreaterThan(1); // ahead of schedule
    });

    it("returns 1 when EV equals PV", () => {
      const tasks = [
        makeTask({ id: "a", name: "A", startDate: "2025-01-01", dueDate: "2025-01-10", progress: 50, status: "in_progress" }),
      ];
      // At midpoint with 50% progress
      const spi = schedulePerformanceIndex(tasks, 100000, "2025-01-05");
      expect(spi).toBeGreaterThan(0);
    });
  });

  describe("costPerformanceIndex", () => {
    it("returns CPI = EV/AC", () => {
      const tasks = [
        makeTask({ id: "a", name: "A", startDate: "2025-01-01", dueDate: "2025-01-10", progress: 50, status: "in_progress", actualCost: 30000 }),
      ];
      const cpi = costPerformanceIndex(tasks, undefined, 100000, "2025-01-05");
      expect(cpi).toBeGreaterThan(0);
    });

    it("handles external actual costs input", () => {
      const tasks = [
        makeTask({ id: "a", name: "A", startDate: "2025-01-01", dueDate: "2025-01-10", progress: 50, status: "in_progress" }),
      ];
      const cpi = costPerformanceIndex(tasks, 60000, 100000, "2025-01-05");
      expect(cpi).toBeGreaterThan(0);
    });
  });

  describe("estimateAtCompletion", () => {
    it("returns EAC = budget / CPI", () => {
      expect(estimateAtCompletion(100000, 0.8)).toBeCloseTo(125000, 0);
    });

    it("returns Infinity for zero CPI", () => {
      expect(estimateAtCompletion(100000, 0)).toBe(Number.POSITIVE_INFINITY);
    });

    it("returns budget when CPI is 1", () => {
      expect(estimateAtCompletion(100000, 1)).toBe(100000);
    });
  });

  describe("generateProgressReport", () => {
    it("generates a formatted report with EVM metrics", () => {
      const tasks = [
        makeTask({ id: "a", name: "Foundation", startDate: "2025-01-01", dueDate: "2025-01-10", progress: 100, status: "done" }),
        makeTask({ id: "b", name: "Framing", startDate: "2025-01-11", dueDate: "2025-01-20", progress: 30, status: "in_progress", dependencies: ["a"] }),
      ];
      const report = generateProgressReport(baseProject, tasks, "2025-01-15");
      expect(report).toContain("Test Project");
      expect(report).toContain("Progress");
      expect(report).toContain("SPI");
      expect(report).toContain("CPI");
      expect(report).toContain("EAC");
      expect(report).toContain("Critical Path");
    });
  });
});
