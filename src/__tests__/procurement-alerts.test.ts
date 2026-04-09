import { describe, expect, it } from "vitest";
import type { Task } from "../domain/types.js";
import { buildProcurementAlerts, getTaskLeadTime } from "../lib/procurement-alerts.js";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t-1",
    projectId: "p-1",
    name: "キュービクル設置",
    description: "",
    status: "todo",
    progress: 0,
    dependencies: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("procurement-alerts", () => {
  it("returns alerts when a task starts within lead time plus a 3 day buffer", () => {
    const alerts = buildProcurementAlerts([
      makeTask({
        id: "t-near",
        name: "空調機搬入",
        startDate: "2025-01-15",
        lead_time: 4,
      }),
      makeTask({
        id: "t-legacy",
        name: "鉄骨建方",
        startDate: "2025-01-14",
        leadTimeDays: 5,
      }),
      makeTask({
        id: "t-late",
        name: "外壁資材発注",
        startDate: "2025-01-25",
        lead_time: 4,
      }),
      makeTask({
        id: "t-done",
        name: "完了済み搬入",
        startDate: "2025-01-12",
        lead_time: 2,
        status: "done",
      }),
    ], "2025-01-10");

    expect(alerts).toEqual([
      {
        taskId: "t-legacy",
        projectId: "p-1",
        taskName: "鉄骨建方",
        startDate: "2025-01-14",
        leadTime: 5,
        daysRemaining: 4,
      },
      {
        taskId: "t-near",
        projectId: "p-1",
        taskName: "空調機搬入",
        startDate: "2025-01-15",
        leadTime: 4,
        daysRemaining: 5,
      },
    ]);
  });

  it("normalizes both lead time fields", () => {
    expect(getTaskLeadTime(makeTask({ lead_time: 3 }))).toBe(3);
    expect(getTaskLeadTime(makeTask({ leadTimeDays: 2 }))).toBe(2);
    expect(getTaskLeadTime(makeTask())).toBeNull();
  });
});
