import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TasksPage } from "../pages/TasksPage.js";
import { navigate } from "../hooks/useHashRouter.js";

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

vi.mock("../hooks/useHashRouter.js", () => ({
  navigate: vi.fn(),
}));

vi.mock("../lib/last-project.js", () => ({
  readLastProjectId: vi.fn(() => null),
  writeLastProjectId: vi.fn(),
}));

const mockProjectRepository = { findAll: vi.fn() };
const mockTaskRepository = { findAll: vi.fn() };
const mockContractorRepository = { findAll: vi.fn() };

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => mockProjectRepository,
}));

vi.mock("../stores/task-store.js", () => ({
  createTaskRepository: () => mockTaskRepository,
}));

vi.mock("../stores/contractor-store.js", () => ({
  createContractorRepository: () => mockContractorRepository,
}));

describe("TasksPage", () => {
  beforeEach(() => {
    mockProjectRepository.findAll.mockReset();
    mockTaskRepository.findAll.mockReset();
    mockContractorRepository.findAll.mockReset();
    vi.mocked(navigate).mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("案件なし・タスクなしのとき「ガントで管理」「案件を選ぶ」CTAを表示する", async () => {
    mockProjectRepository.findAll.mockResolvedValue([]);
    mockTaskRepository.findAll.mockResolvedValue([]);
    mockContractorRepository.findAll.mockResolvedValue([]);

    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByText("タスクがありません")).toBeDefined();
    });
    expect(screen.getByText("ガントで管理")).toBeDefined();
    expect(screen.getByText("案件を選ぶ")).toBeDefined();
  });

  it("案件ありタスクなしのとき「最初のタスクを作成」CTAを表示する", async () => {
    const now = new Date().toISOString();
    mockProjectRepository.findAll.mockResolvedValue([
      { id: "p1", name: "南青山ビル", description: "", status: "active", startDate: "2026-01-01", includeWeekends: false, createdAt: now, updatedAt: now },
    ]);
    mockTaskRepository.findAll.mockResolvedValue([]);
    mockContractorRepository.findAll.mockResolvedValue([]);

    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByText("タスクがありません")).toBeDefined();
    });
    expect(screen.getByText("最初のタスクを作成")).toBeDefined();
    expect(screen.queryByText("案件を選ぶ")).toBeNull();
  });

  it("「案件を選ぶ」ボタンクリックで /projects に遷移する", async () => {
    mockProjectRepository.findAll.mockResolvedValue([]);
    mockTaskRepository.findAll.mockResolvedValue([]);
    mockContractorRepository.findAll.mockResolvedValue([]);

    render(<TasksPage />);

    const btn = await screen.findByText("案件を選ぶ");
    btn.click();

    expect(vi.mocked(navigate)).toHaveBeenCalledWith("/projects");
  });

  it("「最初のタスクを作成」クリックで /gantt/:projectId に遷移する", async () => {
    const now = new Date().toISOString();
    mockProjectRepository.findAll.mockResolvedValue([
      { id: "p1", name: "南青山ビル", description: "", status: "active", startDate: "2026-01-01", includeWeekends: false, createdAt: now, updatedAt: now },
    ]);
    mockTaskRepository.findAll.mockResolvedValue([]);
    mockContractorRepository.findAll.mockResolvedValue([]);

    render(<TasksPage />);

    const btn = await screen.findByText("最初のタスクを作成");
    btn.click();

    expect(vi.mocked(navigate)).toHaveBeenCalledWith("/gantt/p1");
  });
});
