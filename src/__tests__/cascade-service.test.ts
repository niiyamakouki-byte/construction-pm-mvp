import { describe, expect, it } from "vitest";
import {
  cascadeShiftPhase,
  detectPhaseOverlap,
} from "../domain/cascade-service.js";

const makeTask = (id: string, startDate: string, endDate: string) => ({
  id,
  projectId: "proj1",
  startDate,
  endDate,
});

describe("detectPhaseOverlap", () => {
  it("returns null when no overlap", () => {
    const phase1 = { projectId: "p", tasks: [makeTask("t1", "2025-01-01", "2025-01-10")] };
    const phase2 = { projectId: "p", tasks: [makeTask("t2", "2025-01-11", "2025-01-20")] };
    expect(detectPhaseOverlap(phase1, phase2)).toBeNull();
  });

  it("detects overlap and returns correct delay days", () => {
    const phase1 = { projectId: "p", tasks: [makeTask("t1", "2025-01-01", "2025-01-15")] };
    const phase2 = { projectId: "p", tasks: [makeTask("t2", "2025-01-10", "2025-01-20")] };
    const delay = detectPhaseOverlap(phase1, phase2);
    expect(delay).not.toBeNull();
    expect(delay).toBeGreaterThan(0);
  });

  it("returns null when either phase has no tasks", () => {
    const phase1 = { projectId: "p", tasks: [] };
    const phase2 = { projectId: "p", tasks: [makeTask("t2", "2025-01-01", "2025-01-10")] };
    expect(detectPhaseOverlap(phase1, phase2)).toBeNull();
    expect(detectPhaseOverlap(phase2, phase1)).toBeNull();
  });
});

describe("cascadeShiftPhase", () => {
  it("shifts all tasks by delayDays", () => {
    const phase = {
      projectId: "p",
      tasks: [
        makeTask("t1", "2025-02-01", "2025-02-05"),
        makeTask("t2", "2025-02-06", "2025-02-10"),
      ],
    };
    const result = cascadeShiftPhase(phase, 5);
    expect(result.delayDays).toBe(5);
    expect(result.shiftedTasks).toHaveLength(2);
    expect(result.shiftedTasks[0].newStartDate).toBe("2025-02-06");
    expect(result.shiftedTasks[0].newEndDate).toBe("2025-02-10");
    expect(result.shiftedTasks[1].newStartDate).toBe("2025-02-11");
    expect(result.shiftedTasks[1].newEndDate).toBe("2025-02-15");
  });

  it("preserves task ids", () => {
    const phase = {
      projectId: "p",
      tasks: [makeTask("abc-123", "2025-03-01", "2025-03-07")],
    };
    const result = cascadeShiftPhase(phase, 3);
    expect(result.shiftedTasks[0].id).toBe("abc-123");
  });
});
