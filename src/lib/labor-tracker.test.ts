import { beforeEach, describe, expect, it } from "vitest";
import {
  type CrewAssignment,
  type LaborTimeEntry,
  _resetLaborStore,
  assignWorkerToCrew,
  calculateDailyLaborCost,
  calculateOvertime,
  clockIn,
  clockOut,
  getCrewAssignments,
  getLaborEntries,
} from "./labor-tracker.js";

beforeEach(() => {
  _resetLaborStore();
});

function makeEntry(overrides: Partial<LaborTimeEntry> = {}): LaborTimeEntry {
  return {
    id: "entry-1",
    projectId: "proj-1",
    workerId: "worker-1",
    workerName: "Ken Ito",
    trade: "Carpentry",
    hourlyRate: 4000,
    clockInTime: "2025-04-01T08:00:00.000Z",
    status: "active",
    ...overrides,
  };
}

function makeAssignment(
  overrides: Partial<CrewAssignment> = {},
): CrewAssignment {
  return {
    id: "assign-1",
    projectId: "proj-1",
    crewId: "crew-1",
    crewName: "Finish Team",
    workerId: "worker-1",
    workerName: "Ken Ito",
    assignmentDate: "2025-04-01",
    ...overrides,
  };
}

describe("labor-tracker", () => {
  it("records clock-in entries", () => {
    const entry = clockIn(makeEntry());

    expect(entry.id).toBe("entry-1");
    expect(getLaborEntries("proj-1")).toHaveLength(1);
  });

  it("updates an entry on clock-out", () => {
    clockIn(makeEntry());

    const updated = clockOut("entry-1", "2025-04-01T17:00:00.000Z");

    expect(updated?.status).toBe("completed");
    expect(updated?.clockOutTime).toBe("2025-04-01T17:00:00.000Z");
  });

  it("returns null when clocking out an unknown entry", () => {
    expect(clockOut("missing", "2025-04-01T17:00:00.000Z")).toBeNull();
  });

  it("stores crew assignments", () => {
    const assignment = assignWorkerToCrew(makeAssignment());

    expect(assignment.crewName).toBe("Finish Team");
    expect(getCrewAssignments("proj-1")).toHaveLength(1);
  });

  it("calculates overtime after eight hours", () => {
    const summary = calculateOvertime(
      makeEntry({
        clockOutTime: "2025-04-01T18:30:00.000Z",
        status: "completed",
      }),
    );

    expect(summary.totalHours).toBe(10.5);
    expect(summary.regularHours).toBe(8);
    expect(summary.overtimeHours).toBe(2.5);
    expect(summary.totalCost).toBe(47000);
  });

  it("returns zero overtime when a shift is incomplete", () => {
    const summary = calculateOvertime(makeEntry());

    expect(summary.totalHours).toBe(0);
    expect(summary.overtimeHours).toBe(0);
    expect(summary.totalCost).toBe(0);
  });

  it("calculates daily labor cost across multiple workers", () => {
    clockIn(
      makeEntry({
        id: "entry-1",
        clockOutTime: "2025-04-01T17:00:00.000Z",
        status: "completed",
      }),
    );
    clockIn(
      makeEntry({
        id: "entry-2",
        workerId: "worker-2",
        workerName: "Mika Abe",
        hourlyRate: 3500,
        clockOutTime: "2025-04-01T19:00:00.000Z",
        status: "completed",
      }),
    );

    const summary = calculateDailyLaborCost("proj-1", "2025-04-01");

    expect(summary.workerCount).toBe(2);
    expect(summary.totalHours).toBe(20);
    expect(summary.overtimeHours).toBe(4);
    expect(summary.totalCost).toBe(81750);
  });

  it("filters labor entries by project and date", () => {
    clockIn(makeEntry());
    clockIn(makeEntry({ id: "entry-2", projectId: "proj-2" }));
    clockIn(makeEntry({ id: "entry-3", clockInTime: "2025-04-02T08:00:00.000Z" }));

    expect(getLaborEntries("proj-1", "2025-04-01")).toHaveLength(1);
  });
});
