import { describe, expect, it } from "vitest";
import { cascadeSchedule } from "../lib/cascade-scheduler.js";
import type { GanttTask } from "../components/gantt/types.js";
import type { DependencyType } from "../domain/types.js";

function makeTask(
  id: string,
  startDate: string,
  endDate: string,
  dependencies: string[] = [],
  dependencyType: DependencyType = "FS",
): GanttTask {
  return {
    id,
    projectId: "proj1",
    name: id,
    description: "",
    status: "todo",
    progress: 0,
    dependencies,
    dependencyType,
    startDate,
    endDate,
    projectName: "Test Project",
    isDateEstimated: false,
    isMilestone: false,
    projectIncludesWeekends: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

describe("cascadeSchedule - FS (Finish-to-Start)", () => {
  it("shifts successor start/end by the same delta as predecessor shift", () => {
    const tasks = [
      makeTask("A", "2025-01-01", "2025-01-05"),
      makeTask("B", "2025-01-06", "2025-01-10", ["A"], "FS"),
    ];

    // A延びる: end 2025-01-05 -> 2025-01-08 (+3 days)
    const updates = cascadeSchedule(tasks, "A", "2025-01-01", "2025-01-08");

    expect(updates.has("B")).toBe(true);
    const b = updates.get("B")!;
    expect(b.startDate).toBe("2025-01-09");
    expect(b.endDate).toBe("2025-01-13");
  });

  it("returns empty map when shift is zero", () => {
    const tasks = [
      makeTask("A", "2025-01-01", "2025-01-05"),
      makeTask("B", "2025-01-06", "2025-01-10", ["A"], "FS"),
    ];
    const updates = cascadeSchedule(tasks, "A", "2025-01-01", "2025-01-05");
    expect(updates.size).toBe(0);
  });
});

describe("cascadeSchedule - FF (Finish-to-Finish)", () => {
  it("aligns successor end to predecessor end", () => {
    const tasks = [
      makeTask("A", "2025-01-01", "2025-01-05"),
      makeTask("B", "2025-01-03", "2025-01-07", ["A"], "FF"),
    ];

    // A延びる: end 2025-01-05 -> 2025-01-10
    const updates = cascadeSchedule(tasks, "A", "2025-01-01", "2025-01-10");

    expect(updates.has("B")).toBe(true);
    const b = updates.get("B")!;
    // B should end on 2025-01-10 (same as A)
    expect(b.endDate).toBe("2025-01-10");
    // B duration preserved: 4 days -> start = 2025-01-06
    expect(b.startDate).toBe("2025-01-06");
  });
});

describe("cascadeSchedule - SS (Start-to-Start)", () => {
  it("aligns successor start to predecessor start", () => {
    const tasks = [
      makeTask("A", "2025-01-05", "2025-01-10"),
      makeTask("B", "2025-01-07", "2025-01-12", ["A"], "SS"),
    ];

    // A shifts: start 2025-01-05 -> stays same, end changes triggering cascade
    // We shift A by 3 days (end 2025-01-10 -> 2025-01-13)
    const updates = cascadeSchedule(tasks, "A", "2025-01-05", "2025-01-13");

    expect(updates.has("B")).toBe(true);
    const b = updates.get("B")!;
    // B start should align to A start (2025-01-05)
    expect(b.startDate).toBe("2025-01-05");
    // B duration preserved: 5 days
    expect(b.endDate).toBe("2025-01-10");
  });
});

describe("cascadeSchedule - SF (Start-to-Finish)", () => {
  it("aligns successor end to predecessor start", () => {
    const tasks = [
      makeTask("A", "2025-01-10", "2025-01-15"),
      makeTask("B", "2025-01-05", "2025-01-09", ["A"], "SF"),
    ];

    // A shifts end -> cascade
    const updates = cascadeSchedule(tasks, "A", "2025-01-10", "2025-01-18");

    expect(updates.has("B")).toBe(true);
    const b = updates.get("B")!;
    // B end = A start = 2025-01-10
    expect(b.endDate).toBe("2025-01-10");
  });
});

describe("cascadeSchedule - none (no dependency)", () => {
  it("does not cascade to tasks with none dependency type", () => {
    const tasks = [
      makeTask("A", "2025-01-01", "2025-01-05"),
      makeTask("B", "2025-01-01", "2025-01-05", ["A"], "none"),
    ];

    const updates = cascadeSchedule(tasks, "A", "2025-01-01", "2025-01-10");
    expect(updates.has("B")).toBe(false);
  });
});
