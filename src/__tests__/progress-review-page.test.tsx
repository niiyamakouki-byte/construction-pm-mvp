import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressReviewPage } from "../pages/ProgressReviewPage.js";
import { navigate } from "../hooks/useHashRouter.js";

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

vi.mock("../hooks/useHashRouter.js", () => ({
  navigate: vi.fn(),
}));

const mockProjectRepository = { findAll: vi.fn() };
const mockTaskRepository = { findAll: vi.fn() };

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => mockProjectRepository,
}));

vi.mock("../stores/task-store.js", () => ({
  createTaskRepository: () => mockTaskRepository,
}));

describe("ProgressReviewPage", () => {
  beforeEach(() => {
    mockProjectRepository.findAll.mockReset();
    mockTaskRepository.findAll.mockReset();
    vi.mocked(navigate).mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("案件ゼロのとき案件選択と写真選択の前提説明CTAを表示する", async () => {
    mockProjectRepository.findAll.mockResolvedValue([]);
    mockTaskRepository.findAll.mockResolvedValue([]);

    render(<ProgressReviewPage />);

    await waitFor(() => {
      expect(screen.getByText("進捗レビューは、案件選択と写真選択を先に行います")).toBeDefined();
    });
    expect(screen.getByText("案件を選ぶ")).toBeDefined();
    expect(screen.getByText("写真をアップロード")).toBeDefined();
  });

  it("「案件を選ぶ」ボタンクリックで /app に遷移する", async () => {
    mockProjectRepository.findAll.mockResolvedValue([]);
    mockTaskRepository.findAll.mockResolvedValue([]);

    render(<ProgressReviewPage />);

    const btn = await screen.findByText("案件を選ぶ");
    btn.click();

    expect(vi.mocked(navigate)).toHaveBeenCalledWith("/app");
  });

  it("「写真をアップロード」ボタンクリックで /today に遷移する", async () => {
    mockProjectRepository.findAll.mockResolvedValue([]);
    mockTaskRepository.findAll.mockResolvedValue([]);

    render(<ProgressReviewPage />);

    const btn = await screen.findByText("写真をアップロード");
    btn.click();

    expect(vi.mocked(navigate)).toHaveBeenCalledWith("/today");
  });

  it("コスト集計用の疑似タスク(Grow等)を除外し、工程表(Gantt)と同じ件数を表示する (regression construction_pm_mvp-7ry)", async () => {
    // Mirrors production: 渋谷ワインバー Bre.S SHIBUYA has 16 rows in the tasks table,
    // 2 of which are vendor labor-cost pseudo-tasks ("Grow 2月 労務費" 等) that GanttPage
    // already excludes via filterScheduleTasks(). Before the fix, ProgressReviewPage counted
    // all 16 raw rows, showing 16件 here vs 14件 on the Gantt screen for the same project.
    const project = {
      id: "proj-1",
      name: "渋谷ワインバー Bre.S SHIBUYA",
      description: "",
      status: "active" as const,
      startDate: "2026-03-01",
      includeWeekends: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const makeTask = (id: string, name: string) => ({
      id,
      projectId: "proj-1",
      name,
      description: "",
      status: "done" as const,
      startDate: "2026-03-01",
      dueDate: "2026-03-05",
      progress: 0,
      dependencies: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const tasks = [
      makeTask("t1", "仮設工事"),
      makeTask("t2", "給排水設備工事"),
      makeTask("t3", "Grow 2月 労務費（渋谷ワインバー）"),
      makeTask("t4", "Grow 3月 労務費（渋谷ワインバー）"),
    ];

    mockProjectRepository.findAll.mockResolvedValue([project]);
    mockTaskRepository.findAll.mockResolvedValue(tasks);

    render(<ProgressReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/件の工程/)).toBeDefined();
    });
    expect(screen.getByText(/^2件の工程/)).toBeDefined();
  });
});
