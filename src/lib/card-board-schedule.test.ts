import { describe, expect, it } from "vitest";
import { computeConnectScheduleUpdates } from "./card-board-schedule.js";
import type { GanttTask } from "../components/gantt/types.js";

function makeTask(overrides: Partial<GanttTask> & Pick<GanttTask, "id">): GanttTask {
  return {
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    projectId: "p1",
    projectName: "Project",
    name: overrides.id,
    description: "",
    status: "todo",
    startDate: "2025-01-01",
    dueDate: "2025-01-03",
    endDate: "2025-01-03",
    progress: 0,
    dependencies: [],
    isDateEstimated: false,
    isMilestone: false,
    projectIncludesWeekends: true,
    ...overrides,
  };
}

describe("computeConnectScheduleUpdates", () => {
  it("pushes the successor start to the day after the predecessor ends when dates conflict", () => {
    const predecessor = makeTask({ id: "pred", startDate: "2025-01-01", endDate: "2025-01-05" });
    const successor = makeTask({ id: "succ", startDate: "2025-01-01", endDate: "2025-01-02", dependencies: ["pred"] });

    const updates = computeConnectScheduleUpdates([predecessor, successor], "pred", "succ");

    expect(updates.get("succ")).toEqual({ startDate: "2025-01-06", endDate: "2025-01-07" });
  });

  it("cascades the shift to downstream FS successors", () => {
    const predecessor = makeTask({ id: "pred", startDate: "2025-01-01", endDate: "2025-01-05" });
    const successor = makeTask({ id: "succ", startDate: "2025-01-01", endDate: "2025-01-02", dependencies: ["pred"] });
    const downstream = makeTask({ id: "down", startDate: "2025-01-03", endDate: "2025-01-04", dependencies: ["succ"] });

    const updates = computeConnectScheduleUpdates([predecessor, successor, downstream], "pred", "succ");

    expect(updates.get("succ")).toEqual({ startDate: "2025-01-06", endDate: "2025-01-07" });
    expect(updates.get("down")).toEqual({ startDate: "2025-01-08", endDate: "2025-01-09" });
  });

  it("does nothing when the successor already starts after the predecessor ends", () => {
    const predecessor = makeTask({ id: "pred", startDate: "2025-01-01", endDate: "2025-01-05" });
    const successor = makeTask({ id: "succ", startDate: "2025-01-10", endDate: "2025-01-12", dependencies: ["pred"] });

    const updates = computeConnectScheduleUpdates([predecessor, successor], "pred", "succ");

    expect(updates.size).toBe(0);
  });

  it("skips non-FS successor dependency types", () => {
    const predecessor = makeTask({ id: "pred", startDate: "2025-01-01", endDate: "2025-01-05" });
    const successor = makeTask({
      id: "succ",
      startDate: "2025-01-01",
      endDate: "2025-01-02",
      dependencies: ["pred"],
      dependencyType: "SS",
    });

    const updates = computeConnectScheduleUpdates([predecessor, successor], "pred", "succ");

    expect(updates.size).toBe(0);
  });

  it("returns no updates when either task is missing", () => {
    const successor = makeTask({ id: "succ" });
    expect(computeConnectScheduleUpdates([successor], "missing-pred", "succ").size).toBe(0);
  });
});
