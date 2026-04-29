import { describe, expect, it } from "vitest";
import { resolveProjectTaskSchedule } from "./project-task-scheduler.js";

describe("project-task-scheduler", () => {
  it("starts independent tasks on the project start date", () => {
    const tasks = resolveProjectTaskSchedule([
      { id: "task-1", durationDays: 2, dependsOn: [], orderIndex: 0 },
    ], {
      projectStartDate: "2026-05-01",
      skipWeekends: false,
    });

    expect(tasks[0]).toMatchObject({
      startDate: "2026-05-01",
      endDate: "2026-05-02",
    });
  });

  it("starts a dependent task on the day after its predecessor ends", () => {
    const tasks = resolveProjectTaskSchedule([
      { id: "task-1", durationDays: 2, dependsOn: [], orderIndex: 0 },
      { id: "task-2", durationDays: 1, dependsOn: ["task-1"], orderIndex: 1 },
    ], {
      projectStartDate: "2026-05-01",
      skipWeekends: false,
    });

    expect(tasks[1]).toMatchObject({
      startDate: "2026-05-03",
      endDate: "2026-05-03",
    });
  });

  it("skips weekends for dependent task starts", () => {
    const tasks = resolveProjectTaskSchedule([
      { id: "task-1", durationDays: 1, dependsOn: [], orderIndex: 0 },
      { id: "task-2", durationDays: 1, dependsOn: ["task-1"], orderIndex: 1 },
    ], {
      projectStartDate: "2026-05-01",
      skipWeekends: true,
    });

    expect(tasks[1]).toMatchObject({
      startDate: "2026-05-04",
      endDate: "2026-05-04",
    });
  });

  it("waits for the latest dependency when multiple predecessors exist", () => {
    const tasks = resolveProjectTaskSchedule([
      { id: "task-1", durationDays: 1, dependsOn: [], orderIndex: 0 },
      { id: "task-2", durationDays: 3, dependsOn: [], orderIndex: 1 },
      { id: "task-3", durationDays: 1, dependsOn: ["task-1", "task-2"], orderIndex: 2 },
    ], {
      projectStartDate: "2026-05-01",
      skipWeekends: false,
    });

    expect(tasks[2]).toMatchObject({
      startDate: "2026-05-04",
      endDate: "2026-05-04",
    });
  });

  it("ignores unknown dependencies and respects orderIndex sorting", () => {
    const tasks = resolveProjectTaskSchedule([
      { id: "task-2", durationDays: 1, dependsOn: ["missing"], orderIndex: 1 },
      { id: "task-1", durationDays: 2, dependsOn: [], orderIndex: 0 },
    ], {
      projectStartDate: "2026-05-01",
      skipWeekends: false,
    });

    expect(tasks.map((task) => task.id)).toEqual(["task-1", "task-2"]);
    expect(tasks[1].startDate).toBe("2026-05-01");
  });
});
