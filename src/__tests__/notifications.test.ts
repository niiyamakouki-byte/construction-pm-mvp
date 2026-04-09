import { describe, expect, it } from "vitest";
import type { CostItem, Expense, Project, Task } from "../domain/types.js";
import { buildNotifications } from "../lib/notifications.js";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p-1",
    name: "渋谷駅前新築",
    description: "",
    status: "active",
    startDate: "2025-01-01",
    includeWeekends: true,
    budget: 100000,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t-1",
    projectId: "p-1",
    name: "足場組立",
    description: "",
    status: "todo",
    progress: 0,
    dependencies: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeCostItem(overrides: Partial<CostItem> = {}): CostItem {
  return {
    id: "c-1",
    projectId: "p-1",
    description: "鉄骨手配",
    amount: 120000,
    category: "材料費",
    paymentStatus: "paid",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildNotifications", () => {
  it("builds overdue, budget overrun, and upcoming deadline notifications in priority order", () => {
    const notifications = buildNotifications({
      projects: [makeProject()],
      tasks: [
        makeTask({ id: "t-overdue", name: "外壁塗装", dueDate: "2025-01-09" }),
        makeTask({ id: "t-upcoming", name: "資材搬入", dueDate: "2025-01-12" }),
      ],
      costItems: [makeCostItem()],
      expenses: [] satisfies Expense[],
      today: "2025-01-10",
    });

    expect(notifications.map((item) => item.type)).toEqual([
      "overdue_task",
      "cost_overrun",
      "upcoming_deadline",
    ]);
    expect(notifications[0].message).toContain("外壁塗装");
    expect(notifications[1].message).toContain("予算超過");
    expect(notifications[2].message).toContain("2025-01-12");
  });

  it("ignores cost-like tasks from deadline notifications", () => {
    const notifications = buildNotifications({
      projects: [makeProject()],
      tasks: [
        makeTask({
          id: "t-cost",
          name: "Grow 広告運用",
          description: "外注費 50000円",
          dueDate: "2025-01-11",
        }),
      ],
      today: "2025-01-10",
    });

    expect(notifications).toEqual([]);
  });
});
