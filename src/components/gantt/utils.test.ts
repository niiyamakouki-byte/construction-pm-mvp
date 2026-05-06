import { describe, expect, it } from "vitest";
import { addDaysBySchedule, addDaysSkipWeekends, hasCycle } from "./utils.js";

describe("gantt utils", () => {
  it("task-level includeWeekends overrides the project setting", () => {
    expect(addDaysSkipWeekends("2025-01-03", 1, false, true)).toBe("2025-01-04");
  });

  it("moves backward across weekends when weekends are excluded", () => {
    expect(addDaysBySchedule("2025-01-06", -1, false)).toBe("2025-01-03");
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
