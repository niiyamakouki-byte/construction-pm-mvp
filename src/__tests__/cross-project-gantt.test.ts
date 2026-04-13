import { describe, expect, it } from "vitest";
import {
  getCrossProjectTasks,
  groupByProject,
  getProjectSummaryCards,
  type CrossProjectGanttTask,
} from "../lib/gantt/cross-project-gantt.js";
import type { GanttTask } from "../components/gantt/types.js";

function makeGanttTask(overrides?: Partial<GanttTask>): GanttTask {
  return {
    id: "task-1",
    projectId: "proj-1",
    name: "基礎工事",
    description: "",
    status: "todo",
    progress: 0,
    dependencies: [],
    startDate: "2025-07-01",
    endDate: "2025-07-15",
    dueDate: "2025-07-15",
    isDateEstimated: false,
    isMilestone: false,
    projectIncludesWeekends: false,
    projectName: "プロジェクトA",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeCrossTask(overrides?: Partial<CrossProjectGanttTask>): CrossProjectGanttTask {
  return {
    ...makeGanttTask(),
    projectId: "proj-1",
    projectName: "プロジェクトA",
    ...overrides,
  };
}

// ── getCrossProjectTasks ──────────────────────────────────────────────

describe("getCrossProjectTasks", () => {
  it("returns empty array when no projects", () => {
    expect(getCrossProjectTasks([])).toEqual([]);
  });

  it("combines tasks from a single project", () => {
    const tasks = [
      makeGanttTask({ id: "t1", name: "Task 1" }),
      makeGanttTask({ id: "t2", name: "Task 2" }),
    ];
    const result = getCrossProjectTasks([{ projectId: "proj-1", projectName: "A", tasks }]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("t1");
    expect(result[1].id).toBe("t2");
  });

  it("combines tasks from multiple projects and preserves projectId/projectName", () => {
    const result = getCrossProjectTasks([
      {
        projectId: "p1",
        projectName: "Project One",
        tasks: [makeGanttTask({ id: "t1", projectId: "p1" })],
      },
      {
        projectId: "p2",
        projectName: "Project Two",
        tasks: [makeGanttTask({ id: "t2", projectId: "p2" })],
      },
    ]);
    expect(result).toHaveLength(2);
    expect(result.find((t) => t.id === "t1")?.projectName).toBe("Project One");
    expect(result.find((t) => t.id === "t2")?.projectName).toBe("Project Two");
  });

  it("overrides projectName from the input group rather than task field", () => {
    const task = makeGanttTask({ id: "t1", projectId: "p1" });
    const result = getCrossProjectTasks([
      { projectId: "p1", projectName: "Canonical Name", tasks: [task] },
    ]);
    expect(result[0].projectName).toBe("Canonical Name");
  });

  it("handles project with zero tasks gracefully", () => {
    const result = getCrossProjectTasks([
      { projectId: "p1", projectName: "Empty", tasks: [] },
    ]);
    expect(result).toHaveLength(0);
  });
});

// ── groupByProject ────────────────────────────────────────────────────

describe("groupByProject", () => {
  it("returns empty map for empty input", () => {
    expect(groupByProject([])).toEqual(new Map());
  });

  it("groups tasks under correct projectId", () => {
    const tasks = [
      makeCrossTask({ id: "t1", projectId: "p1" }),
      makeCrossTask({ id: "t2", projectId: "p2" }),
      makeCrossTask({ id: "t3", projectId: "p1" }),
    ];
    const map = groupByProject(tasks);
    expect(map.get("p1")).toHaveLength(2);
    expect(map.get("p2")).toHaveLength(1);
  });

  it("each group contains only tasks from that project", () => {
    const tasks = [
      makeCrossTask({ id: "t1", projectId: "p1", name: "Alpha" }),
      makeCrossTask({ id: "t2", projectId: "p2", name: "Beta" }),
    ];
    const map = groupByProject(tasks);
    for (const t of map.get("p1")!) {
      expect(t.projectId).toBe("p1");
    }
  });
});

// ── getProjectSummaryCards ────────────────────────────────────────────

describe("getProjectSummaryCards", () => {
  it("returns empty array for empty task list", () => {
    expect(getProjectSummaryCards([], "2025-07-01")).toEqual([]);
  });

  it("computes taskCount and completedCount correctly", () => {
    const tasks = [
      makeCrossTask({ id: "t1", status: "done", progress: 100 }),
      makeCrossTask({ id: "t2", status: "in_progress", progress: 50 }),
      makeCrossTask({ id: "t3", status: "todo", progress: 0 }),
    ];
    const [card] = getProjectSummaryCards(tasks, "2025-07-01");
    expect(card.taskCount).toBe(3);
    expect(card.completedCount).toBe(1);
  });

  it("computes progressRate as rounded average", () => {
    const tasks = [
      makeCrossTask({ id: "t1", progress: 60 }),
      makeCrossTask({ id: "t2", progress: 40 }),
    ];
    const [card] = getProjectSummaryCards(tasks, "2025-07-01");
    expect(card.progressRate).toBe(50);
  });

  it("counts overdueCount: past dueDate and not done", () => {
    const today = "2025-07-20";
    const tasks = [
      makeCrossTask({ id: "t1", status: "todo", dueDate: "2025-07-10", progress: 0 }),
      makeCrossTask({ id: "t2", status: "in_progress", dueDate: "2025-07-15", progress: 20 }),
      makeCrossTask({ id: "t3", status: "done", dueDate: "2025-07-05", progress: 100 }),
      makeCrossTask({ id: "t4", status: "todo", dueDate: "2025-07-25", progress: 0 }),
    ];
    const [card] = getProjectSummaryCards(tasks, today);
    // t1 and t2 are overdue (past dueDate, not done)
    expect(card.overdueCount).toBe(2);
  });

  it("produces separate cards per project", () => {
    const tasks = [
      makeCrossTask({ id: "t1", projectId: "p1", projectName: "Alpha", progress: 100, status: "done" }),
      makeCrossTask({ id: "t2", projectId: "p2", projectName: "Beta", progress: 0 }),
    ];
    const cards = getProjectSummaryCards(tasks, "2025-07-01");
    expect(cards).toHaveLength(2);
    const alphaCard = cards.find((c) => c.projectId === "p1");
    const betaCard = cards.find((c) => c.projectId === "p2");
    expect(alphaCard?.progressRate).toBe(100);
    expect(betaCard?.progressRate).toBe(0);
  });

  it("overdueCount is 0 when no tasks are overdue", () => {
    const tasks = [
      makeCrossTask({ id: "t1", status: "todo", dueDate: "2025-12-31", progress: 0 }),
    ];
    const [card] = getProjectSummaryCards(tasks, "2025-07-01");
    expect(card.overdueCount).toBe(0);
  });

  it("tasks without dueDate are not counted as overdue", () => {
    const tasks = [
      makeCrossTask({ id: "t1", status: "todo", dueDate: undefined, progress: 0 }),
    ];
    const [card] = getProjectSummaryCards(tasks, "2025-07-01");
    expect(card.overdueCount).toBe(0);
  });
});
