import { describe, expect, it } from "vitest";
import type { Contractor, Task } from "../domain/types.js";
import {
  calculateResourceHistogram,
  identifyBottlenecks,
  suggestParallelTasks,
  optimizeSequence,
  levelResources,
} from "./resource-leveling.js";

function makeTask(overrides: Partial<Task> & Pick<Task, "id" | "name">): Task {
  return {
    id: overrides.id,
    projectId: "proj-1",
    name: overrides.name,
    description: "",
    status: "todo",
    progress: 0,
    dependencies: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeContractor(overrides: Partial<Contractor> & Pick<Contractor, "id" | "name">): Contractor {
  return {
    id: overrides.id,
    name: overrides.name,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resource-leveling", () => {
  describe("calculateResourceHistogram", () => {
    it("counts workers per day", () => {
      const tasks = [
        makeTask({ id: "t1", name: "A", startDate: "2025-01-06", dueDate: "2025-01-08" }),
        makeTask({ id: "t2", name: "B", startDate: "2025-01-07", dueDate: "2025-01-09" }),
      ];
      const contractors = [makeContractor({ id: "c1", name: "Co A" })];
      const histogram = calculateResourceHistogram(tasks, contractors);

      const jan7 = histogram.find((e) => e.date === "2025-01-07");
      expect(jan7).toBeDefined();
      expect(jan7!.workerCount).toBe(2);
      expect(jan7!.taskIds).toContain("t1");
      expect(jan7!.taskIds).toContain("t2");
    });

    it("returns empty for tasks without dates", () => {
      const tasks = [makeTask({ id: "t1", name: "A" })];
      const histogram = calculateResourceHistogram(tasks, []);
      expect(histogram).toEqual([]);
    });

    it("returns sorted by date", () => {
      const tasks = [
        makeTask({ id: "t1", name: "A", startDate: "2025-01-10", dueDate: "2025-01-10" }),
        makeTask({ id: "t2", name: "B", startDate: "2025-01-05", dueDate: "2025-01-05" }),
      ];
      const histogram = calculateResourceHistogram(tasks, []);
      expect(histogram[0].date).toBe("2025-01-05");
      expect(histogram[1].date).toBe("2025-01-10");
    });
  });

  describe("identifyBottlenecks", () => {
    it("detects days exceeding max workers", () => {
      const tasks = [
        makeTask({ id: "t1", name: "A", startDate: "2025-01-06", dueDate: "2025-01-06" }),
        makeTask({ id: "t2", name: "B", startDate: "2025-01-06", dueDate: "2025-01-06" }),
        makeTask({ id: "t3", name: "C", startDate: "2025-01-06", dueDate: "2025-01-06" }),
      ];
      const bottlenecks = identifyBottlenecks(tasks, [], 2);
      expect(bottlenecks).toHaveLength(1);
      expect(bottlenecks[0].date).toBe("2025-01-06");
      expect(bottlenecks[0].workerCount).toBe(3);
      expect(bottlenecks[0].maxWorkers).toBe(2);
    });

    it("returns empty when no bottlenecks", () => {
      const tasks = [
        makeTask({ id: "t1", name: "A", startDate: "2025-01-06", dueDate: "2025-01-06" }),
      ];
      const bottlenecks = identifyBottlenecks(tasks, [], 5);
      expect(bottlenecks).toEqual([]);
    });

    it("identifies overflow task ids", () => {
      const tasks = [
        makeTask({ id: "t1", name: "A", startDate: "2025-01-06", dueDate: "2025-01-06" }),
        makeTask({ id: "t2", name: "B", startDate: "2025-01-06", dueDate: "2025-01-06" }),
        makeTask({ id: "t3", name: "C", startDate: "2025-01-06", dueDate: "2025-01-06" }),
      ];
      const bottlenecks = identifyBottlenecks(tasks, [], 1);
      expect(bottlenecks[0].overflowTaskIds.length).toBe(2);
    });
  });

  describe("suggestParallelTasks", () => {
    it("finds tasks that can run in parallel", () => {
      const tasks = [
        makeTask({ id: "t1", name: "A", startDate: "2025-01-06", dependencies: [] }),
        makeTask({ id: "t2", name: "B", startDate: "2025-01-06", dependencies: [] }),
        makeTask({ id: "t3", name: "C", startDate: "2025-01-06", dependencies: ["t1"] }),
      ];
      const groups = suggestParallelTasks(tasks);
      expect(groups.length).toBeGreaterThanOrEqual(1);
      // t1 and t2 have no dependency on each other
      const group = groups.find((g) => g.taskIds.includes("t1") && g.taskIds.includes("t2"));
      expect(group).toBeDefined();
    });

    it("returns empty when all tasks depend on each other", () => {
      const tasks = [
        makeTask({ id: "t1", name: "A", startDate: "2025-01-06", dependencies: ["t2"] }),
        makeTask({ id: "t2", name: "B", startDate: "2025-01-07", dependencies: ["t1"] }),
      ];
      const groups = suggestParallelTasks(tasks);
      expect(groups).toEqual([]);
    });

    it("skips done tasks", () => {
      const tasks = [
        makeTask({ id: "t1", name: "A", status: "done", startDate: "2025-01-06" }),
        makeTask({ id: "t2", name: "B", startDate: "2025-01-06" }),
      ];
      const groups = suggestParallelTasks(tasks);
      // t1 is done, so no parallel group with t1
      const hasT1 = groups.some((g) => g.taskIds.includes("t1"));
      expect(hasT1).toBe(false);
    });
  });

  describe("optimizeSequence", () => {
    it("orders tasks by dependency (topological sort)", () => {
      const tasks = [
        makeTask({ id: "t3", name: "C", startDate: "2025-01-08", dependencies: ["t2"] }),
        makeTask({ id: "t1", name: "A", startDate: "2025-01-06", dependencies: [] }),
        makeTask({ id: "t2", name: "B", startDate: "2025-01-07", dependencies: ["t1"] }),
      ];
      const optimized = optimizeSequence(tasks);
      const ids = optimized.map((t) => t.id);
      expect(ids.indexOf("t1")).toBeLessThan(ids.indexOf("t2"));
      expect(ids.indexOf("t2")).toBeLessThan(ids.indexOf("t3"));
    });

    it("handles tasks with no dependencies", () => {
      const tasks = [
        makeTask({ id: "t1", name: "A", startDate: "2025-01-06" }),
        makeTask({ id: "t2", name: "B", startDate: "2025-01-05" }),
      ];
      const optimized = optimizeSequence(tasks);
      // t2 starts earlier, should come first
      expect(optimized[0].id).toBe("t2");
    });

    it("handles circular dependencies gracefully", () => {
      const tasks = [
        makeTask({ id: "t1", name: "A", dependencies: ["t2"] }),
        makeTask({ id: "t2", name: "B", dependencies: ["t1"] }),
      ];
      const optimized = optimizeSequence(tasks);
      expect(optimized).toHaveLength(2);
    });
  });

  describe("levelResources", () => {
    it("shifts tasks to avoid exceeding maxWorkersPerDay", () => {
      const tasks = [
        makeTask({ id: "t1", name: "A", startDate: "2025-01-06", dueDate: "2025-01-06" }),
        makeTask({ id: "t2", name: "B", startDate: "2025-01-06", dueDate: "2025-01-06" }),
        makeTask({ id: "t3", name: "C", startDate: "2025-01-06", dueDate: "2025-01-06" }),
      ];
      const result = levelResources(tasks, [], 2);
      // At least one task should be shifted
      expect(result.adjustments.length).toBeGreaterThan(0);
      // The shifted task should start after the original date
      const shifted = result.adjustments[0];
      expect(shifted.newStart > shifted.originalStart).toBe(true);
    });

    it("does not shift when under limit", () => {
      const tasks = [
        makeTask({ id: "t1", name: "A", startDate: "2025-01-06", dueDate: "2025-01-06" }),
        makeTask({ id: "t2", name: "B", startDate: "2025-01-07", dueDate: "2025-01-07" }),
      ];
      const result = levelResources(tasks, [], 5);
      expect(result.adjustments).toHaveLength(0);
    });

    it("preserves task duration when shifting", () => {
      const tasks = [
        makeTask({ id: "t1", name: "A", startDate: "2025-01-06", dueDate: "2025-01-08" }),
        makeTask({ id: "t2", name: "B", startDate: "2025-01-06", dueDate: "2025-01-08" }),
      ];
      const result = levelResources(tasks, [], 1);
      if (result.adjustments.length > 0) {
        const adj = result.adjustments[0];
        const origDays = 3; // Jan 6-8 = 3 days
        const newStart = new Date(adj.newStart + "T00:00:00");
        const newEnd = new Date(adj.newEnd + "T00:00:00");
        const newDays = Math.round((newEnd.getTime() - newStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        expect(newDays).toBe(origDays);
      }
    });
  });
});
