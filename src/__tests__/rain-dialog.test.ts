import { describe, expect, it } from "vitest";
import { cascadeSchedule } from "../lib/cascade-scheduler.js";
import type { GanttTask } from "../components/gantt/types.js";
import { addDaysSkipWeekends } from "../components/gantt/utils.js";

/**
 * Simulate the rain-day logic from GanttPage.handleRainDateChange.
 * Strategy: shift the affected task's end by 1, then cascade from that.
 */
function computeRainUpdates(
  tasks: GanttTask[],
  rainDate: string,
): Map<string, { startDate: string; endDate: string }> {
  const affectedTask = tasks.find(
    (t) => t.startDate <= rainDate && t.endDate >= rainDate,
  );
  if (!affectedTask) return new Map();

  // Shift affected task end by 1 working day
  const newEnd = addDaysSkipWeekends(
    affectedTask.endDate,
    1,
    affectedTask.projectIncludesWeekends,
    affectedTask.includeWeekends,
  );

  // Cascade from the shifted task to downstream dependencies
  const updates = cascadeSchedule(tasks, affectedTask.id, affectedTask.startDate, newEnd);
  // Record the directly affected task
  updates.set(affectedTask.id, { startDate: affectedTask.startDate, endDate: newEnd });
  return updates;
}

function makeTask(partial: Partial<GanttTask> & { id: string; startDate: string; endDate: string }): GanttTask {
  return {
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    projectId: "p1",
    projectName: "Test",
    name: partial.id,
    description: "",
    status: "todo",
    dueDate: partial.endDate,
    progress: 0,
    dependencies: [],
    isDateEstimated: false,
    isMilestone: false,
    projectIncludesWeekends: true,
    includeWeekends: true,
    ...partial,
  };
}

describe("rain dialog — computeRainUpdates", () => {
  it("returns empty map when no task covers the rain date", () => {
    const tasks = [makeTask({ id: "t1", startDate: "2025-03-01", endDate: "2025-03-05" })];
    const result = computeRainUpdates(tasks, "2025-03-10");
    expect(result.size).toBe(0);
  });

  it("shifts the directly affected task end date by 1 day", () => {
    const tasks = [makeTask({ id: "t1", startDate: "2025-03-01", endDate: "2025-03-05" })];
    const result = computeRainUpdates(tasks, "2025-03-03");
    expect(result.get("t1")?.endDate).toBe("2025-03-06");
  });

  it("cascades shift to dependent tasks", () => {
    const tasks = [
      makeTask({ id: "t1", startDate: "2025-03-01", endDate: "2025-03-05", dependencies: [] }),
      makeTask({ id: "t2", startDate: "2025-03-06", endDate: "2025-03-10", dependencies: ["t1"] }),
    ];
    const result = computeRainUpdates(tasks, "2025-03-03");
    // t1 end shifts from 03-05 → 03-06 (shift=1 day), so cascadeSchedule shifts t2 by 1 day too
    expect(result.has("t2")).toBe(true);
    expect(result.get("t2")?.endDate).toBe("2025-03-11");
  });

  it("skips weekends when includeWeekends is false", () => {
    const tasks = [
      makeTask({
        id: "t1",
        startDate: "2025-03-07",
        endDate: "2025-03-07", // Friday
        projectIncludesWeekends: false,
        includeWeekends: false,
      }),
    ];
    const result = computeRainUpdates(tasks, "2025-03-07");
    // Next business day after Friday is Monday
    expect(result.get("t1")?.endDate).toBe("2025-03-10");
  });
});
