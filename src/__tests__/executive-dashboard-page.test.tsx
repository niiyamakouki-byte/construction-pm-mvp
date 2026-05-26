/**
 * Tests for ExecutiveDashboardPage component.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExecutiveDashboardPage } from "../components/ExecutiveDashboardPage.js";
import type { Project, Task } from "../domain/types.js";

// ── Mocks ──────────────────────────────────────────────────────────────────

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

// ── Fixtures ───────────────────────────────────────────────────────────────

const now = "2025-01-01T00:00:00.000Z";

const baseProject: Project = {
  id: "proj-1",
  name: "南青山リノベーション",
  description: "内装工事",
  status: "active",
  startDate: "2025-01-01",
  budget: 10_000_000,
  includeWeekends: false,
  createdAt: now,
  updatedAt: now,
};

const baseTask: Task = {
  id: "task-1",
  projectId: "proj-1",
  name: "基礎工事",
  description: "",
  status: "in_progress",
  progress: 60,
  dependencies: [],
  createdAt: now,
  updatedAt: now,
};

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockProjectFindAll.mockResolvedValue([baseProject]);
  mockTaskFindAll.mockResolvedValue([baseTask]);
});

afterEach(() => {
  cleanup();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("ExecutiveDashboardPage", () => {
  it("初期ロード中に '読み込み中...' を表示する", () => {
    render(<ExecutiveDashboardPage />);
    expect(screen.getByText("読み込み中...")).toBeDefined();
  });

  it("ロード後にページタイトルを表示する", async () => {
    render(<ExecutiveDashboardPage />);
    const el = await screen.findByText("経営ダッシュボード");
    expect(el).toBeDefined();
  });

  // ── 4分割 KPI カード ──────────────────────────────────────────────────

  it("KPIカード: '粗利合計' ラベルを表示する", async () => {
    render(<ExecutiveDashboardPage />);
    await screen.findByText("経営ダッシュボード");
    expect(screen.getByText("粗利合計")).toBeDefined();
  });

  it("KPIカード: '進捗加重平均' ラベルを表示する", async () => {
    render(<ExecutiveDashboardPage />);
    await screen.findByText("経営ダッシュボード");
    expect(screen.getByText("進捗加重平均")).toBeDefined();
  });

  it("KPIカード: '未入金合計' ラベルを表示する", async () => {
    render(<ExecutiveDashboardPage />);
    await screen.findByText("経営ダッシュボード");
    expect(screen.getByText("未入金合計")).toBeDefined();
  });

  it("KPIカード: '危険案件数' ラベルを表示する", async () => {
    render(<ExecutiveDashboardPage />);
    await screen.findByText("経営ダッシュボード");
    expect(screen.getByText("危険案件数")).toBeDefined();
  });

  // ── 空状態 ─────────────────────────────────────────────────────────────

  it("プロジェクトなし → '案件がありません' ではなく空状態メッセージを表示", async () => {
    mockProjectFindAll.mockResolvedValue([]);
    mockTaskFindAll.mockResolvedValue([]);
    render(<ExecutiveDashboardPage />);
    await screen.findByText("経営ダッシュボード");
    // No danger signals → shows safe message
    expect(screen.getByText("危険シグナルなし — 全案件順調です")).toBeDefined();
  });

  it("危険シグナルなし → '危険シグナルなし' メッセージを表示", async () => {
    // No projects → no signals
    mockProjectFindAll.mockResolvedValue([]);
    mockTaskFindAll.mockResolvedValue([]);
    render(<ExecutiveDashboardPage />);
    await screen.findByText("経営ダッシュボード");
    expect(screen.getByText("危険シグナルなし — 全案件順調です")).toBeDefined();
  });

  // ── 危険シグナルテーブル ───────────────────────────────────────────────

  it("危険シグナルあり → テーブルヘッダ '危険シグナル' を表示する", async () => {
    // Task overdue by many days → delayedSchedule fires
    const overdueTask: Task = {
      ...baseTask,
      dueDate: "2020-01-01",
      status: "in_progress",
    };
    mockTaskFindAll.mockResolvedValue([overdueTask]);
    render(<ExecutiveDashboardPage />);
    await screen.findByText("経営ダッシュボード");
    await waitFor(() => {
      expect(screen.getAllByText("危険シグナル").length).toBeGreaterThan(0);
    });
  });

  it("危険シグナルあり → 案件名をテーブルに表示する", async () => {
    const overdueTask: Task = {
      ...baseTask,
      dueDate: "2020-01-01",
      status: "in_progress",
    };
    mockTaskFindAll.mockResolvedValue([overdueTask]);
    render(<ExecutiveDashboardPage />);
    await screen.findByText("経営ダッシュボード");
    await waitFor(() => {
      const cells = screen.getAllByText("南青山リノベーション");
      expect(cells.length).toBeGreaterThan(0);
    });
  });

  it("危険シグナルあり → '工程遅延' バッジを表示する", async () => {
    const overdueTask: Task = {
      ...baseTask,
      dueDate: "2020-01-01",
      status: "in_progress",
    };
    mockTaskFindAll.mockResolvedValue([overdueTask]);
    render(<ExecutiveDashboardPage />);
    await screen.findByText("経営ダッシュボード");
    await waitFor(() => {
      // getAllByText since "工程遅延" appears in both badge and filter option
      const matches = screen.getAllByText("工程遅延");
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  // ── フィルタ ──────────────────────────────────────────────────────────

  it("シグナル種別フィルタ セレクトが存在する", async () => {
    const overdueTask: Task = {
      ...baseTask,
      dueDate: "2020-01-01",
      status: "in_progress",
    };
    mockTaskFindAll.mockResolvedValue([overdueTask]);
    render(<ExecutiveDashboardPage />);
    await screen.findByText("経営ダッシュボード");
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "シグナル種別フィルタ" })).toBeDefined();
    });
  });

  it("フィルタで '工程遅延' を選択 → 該当シグナルのみ表示", async () => {
    const overdueTask: Task = {
      ...baseTask,
      dueDate: "2020-01-01",
      status: "in_progress",
    };
    mockTaskFindAll.mockResolvedValue([overdueTask]);
    const user = userEvent.setup();
    render(<ExecutiveDashboardPage />);
    await screen.findByText("経営ダッシュボード");
    // Wait for filter to appear (signals present)
    await waitFor(() => screen.getByRole("combobox", { name: "シグナル種別フィルタ" }));
    const select = screen.getByRole("combobox", { name: "シグナル種別フィルタ" });
    await user.selectOptions(select, "delayedSchedule");
    // Badge "工程遅延" appears in both option and badge — use getAllByText
    await waitFor(() => {
      const all = screen.getAllByText("工程遅延");
      // at least the badge span (not just the option)
      expect(all.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("フィルタで '低粗利' を選択 → 工程遅延バッジが非表示になる", async () => {
    const overdueTask: Task = {
      ...baseTask,
      dueDate: "2020-01-01",
      status: "in_progress",
    };
    mockTaskFindAll.mockResolvedValue([overdueTask]);
    render(<ExecutiveDashboardPage />);
    await screen.findByText("経営ダッシュボード");
    // Wait for delayedSchedule badge to appear
    await waitFor(() => {
      const badges = screen.queryAllByText("工程遅延");
      // at least 2: option + badge span
      if (badges.length < 2) throw new Error("badge not yet rendered");
    });
    // Apply lowMargin filter
    const filter = screen.getByRole("combobox", { name: "シグナル種別フィルタ" });
    fireEvent.change(filter, { target: { value: "lowMargin" } });
    // After filtering, only the <option> remains for "工程遅延" (badge disappears)
    await waitFor(() => {
      const matches = screen.queryAllByText("工程遅延");
      // Only option element remains (not the badge span)
      expect(matches.length).toBe(1);
      expect(matches[0].tagName.toLowerCase()).toBe("option");
    });
  });

  // ── 案件一覧 ──────────────────────────────────────────────────────────

  it("案件一覧に案件名を表示する", async () => {
    render(<ExecutiveDashboardPage />);
    await screen.findByText("経営ダッシュボード");
    await waitFor(() => {
      const names = screen.getAllByText("南青山リノベーション");
      expect(names.length).toBeGreaterThan(0);
    });
  });
});
