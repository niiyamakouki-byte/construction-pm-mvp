import { describe, expect, it } from "vitest";
import type { GanttTask } from "../components/gantt/types.js";
import type { Project } from "../domain/types.js";
import { ganttTasksWithDates, ganttTaskToCalendarTask } from "./gantt-ics-export.js";

function makeProject(overrides?: Partial<Project>): Project {
  return {
    id: "proj-1",
    name: "KDX南青山",
    description: "テスト案件",
    status: "active",
    startDate: "2025-07-01",
    endDate: "2025-12-31",
    includeWeekends: false,
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
    ...overrides,
  };
}

function makeGanttTask(overrides?: Partial<GanttTask>): GanttTask {
  return {
    id: "task-1",
    projectId: "proj-1",
    name: "LGS下地",
    description: "",
    status: "todo",
    startDate: "2025-07-01",
    endDate: "2025-07-10",
    dueDate: "2025-07-10",
    progress: 0,
    dependencies: [],
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
    projectName: "KDX南青山",
    isDateEstimated: false,
    isMilestone: false,
    projectIncludesWeekends: false,
    ...overrides,
  };
}

describe("gantt-ics-export", () => {
  describe("ganttTasksWithDates", () => {
    it("returns tasks that have startDate", () => {
      const tasks = [
        makeGanttTask({ id: "t1", startDate: "2025-07-01" }),
        makeGanttTask({ id: "t2", startDate: undefined }),
        makeGanttTask({ id: "t3", startDate: "2025-08-01" }),
      ];
      const result = ganttTasksWithDates(tasks);
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toEqual(["t1", "t3"]);
    });

    it("returns empty array when no tasks have startDate", () => {
      const tasks = [makeGanttTask({ startDate: undefined })];
      expect(ganttTasksWithDates(tasks)).toHaveLength(0);
    });

    it("returns all tasks when all have startDate", () => {
      const tasks = [
        makeGanttTask({ id: "t1" }),
        makeGanttTask({ id: "t2" }),
      ];
      expect(ganttTasksWithDates(tasks)).toHaveLength(2);
    });
  });

  describe("ganttTaskToCalendarTask", () => {
    it("maps endDate to dueDate", () => {
      const task = makeGanttTask({ endDate: "2025-07-15" });
      const result = ganttTaskToCalendarTask(task);
      expect(result.dueDate).toBe("2025-07-15");
    });

    it("uses endDate over existing dueDate", () => {
      const task = makeGanttTask({ endDate: "2025-07-20", dueDate: "2025-07-10" });
      const result = ganttTaskToCalendarTask(task);
      expect(result.dueDate).toBe("2025-07-20");
    });

    it("falls back to dueDate when endDate is undefined", () => {
      const task = makeGanttTask({ endDate: undefined, dueDate: "2025-07-05" });
      const result = ganttTaskToCalendarTask(task);
      expect(result.dueDate).toBe("2025-07-05");
    });

    it("preserves all other task fields", () => {
      const task = makeGanttTask({ id: "t-x", name: "塗装", startDate: "2025-09-01" });
      const result = ganttTaskToCalendarTask(task);
      expect(result.id).toBe("t-x");
      expect(result.name).toBe("塗装");
      expect(result.startDate).toBe("2025-09-01");
    });
  });
});
