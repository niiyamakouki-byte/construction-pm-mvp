/**
 * TodayDashboardPage のテスト
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { TodayDashboardPage } from "../pages/TodayDashboardPage.js";
import type { Task, Project } from "../domain/types.js";

// Mock fetch for weather API
vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network"))));

// Shared store mock state
let mockTasks: Task[] = [];
let mockProjects: Project[] = [];

const mockTaskFindAll = vi.fn(async () => [...mockTasks]);
const mockTaskUpdate = vi.fn(async () => {});
const mockProjectFindAll = vi.fn(async () => [...mockProjects]);

vi.mock("../stores/task-store.js", () => ({
  createTaskRepository: () => ({
    findAll: mockTaskFindAll,
    update: mockTaskUpdate,
  }),
}));

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => ({
    findAll: mockProjectFindAll,
  }),
}));

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

vi.mock("../contexts/PersonaContext.js", () => ({
  usePersona: () => ({ persona: "worker" }),
}));

vi.mock("../hooks/useHashRouter.js", () => ({
  navigate: vi.fn(),
}));

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: `t-${Date.now()}-${Math.random()}`,
    projectId: "p-1",
    name: "テストタスク",
    description: "",
    status: "todo",
    progress: 0,
    dependencies: [],
    dueDate: today,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}


describe("TodayDashboardPage", () => {
  beforeEach(() => {
    cleanup();
    mockTasks = [];
    mockProjects = [];
    mockTaskFindAll.mockClear();
    mockTaskUpdate.mockClear();
    mockProjectFindAll.mockClear();
  });

  it("ページタイトル「今日のタスク」が表示される", async () => {
    render(<TodayDashboardPage />);
    await waitFor(() => expect(screen.getByText("今日のタスク")).toBeDefined());
  });

  it("データ読み込み後にタスク件数バッジが表示される", async () => {
    mockTasks = [makeTask({ name: "タスクA" })];
    render(<TodayDashboardPage />);
    await waitFor(() => expect(screen.getByText("1件")).toBeDefined());
  });

  it("初回ロード中はダッシュボード用スケルトンが表示される", () => {
    mockTaskFindAll.mockReturnValueOnce(new Promise(() => {}));
    mockProjectFindAll.mockReturnValueOnce(new Promise(() => {}));

    render(<TodayDashboardPage />);

    expect(
      screen.getByRole("status", { name: "ダッシュボードを読み込み中" }),
    ).toBeDefined();
  });

  it("空状態メッセージ「今日のタスクはありません」が表示される", async () => {
    render(<TodayDashboardPage />);
    await waitFor(() =>
      expect(screen.getByText("今日のタスクはありません")).toBeDefined(),
    );
  });

  it("期限が今日のタスクが表示される", async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockTasks = [makeTask({ name: "今日締切タスク", dueDate: today, status: "todo" })];
    render(<TodayDashboardPage />);
    await waitFor(() => expect(screen.getByText("今日締切タスク")).toBeDefined());
  });

  it("完了済みタスクはフィルタリングされて表示されない", async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockTasks = [
      makeTask({ name: "完了済みのタスク名", dueDate: today, status: "done" }),
      makeTask({ id: "t-2", name: "未着手タスク", dueDate: today, status: "todo" }),
    ];
    render(<TodayDashboardPage />);
    await waitFor(() => expect(screen.getByText("未着手タスク")).toBeDefined());
    expect(screen.queryByText("完了済みのタスク名")).toBeNull();
  });

  it("データ読み込みエラー時にエラーバナーが表示される", async () => {
    mockTaskFindAll.mockRejectedValueOnce(new Error("読み込みエラー発生"));
    render(<TodayDashboardPage />);
    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("読み込みエラー発生");
    });
  });

  it("stat カード（進行中案件・進行中タスク・完了タスク・期限超過）が表示される", async () => {
    mockTasks = [
      makeTask({ status: "in_progress", dueDate: undefined }),
      makeTask({ id: "t-2", status: "done" }),
    ];
    render(<TodayDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("進行中案件")).toBeDefined();
      expect(screen.getByText("進行中タスク")).toBeDefined();
      expect(screen.getByText("完了タスク")).toBeDefined();
      expect(screen.getByText("期限超過")).toBeDefined();
    });
  });

  it("「本日の概要」ヘッダーが表示される", async () => {
    render(<TodayDashboardPage />);
    await waitFor(() => expect(screen.getByText("本日の概要")).toBeDefined());
  });

  it("weather pageへの導線が表示される", async () => {
    render(<TodayDashboardPage />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "7日間の現場天気を見る" })).toBeDefined(),
    );
  });
});
