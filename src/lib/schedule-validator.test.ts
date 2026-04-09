import { describe, expect, it } from "vitest";
import type { Task } from "../domain/types.js";
import {
  calculateSlack,
  detectCircularDependencies,
  detectContractorConflicts,
  detectGaps,
  findCriticalPath,
} from "./schedule-validator.js";

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

describe("schedule-validator", () => {
  it("detects circular dependency chains", () => {
    const tasks = [
      makeTask({ id: "a", name: "Layout", dependencies: ["c"] }),
      makeTask({ id: "b", name: "Framing", dependencies: ["a"] }),
      makeTask({ id: "c", name: "Electrical", dependencies: ["b"] }),
    ];

    expect(detectCircularDependencies(tasks)).toEqual([["a", "c", "b", "a"]]);
  });

  it("finds the critical path as the longest dependency chain", () => {
    const tasks = [
      makeTask({ id: "a", name: "Demo", startDate: "2025-01-01", dueDate: "2025-01-02" }),
      makeTask({
        id: "b",
        name: "Framing",
        startDate: "2025-01-03",
        dueDate: "2025-01-05",
        dependencies: ["a"],
      }),
      makeTask({
        id: "c",
        name: "Inspection",
        startDate: "2025-01-03",
        dueDate: "2025-01-03",
        dependencies: ["a"],
      }),
      makeTask({
        id: "d",
        name: "Closeout",
        startDate: "2025-01-06",
        dueDate: "2025-01-07",
        dependencies: ["b", "c"],
      }),
    ];

    const result = findCriticalPath(tasks);

    expect(result.taskIds).toEqual(["a", "b", "d"]);
    expect(result.totalDuration).toBe(7);
    expect(result.totalSpanDays).toBe(7);
    expect(result.issues).toEqual([]);
  });

  it("calculates free and total slack per task", () => {
    const tasks = [
      makeTask({ id: "a", name: "Demo", startDate: "2025-01-01", dueDate: "2025-01-02" }),
      makeTask({
        id: "b",
        name: "Framing",
        startDate: "2025-01-03",
        dueDate: "2025-01-05",
        dependencies: ["a"],
      }),
      makeTask({
        id: "c",
        name: "Electrical",
        startDate: "2025-01-03",
        dueDate: "2025-01-03",
        dependencies: ["a"],
      }),
      makeTask({
        id: "d",
        name: "Closeout",
        startDate: "2025-01-06",
        dueDate: "2025-01-07",
        dependencies: ["b", "c"],
      }),
    ];

    const slackByTask = new Map(calculateSlack(tasks).map((item) => [item.taskId, item]));

    expect(slackByTask.get("a")).toMatchObject({ freeSlack: 0, totalSlack: 0, isCritical: true });
    expect(slackByTask.get("b")).toMatchObject({ freeSlack: 0, totalSlack: 0, isCritical: true });
    expect(slackByTask.get("c")).toMatchObject({ freeSlack: 2, totalSlack: 2, isCritical: false });
    expect(slackByTask.get("d")).toMatchObject({ freeSlack: 0, totalSlack: 0, isCritical: true });
  });

  it("detects contractor conflicts when the same contractor is double-booked", () => {
    const tasks = [
      makeTask({
        id: "a",
        name: "North wing",
        contractorId: "crew-1",
        startDate: "2025-01-02",
        dueDate: "2025-01-05",
      }),
      makeTask({
        id: "b",
        name: "South wing",
        contractorId: "crew-1",
        startDate: "2025-01-04",
        dueDate: "2025-01-06",
      }),
      makeTask({
        id: "c",
        name: "Lobby",
        contractorId: "crew-2",
        startDate: "2025-01-04",
        dueDate: "2025-01-06",
      }),
    ];

    expect(detectContractorConflicts(tasks)).toEqual([
      {
        contractorId: "crew-1",
        contractorName: "crew-1",
        firstTaskId: "a",
        secondTaskId: "b",
        overlapStart: "2025-01-04",
        overlapEnd: "2025-01-05",
        overlapDays: 2,
      },
    ]);
  });

  it("detects idle gaps between dependent tasks", () => {
    const tasks = [
      makeTask({ id: "a", name: "Permits", startDate: "2025-01-01", dueDate: "2025-01-03" }),
      makeTask({
        id: "b",
        name: "Mobilization",
        startDate: "2025-01-06",
        dueDate: "2025-01-08",
        dependencies: ["a"],
      }),
    ];

    expect(detectGaps(tasks)).toEqual([
      {
        predecessorId: "a",
        successorId: "b",
        predecessorEndDate: "2025-01-03",
        successorStartDate: "2025-01-06",
        gapDays: 2,
      },
    ]);
  });
});
