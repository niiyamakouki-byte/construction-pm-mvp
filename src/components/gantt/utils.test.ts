import { describe, expect, it } from "vitest";
import {
  addDaysBySchedule,
  addDaysSkipWeekends,
  compareGanttRows,
  computeReorder,
  hasCycle,
} from "./utils.js";

describe("gantt utils", () => {
  it("task-level includeWeekends overrides the project setting", () => {
    expect(addDaysSkipWeekends("2025-01-03", 1, false, true)).toBe("2025-01-04");
  });

  it("moves backward across weekends when weekends are excluded", () => {
    expect(addDaysBySchedule("2025-01-06", -1, false)).toBe("2025-01-03");
  });
});

describe("compareGanttRows", () => {
  it("orders by sortIndex when both rows have one", () => {
    const left = { sortIndex: 2, startDate: "2025-01-01", endDate: "2025-01-02" };
    const right = { sortIndex: 1, startDate: "2025-01-10", endDate: "2025-01-11" };
    expect(compareGanttRows(left, right)).toBeGreaterThan(0);
  });

  it("falls back to startDate then endDate when sortIndex is missing", () => {
    const left = { startDate: "2025-01-05", endDate: "2025-01-09" };
    const right = { startDate: "2025-01-05", endDate: "2025-01-12" };
    expect(compareGanttRows(left, right)).toBeLessThan(0);
  });
});

describe("computeReorder", () => {
  const ids = ["a", "b", "c"];

  it("swaps a task with its lower neighbor when moving down", () => {
    const { sortIndexById, changed } = computeReorder(ids, "a", "down");
    expect(changed).toBe(true);
    // a and b swap: a→1, b→0, c stays 2 → new order b, a, c
    const ordered = [...ids].sort((l, r) => sortIndexById.get(l)! - sortIndexById.get(r)!);
    expect(ordered).toEqual(["b", "a", "c"]);
  });

  it("swaps a task with its upper neighbor when moving up", () => {
    const { sortIndexById, changed } = computeReorder(ids, "c", "up");
    expect(changed).toBe(true);
    const ordered = [...ids].sort((l, r) => sortIndexById.get(l)! - sortIndexById.get(r)!);
    expect(ordered).toEqual(["a", "c", "b"]);
  });

  it("leaves order unchanged when the first row moves up", () => {
    const { sortIndexById, changed } = computeReorder(ids, "a", "up");
    expect(changed).toBe(false);
    const ordered = [...ids].sort((l, r) => sortIndexById.get(l)! - sortIndexById.get(r)!);
    expect(ordered).toEqual(["a", "b", "c"]);
  });

  it("leaves order unchanged when the last row moves down", () => {
    const { changed } = computeReorder(ids, "c", "down");
    expect(changed).toBe(false);
  });
});

describe("hasCycle", () => {
  it("returns false when there are no dependencies", () => {
    const tasks = [
      { id: "a", dependencies: [] },
      { id: "b", dependencies: [] },
    ];
    expect(hasCycle(tasks, "a", "b")).toBe(false);
  });

  it("returns false for a simple linear chain a→b, adding b→c", () => {
    // existing: b depends on a (a→b). We want to add c depends on b (b→c).
    const tasks = [
      { id: "a", dependencies: [] },
      { id: "b", dependencies: ["a"] },
      { id: "c", dependencies: [] },
    ];
    expect(hasCycle(tasks, "b", "c")).toBe(false);
  });

  it("detects a direct cycle (a→b, then b→a)", () => {
    // existing: b depends on a. Now user tries to add a depends on b.
    const tasks = [
      { id: "a", dependencies: [] },
      { id: "b", dependencies: ["a"] },
    ];
    // fromId=b, toId=a means "a will depend on b", i.e. edge b→a
    expect(hasCycle(tasks, "b", "a")).toBe(true);
  });

  it("detects a transitive cycle (a→b→c, then c→a)", () => {
    const tasks = [
      { id: "a", dependencies: [] },
      { id: "b", dependencies: ["a"] },
      { id: "c", dependencies: ["b"] },
    ];
    // trying to add a depends on c: fromId=c, toId=a
    expect(hasCycle(tasks, "c", "a")).toBe(true);
  });

  it("returns false when the chain does not loop back", () => {
    const tasks = [
      { id: "a", dependencies: [] },
      { id: "b", dependencies: ["a"] },
      { id: "c", dependencies: ["b"] },
      { id: "d", dependencies: [] },
    ];
    // adding d depends on c: fromId=c, toId=d — no cycle
    expect(hasCycle(tasks, "c", "d")).toBe(false);
  });

  it("returns false when self-loop is the only edge (handled separately)", () => {
    const tasks = [{ id: "a", dependencies: [] }];
    // self-loop is caught by caller (fromId === toId), hasCycle still returns true
    expect(hasCycle(tasks, "a", "a")).toBe(true);
  });
});
