import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CrossProjectGanttPage } from "../pages/CrossProjectGanttPage.js";
import type { Project, Task } from "../domain/types.js";

const mockProjectFindAll = vi.fn();
const mockTaskFindAll = vi.fn();

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

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

const baseProject: Project = {
  id: "proj-1",
  name: "南青山リノベーション",
  description: "内装工事",
  status: "active",
  startDate: "2025-01-01",
  budget: 5_000_000,
  includeWeekends: false,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const baseTask: Task = {
  id: "task-1",
  projectId: "proj-1",
  name: "基礎工事",
  description: "",
  status: "in_progress",
  progress: 50,
  dueDate: "2025-02-01",
  assigneeId: "tanaka",
  dependencies: [],
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

describe("CrossProjectGanttPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectFindAll.mockResolvedValue([baseProject]);
    mockTaskFindAll.mockResolvedValue([baseTask]);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders loading state initially", () => {
    render(<CrossProjectGanttPage />);
    expect(screen.getByText("読み込み中...")).toBeDefined();
  });

  it("renders page title after load", async () => {
    render(<CrossProjectGanttPage />);
    const el = await screen.findByText("全案件ガントチャート");
    expect(el).toBeDefined();
  });

  it("renders search bar after load", async () => {
    render(<CrossProjectGanttPage />);
    await screen.findByText("全案件ガントチャート");
    const input = screen.getByPlaceholderText("タスク・担当者・案件名で検索...");
    expect(input).toBeDefined();
  });

  it("renders status filter dropdown", async () => {
    render(<CrossProjectGanttPage />);
    await screen.findByText("全案件ガントチャート");
    const select = screen.getByRole("combobox", { name: "ステータスフィルタ" });
    expect(select).toBeDefined();
  });

  it("renders project summary card with project name", async () => {
    render(<CrossProjectGanttPage />);
    const cards = await screen.findAllByText("南青山リノベーション");
    expect(cards.length).toBeGreaterThan(0);
  });

  it("renders task name in grouped list", async () => {
    render(<CrossProjectGanttPage />);
    const el = await screen.findByText("基礎工事");
    expect(el).toBeDefined();
  });

  it("filters tasks by search query", async () => {
    mockTaskFindAll.mockResolvedValue([
      baseTask,
      { ...baseTask, id: "task-2", name: "電気配線工事" },
    ]);
    const user = userEvent.setup();
    render(<CrossProjectGanttPage />);
    await screen.findByText("基礎工事");
    await screen.findByText("電気配線工事");

    const input = screen.getByPlaceholderText("タスク・担当者・案件名で検索...");
    await user.type(input, "基礎");

    await waitFor(() => {
      expect(screen.getByText("基礎工事")).toBeDefined();
      expect(screen.queryByText("電気配線工事")).toBeNull();
    });
  });

  it("shows empty state when no tasks match filter", async () => {
    const user = userEvent.setup();
    render(<CrossProjectGanttPage />);
    await screen.findByText("基礎工事");

    const input = screen.getByPlaceholderText("タスク・担当者・案件名で検索...");
    await user.type(input, "存在しないタスク名XYZ");

    await waitFor(() => {
      expect(screen.getByText("条件に一致するタスクが見つかりません")).toBeDefined();
    });
  });

  it("shows empty state when no projects or tasks exist", async () => {
    mockProjectFindAll.mockResolvedValue([]);
    mockTaskFindAll.mockResolvedValue([]);
    render(<CrossProjectGanttPage />);
    const el = await screen.findByText("タスクがありません");
    expect(el).toBeDefined();
  });
});
