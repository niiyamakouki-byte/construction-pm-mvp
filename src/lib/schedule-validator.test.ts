import { describe, expect, it } from "vitest";
import type { Contractor, Task } from "../domain/types.js";
import {
  calculateSlack,
  criticalPath,
  detectGaps,
  detectOverlaps,
  suggestOptimization,
  validateSchedule,
} from "./schedule-validator.js";

function makeTask(overrides: Partial<Task> = {}): Task {
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

function makeContractor(overrides: Partial<Contractor> = {}): Contractor {
  return {
    id: "contractor-1",
    name: "Alpha Electric",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("schedule-validator", () => {
  it("detects circular dependencies", () => {
    const tasks = [
      makeTask({ id: "a", name: "A", dependencies: ["b"] }),
      makeTask({ id: "b", name: "B", dependencies: ["a"] }),
    ];

    const result = validateSchedule(tasks);

    expect(result.isValid).toBe(false);
    expect(result.cycles).toEqual([["a", "b", "a"]]);
  });

  it("finds dependency gaps and contractor overlaps", () => {
    const tasks = [
      makeTask({
        id: "a",
        name: "Survey",
        startDate: "2025-01-01",
        dueDate: "2025-01-02",
      }),
      makeTask({
        id: "b",
        name: "Framing",
        startDate: "2025-01-04",
        dueDate: "2025-01-06",
        dependencies: ["a"],
        contractorId: "c-1",
      }),
      makeTask({
        id: "c",
        name: "Electrical",
        startDate: "2025-01-05",
        dueDate: "2025-01-07",
        dependencies: ["a"],
        contractorId: "c-1",
      }),
    ];

    const gaps = detectGaps(tasks);
    const overlaps = detectOverlaps(tasks, [makeContractor({ id: "c-1", name: "Alpha Electric" })]);

    expect(gaps).toEqual([
      {
        predecessorId: "a",
        successorId: "c",
        predecessorEndDate: "2025-01-02",
        successorStartDate: "2025-01-05",
        gapDays: 2,
      },
      {
        predecessorId: "a",
        successorId: "b",
        predecessorEndDate: "2025-01-02",
        successorStartDate: "2025-01-04",
        gapDays: 1,
      },
    ]);
    expect(overlaps).toEqual([
      {
        contractorId: "c-1",
        contractorName: "Alpha Electric",
        firstTaskId: "b",
        secondTaskId: "c",
        overlapStart: "2025-01-05",
        overlapEnd: "2025-01-06",
        overlapDays: 2,
      },
    ]);
  });

  it("calculates the critical path and task slack", () => {
    const tasks = [
      makeTask({ id: "a", name: "Start", startDate: "2025-01-01", dueDate: "2025-01-01" }),
      makeTask({
        id: "b",
        name: "Short branch",
        startDate: "2025-01-02",
        dueDate: "2025-01-03",
        dependencies: ["a"],
      }),
      makeTask({
        id: "c",
        name: "Long branch",
        startDate: "2025-01-02",
        dueDate: "2025-01-05",
        dependencies: ["a"],
      }),
      makeTask({
        id: "d",
        name: "Finish",
        startDate: "2025-01-06",
        dueDate: "2025-01-06",
        dependencies: ["b", "c"],
      }),
    ];

    const critical = criticalPath(tasks);
    const slack = calculateSlack(tasks);

    expect(critical.taskIds).toEqual(["a", "c", "d"]);
    expect(critical.totalDuration).toBe(6);
    expect(slack).toEqual([
      { taskId: "a", freeSlack: 0, totalSlack: 0, isCritical: true },
      { taskId: "b", freeSlack: 2, totalSlack: 2, isCritical: false },
      { taskId: "c", freeSlack: 0, totalSlack: 0, isCritical: true },
      { taskId: "d", freeSlack: 0, totalSlack: 0, isCritical: true },
    ]);
  });

  it("suggests practical schedule compression moves", () => {
    const tasks = [
      makeTask({
        id: "a",
        name: "Layout",
        startDate: "2025-01-01",
        dueDate: "2025-01-02",
      }),
      makeTask({
        id: "b",
        name: "Framing",
        startDate: "2025-01-05",
        dueDate: "2025-01-07",
        dependencies: ["a"],
        contractorId: "c-1",
      }),
      makeTask({
        id: "c",
        name: "Electrical rough-in",
        startDate: "2025-01-04",
        dueDate: "2025-01-08",
        dependencies: ["a"],
        contractorId: "c-1",
      }),
      makeTask({
        id: "d",
        name: "Inspection",
        startDate: "2025-01-09",
        dueDate: "2025-01-09",
        dependencies: ["c"],
      }),
    ];

    const suggestions = suggestOptimization(tasks);

    expect(suggestions[0]?.type).toBe("reassign_contractor");
    expect(suggestions.some((suggestion) => suggestion.type === "close_gap")).toBe(true);
    expect(suggestions.some((suggestion) => suggestion.type === "crash_task")).toBe(true);
  });
});
