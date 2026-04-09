import { describe, expect, it } from "vitest";
import type { Contractor, Task } from "../domain/types.js";
import {
  assignContractor,
  getContractorWorkload,
  findAvailableContractors,
  detectOverallocation,
} from "./contractor-scheduler.js";

function makeTask(overrides: Partial<Task> & Pick<Task, "id" | "name">): Task {
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

function makeContractor(overrides: Partial<Contractor> & Pick<Contractor, "id" | "name">): Contractor {
  return {
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("contractor-scheduler", () => {
  describe("assignContractor", () => {
    it("assigns a contractor to a task", () => {
      const tasks = [makeTask({ id: "t1", name: "Framing" })];
      const result = assignContractor(tasks, "t1", "c1");

      expect(result.tasks[0].contractorId).toBe("c1");
      expect(result.assignment.taskId).toBe("t1");
      expect(result.assignment.contractorId).toBe("c1");
    });

    it("does not modify other tasks", () => {
      const tasks = [
        makeTask({ id: "t1", name: "Framing" }),
        makeTask({ id: "t2", name: "Electrical" }),
      ];
      const result = assignContractor(tasks, "t1", "c1");

      expect(result.tasks[0].contractorId).toBe("c1");
      expect(result.tasks[1].contractorId).toBeUndefined();
    });
  });

  describe("getContractorWorkload", () => {
    it("returns tasks assigned to a contractor in the date range", () => {
      const tasks = [
        makeTask({ id: "t1", name: "Framing", contractorId: "c1", startDate: "2025-01-05", dueDate: "2025-01-10" }),
        makeTask({ id: "t2", name: "Electrical", contractorId: "c1", startDate: "2025-01-15", dueDate: "2025-01-20" }),
        makeTask({ id: "t3", name: "Plumbing", contractorId: "c2", startDate: "2025-01-05", dueDate: "2025-01-10" }),
      ];

      const workload = getContractorWorkload(tasks, "c1", "2025-01-01", "2025-01-12");
      expect(workload).toHaveLength(1);
      expect(workload[0].taskId).toBe("t1");
    });

    it("returns empty for contractor with no tasks in range", () => {
      const tasks = [
        makeTask({ id: "t1", name: "Framing", contractorId: "c1", startDate: "2025-01-05", dueDate: "2025-01-10" }),
      ];

      const workload = getContractorWorkload(tasks, "c1", "2025-02-01", "2025-02-28");
      expect(workload).toHaveLength(0);
    });
  });

  describe("findAvailableContractors", () => {
    it("excludes contractors booked on the given date", () => {
      const contractors = [
        makeContractor({ id: "c1", name: "Alpha Co", specialty: "electrical" }),
        makeContractor({ id: "c2", name: "Beta Co", specialty: "plumbing" }),
      ];
      const tasks = [
        makeTask({ id: "t1", name: "Wiring", contractorId: "c1", startDate: "2025-01-05", dueDate: "2025-01-10" }),
      ];

      const available = findAvailableContractors(contractors, tasks, "2025-01-07");
      expect(available.map((c) => c.id)).toEqual(["c2"]);
    });

    it("filters by required skill", () => {
      const contractors = [
        makeContractor({ id: "c1", name: "Alpha Co", specialty: "electrical" }),
        makeContractor({ id: "c2", name: "Beta Co", specialty: "plumbing" }),
        makeContractor({ id: "c3", name: "Gamma Co" }),
      ];

      const available = findAvailableContractors(contractors, [], "2025-01-07", "plumbing");
      expect(available.map((c) => c.id)).toEqual(["c2"]);
    });

    it("returns all when no tasks and no skill filter", () => {
      const contractors = [
        makeContractor({ id: "c1", name: "Alpha Co" }),
        makeContractor({ id: "c2", name: "Beta Co" }),
      ];

      const available = findAvailableContractors(contractors, [], "2025-01-07");
      expect(available).toHaveLength(2);
    });
  });

  describe("detectOverallocation", () => {
    it("warns when a contractor has more than 8h on a day", () => {
      const contractors = [makeContractor({ id: "c1", name: "Alpha Co" })];
      const tasks = [
        makeTask({ id: "t1", name: "Task A", contractorId: "c1", startDate: "2025-01-05", dueDate: "2025-01-07" }),
        makeTask({ id: "t2", name: "Task B", contractorId: "c1", startDate: "2025-01-06", dueDate: "2025-01-08" }),
      ];

      const warnings = detectOverallocation(contractors, tasks);
      expect(warnings.length).toBeGreaterThan(0);
      // Jan 6 and Jan 7 should be overallocated (16h)
      const jan6 = warnings.find((w) => w.date === "2025-01-06");
      expect(jan6).toBeDefined();
      expect(jan6!.totalHours).toBe(16);
      expect(jan6!.taskIds).toContain("t1");
      expect(jan6!.taskIds).toContain("t2");
    });

    it("returns empty when no overallocation", () => {
      const contractors = [makeContractor({ id: "c1", name: "Alpha Co" })];
      const tasks = [
        makeTask({ id: "t1", name: "Task A", contractorId: "c1", startDate: "2025-01-05", dueDate: "2025-01-07" }),
      ];

      const warnings = detectOverallocation(contractors, tasks);
      expect(warnings).toEqual([]);
    });

    it("ignores contractors not in the list", () => {
      const contractors = [makeContractor({ id: "c2", name: "Beta Co" })];
      const tasks = [
        makeTask({ id: "t1", name: "Task A", contractorId: "c1", startDate: "2025-01-05", dueDate: "2025-01-07" }),
        makeTask({ id: "t2", name: "Task B", contractorId: "c1", startDate: "2025-01-06", dueDate: "2025-01-08" }),
      ];

      const warnings = detectOverallocation(contractors, tasks);
      expect(warnings).toEqual([]);
    });
  });
});
