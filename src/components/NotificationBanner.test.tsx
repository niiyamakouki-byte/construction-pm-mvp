import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBanner } from "./NotificationBanner.js";
import type { CostItem, Expense, Project, Task } from "../domain/types.js";

let mockProjects: Project[] = [];
let mockTasks: Task[] = [];
let mockCostItems: CostItem[] = [];
let mockExpenses: Expense[] = [];

const mockProjectFindAll = vi.fn(async () => [...mockProjects]);
const mockTaskFindAll = vi.fn(async () => [...mockTasks]);
const mockCostItemFindAll = vi.fn(async () => [...mockCostItems]);
const mockExpenseFindAll = vi.fn(async () => [...mockExpenses]);
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => ({
    findAll: mockProjectFindAll,
  }),
}));

vi.mock("../stores/task-store.js", () => ({
  createTaskRepository: () => ({
    findAll: mockTaskFindAll,
  }),
}));

vi.mock("../stores/cost-item-store.js", () => ({
  createCostItemRepository: () => ({
    findAll: mockCostItemFindAll,
  }),
}));

vi.mock("../infra/create-app-repository.js", () => ({
  createAppRepository: () => ({
    findAll: mockExpenseFindAll,
  }),
}));

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

vi.mock("../hooks/useHashRouter.js", () => ({
  navigate: mockNavigate,
}));

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p-1",
    name: "青山オフィス改修",
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
    name: "足場解体",
    description: "",
    status: "todo",
    progress: 0,
    dependencies: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("NotificationBanner", () => {
  beforeEach(() => {
    cleanup();
    mockProjects = [];
    mockTasks = [];
    mockCostItems = [];
    mockExpenses = [];
    mockProjectFindAll.mockClear();
    mockTaskFindAll.mockClear();
    mockCostItemFindAll.mockClear();
    mockExpenseFindAll.mockClear();
    mockNavigate.mockClear();
  });

  it("renders workflow and weather alerts from repository data", async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    mockProjects = [
      makeProject({ id: "p-1", name: "青山オフィス改修" }),
      makeProject({ id: "p-2", name: "横浜倉庫新装", budget: 200000 }),
    ];
    mockTasks = [
      makeTask({
        id: "t-overdue",
        projectId: "p-1",
        name: "外壁洗浄",
        dueDate: "2000-01-01",
      }),
      makeTask({
        id: "t-upcoming",
        projectId: "p-1",
        name: "搬入確認",
        dueDate: toLocalDateString(tomorrow),
      }),
    ];
    mockCostItems = [
      {
        id: "c-1",
        projectId: "p-1",
        description: "仮設材",
        amount: 150000,
        category: "材料費",
        paymentStatus: "paid",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    ];

    render(<NotificationBanner refreshKey="/today" />);

    expect(await screen.findByText("重要通知 4件")).toBeDefined();
    expect(screen.getByText("期限超過タスク")).toBeDefined();
    expect(screen.getByText("予算超過")).toBeDefined();
    expect(screen.getByText("3日以内の期限")).toBeDefined();
    expect(screen.getByText("天候注意")).toBeDefined();
  });

  it("navigates to the notifications page from the banner action", async () => {
    const user = userEvent.setup();
    mockProjects = [makeProject({ id: "p-1", name: "青山オフィス改修" })];
    mockTasks = [makeTask({ id: "t-overdue", dueDate: "2000-01-01" })];

    render(<NotificationBanner refreshKey="/tasks" />);

    const button = await screen.findByRole("button", { name: "通知一覧へ" });
    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith("/notifications");
  });
});
