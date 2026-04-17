import { describe, expect, it } from "vitest";
import { searchGanttTasks } from "../lib/gantt/gantt-search.js";
import type { CrossProjectGanttTask } from "../lib/gantt/cross-project-gantt.js";

function makeTask(overrides?: Partial<CrossProjectGanttTask>): CrossProjectGanttTask {
  return {
    id: "t1",
    projectId: "proj-1",
    projectName: "内装工事プロジェクト",
    name: "クロス貼り",
    description: "",
    status: "todo",
    progress: 0,
    dependencies: [],
    assigneeId: "user-yamamoto",
    startDate: "2025-07-01",
    endDate: "2025-07-10",
    dueDate: "2025-07-10",
    isDateEstimated: false,
    isMilestone: false,
    projectIncludesWeekends: false,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

// ── searchGanttTasks – text query ─────────────────────────────────────

describe("searchGanttTasks – text query", () => {
  it("returns all tasks when query is empty", () => {
    const tasks = [makeTask({ id: "t1" }), makeTask({ id: "t2" })];
    const results = searchGanttTasks({}, tasks);
    expect(results).toHaveLength(2);
  });

  it("matches by task name (case-insensitive)", () => {
    const tasks = [
      makeTask({ id: "t1", name: "クロス貼り" }),
      makeTask({ id: "t2", name: "塗装工事" }),
    ];
    const results = searchGanttTasks({ query: "クロス" }, tasks);
    expect(results).toHaveLength(1);
    expect(results[0].task.id).toBe("t1");
  });

  it("matches by projectName", () => {
    const tasks = [
      makeTask({ id: "t1", projectName: "南青山リノベ" }),
      makeTask({ id: "t2", projectName: "渋谷オフィス改装" }),
    ];
    const results = searchGanttTasks({ query: "南青山" }, tasks);
    expect(results).toHaveLength(1);
    expect(results[0].task.id).toBe("t1");
  });

  it("matches by assigneeId", () => {
    const tasks = [
      makeTask({ id: "t1", assigneeId: "user-suzuki" }),
      makeTask({ id: "t2", assigneeId: "user-tanaka" }),
    ];
    const results = searchGanttTasks({ query: "suzuki" }, tasks);
    expect(results).toHaveLength(1);
    expect(results[0].task.id).toBe("t1");
  });

  it("returns highlights with correct startIndex and endIndex for name match", () => {
    const tasks = [makeTask({ name: "クロス貼り" })];
    const results = searchGanttTasks({ query: "クロス" }, tasks);
    const nameHighlight = results[0].highlights.find((h) => h.field === "name");
    expect(nameHighlight).toBeDefined();
    expect(nameHighlight!.startIndex).toBe(0);
    expect(nameHighlight!.endIndex).toBe(3);
  });

  it("returns empty highlights when query is blank", () => {
    const tasks = [makeTask()];
    const results = searchGanttTasks({ query: "" }, tasks);
    expect(results[0].highlights).toHaveLength(0);
  });

  it("returns no results when query matches nothing", () => {
    const tasks = [makeTask({ name: "基礎工事" })];
    const results = searchGanttTasks({ query: "存在しないキーワード" }, tasks);
    expect(results).toHaveLength(0);
  });
});

// ── searchGanttTasks – status filter ─────────────────────────────────

describe("searchGanttTasks – status filter", () => {
  it("filters by single status", () => {
    const tasks = [
      makeTask({ id: "t1", status: "todo" }),
      makeTask({ id: "t2", status: "in_progress" }),
      makeTask({ id: "t3", status: "done" }),
    ];
    const results = searchGanttTasks({ statuses: ["todo"] }, tasks);
    expect(results).toHaveLength(1);
    expect(results[0].task.id).toBe("t1");
  });

  it("filters by multiple statuses", () => {
    const tasks = [
      makeTask({ id: "t1", status: "todo" }),
      makeTask({ id: "t2", status: "in_progress" }),
      makeTask({ id: "t3", status: "done" }),
    ];
    const results = searchGanttTasks({ statuses: ["todo", "done"] }, tasks);
    expect(results).toHaveLength(2);
  });

  it("returns all tasks when statuses array is empty", () => {
    const tasks = [makeTask({ id: "t1" }), makeTask({ id: "t2" })];
    const results = searchGanttTasks({ statuses: [] }, tasks);
    expect(results).toHaveLength(2);
  });
});

// ── searchGanttTasks – assigneeId filter ─────────────────────────────

describe("searchGanttTasks – assigneeId filter", () => {
  it("filters by exact assigneeId", () => {
    const tasks = [
      makeTask({ id: "t1", assigneeId: "user-a" }),
      makeTask({ id: "t2", assigneeId: "user-b" }),
    ];
    const results = searchGanttTasks({ assigneeId: "user-a" }, tasks);
    expect(results).toHaveLength(1);
    expect(results[0].task.id).toBe("t1");
  });

  it("excludes tasks with no assignee when assigneeId filter is set", () => {
    const tasks = [
      makeTask({ id: "t1", assigneeId: undefined }),
      makeTask({ id: "t2", assigneeId: "user-b" }),
    ];
    const results = searchGanttTasks({ assigneeId: "user-b" }, tasks);
    expect(results).toHaveLength(1);
    expect(results[0].task.id).toBe("t2");
  });
});

// ── searchGanttTasks – combined filters ──────────────────────────────

describe("searchGanttTasks – combined filters", () => {
  it("applies query + status filter together", () => {
    const tasks = [
      makeTask({ id: "t1", name: "クロス貼り", status: "todo" }),
      makeTask({ id: "t2", name: "クロス補修", status: "done" }),
      makeTask({ id: "t3", name: "塗装工事", status: "todo" }),
    ];
    const results = searchGanttTasks({ query: "クロス", statuses: ["todo"] }, tasks);
    expect(results).toHaveLength(1);
    expect(results[0].task.id).toBe("t1");
  });

  it("applies all three filters simultaneously", () => {
    const tasks = [
      makeTask({ id: "t1", name: "クロス貼り", status: "in_progress", assigneeId: "user-a", projectName: "A工事" }),
      makeTask({ id: "t2", name: "クロス補修", status: "in_progress", assigneeId: "user-b", projectName: "A工事" }),
      makeTask({ id: "t3", name: "クロス貼り", status: "todo", assigneeId: "user-a", projectName: "A工事" }),
    ];
    const results = searchGanttTasks(
      { query: "クロス", statuses: ["in_progress"], assigneeId: "user-a" },
      tasks,
    );
    expect(results).toHaveLength(1);
    expect(results[0].task.id).toBe("t1");
  });
});
