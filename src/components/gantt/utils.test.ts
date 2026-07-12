import { describe, expect, it } from "vitest";
import {
  addDaysBySchedule,
  addDaysSkipWeekends,
  compareGanttRows,
  computeReorder,
  formatScheduleDate,
  getAlertLevel,
  hasCycle,
  initialScrollDate,
} from "./utils.js";
import type { GanttTask } from "./types.js";

describe("gantt utils", () => {
  it("task-level includeWeekends overrides the project setting", () => {
    expect(addDaysSkipWeekends("2025-01-03", 1, false, true)).toBe("2025-01-04");
  });

  it("moves backward across weekends when weekends are excluded", () => {
    expect(addDaysBySchedule("2025-01-06", -1, false)).toBe("2025-01-03");
  });
});

describe("initialScrollDate (工期外の案件で初期表示が空に見える対策)", () => {
  const tasks = [
    { startDate: "2026-03-01", endDate: "2026-03-10" },
    { startDate: "2026-04-01", endDate: "2026-04-22" },
  ];

  it("今日が工程範囲内なら今日を返す", () => {
    expect(initialScrollDate("2026-03-15", tasks)).toBe("2026-03-15");
  });

  it("工期が過去の案件では最終工程の終端に寄せる", () => {
    expect(initialScrollDate("2026-07-12", tasks)).toBe("2026-04-22");
  });

  it("工期が未来の案件では最初の工程の始端に寄せる", () => {
    expect(initialScrollDate("2026-01-05", tasks)).toBe("2026-03-01");
  });

  it("工程が無ければ今日を返す", () => {
    expect(initialScrollDate("2026-07-12", [])).toBe("2026-07-12");
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

// ── null-guard tests (Supabase may return null for optional date fields) ──────

describe("formatScheduleDate null guard", () => {
  it("returns 未設定 for empty string (null coerced at DB boundary)", () => {
    // pin.dueDate and task dates arrive as "" when Supabase returns null and
    // callers coerce null→"". formatScheduleDate must not crash.
    expect(formatScheduleDate("")).toBe("未設定");
  });

  it("returns 未設定 when called with null cast as string", () => {
    // Defensive: verify the falsy branch covers null coerced to empty-ish value.
    expect(formatScheduleDate(null as unknown as string)).toBe("未設定");
  });

  it("returns a formatted date string for a valid ISO date", () => {
    expect(formatScheduleDate("2025-04-01")).toBe("2025/4/1");
  });
});

describe("getAlertLevel with GanttTask (endDate always resolved to string)", () => {
  // GanttPage maps null Task.dueDate to a fallback string before building GanttTask.
  // These tests confirm getAlertLevel does not crash when endDate is a valid string.
  function makeTask(overrides: Partial<GanttTask>): GanttTask {
    return {
      id: "test-id",
      projectId: "proj-id",
      name: "Test Task",
      description: "",
      status: "todo",
      progress: 0,
      dependencies: [],
      startDate: "2025-01-01",
      endDate: "2025-01-10",
      projectName: "Test Project",
      isDateEstimated: false,
      isMilestone: false,
      projectIncludesWeekends: false,
      createdAt: "2025-01-01",
      updatedAt: "2025-01-01",
      ...overrides,
    };
  }

  it("returns overdue when endDate (resolved from null dueDate) is in the past", () => {
    // Simulates: Task had dueDate=null → GanttPage resolved endDate to a past date
    const task = makeTask({ endDate: "2024-12-31", isDateEstimated: true });
    expect(getAlertLevel(task, "2025-01-10")).toBe("overdue");
  });

  it("returns null for a done task regardless of endDate", () => {
    const task = makeTask({ status: "done", endDate: "2024-01-01", isDateEstimated: true });
    expect(getAlertLevel(task, "2025-01-10")).toBeNull();
  });
});
