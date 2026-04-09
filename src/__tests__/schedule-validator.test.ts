import { describe, expect, it } from "vitest";
import type { Task } from "../domain/types.js";
import {
  validateSchedule,
  detectGaps,
  detectOverlaps,
  criticalPath,
  calculateSlack,
  suggestOptimization,
} from "../lib/schedule-validator.js";

function makeTask(overrides: Partial<Task> & { id: string; name: string }): Task {
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

describe("schedule-validator", () => {
  describe("validateSchedule", () => {
    it("returns valid for tasks without cycles", () => {
      const tasks = [
        makeTask({ id: "a", name: "A" }),
        makeTask({ id: "b", name: "B", dependencies: ["a"] }),
        makeTask({ id: "c", name: "C", dependencies: ["b"] }),
      ];
      const result = validateSchedule(tasks);
      expect(result.isValid).toBe(true);
      expect(result.cycles).toHaveLength(0);
      expect(result.order).toContain("a");
      expect(result.order).toContain("b");
      expect(result.order).toContain("c");
    });

    it("detects a simple cycle", () => {
      const tasks = [
        makeTask({ id: "a", name: "A", dependencies: ["b"] }),
        makeTask({ id: "b", name: "B", dependencies: ["a"] }),
      ];
      const result = validateSchedule(tasks);
      expect(result.isValid).toBe(false);
      expect(result.cycles.length).toBeGreaterThan(0);
    });

    it("detects missing dependencies", () => {
      const tasks = [
        makeTask({ id: "a", name: "A", dependencies: ["nonexistent"] }),
      ];
      const result = validateSchedule(tasks);
      expect(result.isValid).toBe(false);
      expect(result.missingDependencies).toContain("nonexistent");
    });

    it("handles empty task list", () => {
      const result = validateSchedule([]);
      expect(result.isValid).toBe(true);
      expect(result.cycles).toHaveLength(0);
      expect(result.order).toHaveLength(0);
    });
  });

  describe("detectGaps", () => {
    it("finds gaps between sequential tasks", () => {
      const tasks = [
        makeTask({ id: "a", name: "A", startDate: "2025-01-01", dueDate: "2025-01-03" }),
        makeTask({ id: "b", name: "B", startDate: "2025-01-06", dueDate: "2025-01-08", dependencies: ["a"] }),
      ];
      const gaps = detectGaps(tasks);
      expect(gaps.length).toBeGreaterThan(0);
      expect(gaps[0].predecessorId).toBe("a");
      expect(gaps[0].successorId).toBe("b");
      expect(gaps[0].gapDays).toBeGreaterThan(0);
    });

    it("returns empty for consecutive tasks", () => {
      const tasks = [
        makeTask({ id: "a", name: "A", startDate: "2025-01-01", dueDate: "2025-01-03" }),
        makeTask({ id: "b", name: "B", startDate: "2025-01-04", dueDate: "2025-01-06", dependencies: ["a"] }),
      ];
      const gaps = detectGaps(tasks);
      expect(gaps).toHaveLength(0);
    });
  });

  describe("detectOverlaps", () => {
    it("finds contractor double-booking", () => {
      const tasks = [
        makeTask({ id: "a", name: "A", startDate: "2025-01-01", dueDate: "2025-01-05", contractorId: "c1" }),
        makeTask({ id: "b", name: "B", startDate: "2025-01-03", dueDate: "2025-01-07", contractorId: "c1" }),
      ];
      const overlaps = detectOverlaps(tasks, [{ id: "c1", name: "Contractor 1", createdAt: "", updatedAt: "" }]);
      expect(overlaps.length).toBeGreaterThan(0);
      expect(overlaps[0].contractorId).toBe("c1");
      expect(overlaps[0].overlapDays).toBeGreaterThan(0);
    });

    it("returns empty when no overlap", () => {
      const tasks = [
        makeTask({ id: "a", name: "A", startDate: "2025-01-01", dueDate: "2025-01-03", contractorId: "c1" }),
        makeTask({ id: "b", name: "B", startDate: "2025-01-05", dueDate: "2025-01-07", contractorId: "c1" }),
      ];
      const overlaps = detectOverlaps(tasks, []);
      expect(overlaps).toHaveLength(0);
    });

    it("ignores different contractors", () => {
      const tasks = [
        makeTask({ id: "a", name: "A", startDate: "2025-01-01", dueDate: "2025-01-05", contractorId: "c1" }),
        makeTask({ id: "b", name: "B", startDate: "2025-01-03", dueDate: "2025-01-07", contractorId: "c2" }),
      ];
      const overlaps = detectOverlaps(tasks, []);
      expect(overlaps).toHaveLength(0);
    });
  });

  describe("criticalPath", () => {
    it("calculates the longest dependency chain", () => {
      const tasks = [
        makeTask({ id: "a", name: "Foundation", startDate: "2025-01-01", dueDate: "2025-01-05" }),
        makeTask({ id: "b", name: "Framing", startDate: "2025-01-06", dueDate: "2025-01-10", dependencies: ["a"] }),
        makeTask({ id: "c", name: "Electrical", startDate: "2025-01-06", dueDate: "2025-01-07", dependencies: ["a"] }),
        makeTask({ id: "d", name: "Finishing", startDate: "2025-01-11", dueDate: "2025-01-15", dependencies: ["b", "c"] }),
      ];
      const result = criticalPath(tasks);
      expect(result.taskIds).toContain("a");
      expect(result.taskIds).toContain("b");
      expect(result.taskIds).toContain("d");
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.issues).toHaveLength(0);
    });

    it("returns issues for cyclic graphs", () => {
      const tasks = [
        makeTask({ id: "a", name: "A", dependencies: ["b"] }),
        makeTask({ id: "b", name: "B", dependencies: ["a"] }),
      ];
      const result = criticalPath(tasks);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.taskIds).toHaveLength(0);
    });

    it("handles single task", () => {
      const tasks = [makeTask({ id: "a", name: "Solo", startDate: "2025-01-01", dueDate: "2025-01-05" })];
      const result = criticalPath(tasks);
      expect(result.taskIds).toEqual(["a"]);
      expect(result.totalDuration).toBe(5);
    });
  });

  describe("calculateSlack", () => {
    it("returns zero slack for critical path tasks", () => {
      const tasks = [
        makeTask({ id: "a", name: "A", startDate: "2025-01-01", dueDate: "2025-01-03" }),
        makeTask({ id: "b", name: "B", startDate: "2025-01-04", dueDate: "2025-01-06", dependencies: ["a"] }),
      ];
      const slacks = calculateSlack(tasks);
      expect(slacks).toHaveLength(2);
      const aSlack = slacks.find((s) => s.taskId === "a");
      expect(aSlack?.isCritical).toBe(true);
      expect(aSlack?.totalSlack).toBe(0);
    });

    it("shows positive slack for non-critical tasks", () => {
      const tasks = [
        makeTask({ id: "a", name: "A", startDate: "2025-01-01", dueDate: "2025-01-05" }),
        makeTask({ id: "b", name: "B", startDate: "2025-01-06", dueDate: "2025-01-10", dependencies: ["a"] }),
        makeTask({ id: "c", name: "C (short)", startDate: "2025-01-06", dueDate: "2025-01-07", dependencies: ["a"] }),
      ];
      const slacks = calculateSlack(tasks);
      const cSlack = slacks.find((s) => s.taskId === "c");
      expect(cSlack?.totalSlack).toBeGreaterThan(0);
      expect(cSlack?.isCritical).toBe(false);
    });

    it("returns empty for cyclic schedules", () => {
      const tasks = [
        makeTask({ id: "a", name: "A", dependencies: ["b"] }),
        makeTask({ id: "b", name: "B", dependencies: ["a"] }),
      ];
      expect(calculateSlack(tasks)).toHaveLength(0);
    });
  });

  describe("suggestOptimization", () => {
    it("suggests resolving cycles first", () => {
      const tasks = [
        makeTask({ id: "a", name: "A", dependencies: ["b"] }),
        makeTask({ id: "b", name: "B", dependencies: ["a"] }),
      ];
      const suggestions = suggestOptimization(tasks);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].type).toBe("resolve_cycle");
    });

    it("suggests closing gaps on critical path", () => {
      const tasks = [
        makeTask({ id: "a", name: "A", startDate: "2025-01-01", dueDate: "2025-01-03" }),
        makeTask({ id: "b", name: "B", startDate: "2025-01-08", dueDate: "2025-01-12", dependencies: ["a"] }),
      ];
      const suggestions = suggestOptimization(tasks);
      const gapSuggestion = suggestions.find((s) => s.type === "close_gap");
      expect(gapSuggestion).toBeDefined();
    });

    it("returns at most 5 suggestions", () => {
      const tasks = Array.from({ length: 20 }, (_, i) =>
        makeTask({
          id: `t${i}`,
          name: `Task ${i}`,
          startDate: `2025-01-${String(i * 3 + 1).padStart(2, "0")}`,
          dueDate: `2025-01-${String(i * 3 + 2).padStart(2, "0")}`,
          dependencies: i > 0 ? [`t${i - 1}`] : [],
        }),
      );
      const suggestions = suggestOptimization(tasks);
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
  });
});
