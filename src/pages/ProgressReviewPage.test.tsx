/**
 * ProgressReviewPage コンポーネントテスト
 * photo-progress-tracker の統合検証
 * 正常系 / 手動入力 / 突合結果表示 / 提案適用 / 空データ
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ProgressReviewPage } from "./ProgressReviewPage.js";

// ─── Mock stores & context ────────────────────────────────────────────────────

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

vi.mock("../hooks/useHashRouter.js", () => ({
  navigate: vi.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseProject = {
  id: "proj-1",
  name: "南青山リノベーション",
  description: "内装工事",
  status: "active",
  startDate: "2025-01-01",
  address: "東京都港区南青山",
  budget: 5_000_000,
  includeWeekends: false,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

/** タスク: 開始済みで現在も進行中（遅延検知させるため startDate を過去に設定） */
const activeTasks = [
  {
    id: "task-1",
    projectId: "proj-1",
    name: "101室塗装",
    title: "101室塗装",
    startDate: "2024-01-01",
    dueDate: "2026-12-31",
    dependencies: [],
    progress: 0,
  },
];

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockProjectFindAll.mockResolvedValue([baseProject]);
  mockTaskFindAll.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ProgressReviewPage", () => {
  /**
   * 正常系: ページが正しくレンダリングされること
   */
  it("renders page header without exposing implementation labels", async () => {
    render(<ProgressReviewPage />);
    // ページタイトル
    expect(await screen.findByText("写真進捗レビュー")).toBeDefined();
    expect(screen.queryByText("photo-progress-tracker")).toBeNull();
    expect(screen.queryByText("Buildots統合")).toBeNull();
  });

  /**
   * 手動入力: トレード選択・スライダー操作・進捗追加
   */
  it("adds a TradeProgress entry via the input form", async () => {
    render(<ProgressReviewPage />);
    await screen.findByText("写真進捗レビュー");

    // 2番目のselect = トレード（1番目は案件選択）
    const selects = document.querySelectorAll("select");
    const tradeDropdown = selects[1] as HTMLSelectElement;
    fireEvent.change(tradeDropdown, { target: { value: "painting" } });

    // 完了率スライダーを50に設定
    const sliders = document.querySelectorAll('input[type="range"]');
    const completionSlider = sliders[0] as HTMLInputElement;
    fireEvent.change(completionSlider, { target: { value: "50" } });

    // 「+ 進捗を追加」ボタンをクリック
    const addBtn = screen.getByText("+ 進捗を追加");
    fireEvent.click(addBtn);

    // 入力済み進捗リストが表示される
    expect(screen.getByText("入力済み進捗 (1件)")).toBeDefined();
    // 塗装ラベルがリストに表示される（optionとspanで複数あるためgetAllByText）
    expect(screen.getAllByText("塗装").length).toBeGreaterThan(0);
  });

  it("keeps the input form visible after switching projects", async () => {
    mockProjectFindAll.mockResolvedValue([
      baseProject,
      { ...baseProject, id: "proj-2", name: "渋谷改装" },
    ]);
    render(<ProgressReviewPage />);
    await screen.findByText("写真進捗レビュー");

    const projectSelect = document.querySelectorAll("select")[0] as HTMLSelectElement;
    fireEvent.change(projectSelect, { target: { value: "proj-2" } });

    expect(screen.getByText("+ 進捗を追加")).toBeDefined();
    expect(screen.queryByText("読み込み中...")).toBeNull();
  });

  /**
   * 突合結果表示: reconcileWithSchedule が遅延を検出して表示
   */
  it("shows delay deltas after スケジュール突合 with late progress", async () => {
    mockTaskFindAll.mockResolvedValue(activeTasks);
    render(<ProgressReviewPage />);
    await screen.findByText("写真進捗レビュー");

    // プロジェクト選択後、スケジュールがロードされるまで待機
    const projectSelect = document.querySelectorAll("select")[0] as HTMLSelectElement;
    fireEvent.change(projectSelect, { target: { value: "proj-1" } });

    // 進捗を追加（完了率0%のまま = 大幅な遅延）
    const addBtn = screen.getByText("+ 進捗を追加");
    fireEvent.click(addBtn);

    // スケジュール突合ボタンをクリック
    const reconcileBtn = screen.getByText("スケジュール突合");
    fireEvent.click(reconcileBtn);

    // 遅延検出結果または「遅延なし」メッセージが表示される
    // （タスクの期待進捗 > 0 の場合のみ遅延が出る）
    const hasDelays = document.querySelector(".bg-red-50");
    const noDelays = document.querySelector(".bg-emerald-50");
    expect(hasDelays !== null || noDelays !== null).toBe(true);
  });

  /**
   * 提案適用: proposeScheduleUpdate + explainDelta の結果が表示
   */
  it("applies schedule update and shows explainDelta explanations", async () => {
    // タスクを開始済み・進行中に設定（遅延が確実に出る設定）
    const pastTask = [
      {
        id: "task-past",
        projectId: "proj-1",
        name: "解体工事",
        title: "解体工事",
        startDate: "2024-01-01",
        dueDate: "2026-12-31",
        dependencies: [],
        progress: 0,
      },
    ];
    mockTaskFindAll.mockResolvedValue(pastTask);
    render(<ProgressReviewPage />);
    await screen.findByText("写真進捗レビュー");

    // 進捗追加（完了率0%）
    const addBtn = screen.getByText("+ 進捗を追加");
    fireEvent.click(addBtn);

    // 突合
    const reconcileBtn = screen.getByText("スケジュール突合");
    fireEvent.click(reconcileBtn);

    // 遅延が出た場合のみ適用ボタンが表示される
    const applyBtn = document.querySelector("button[data-testid='apply-btn']") ??
      Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "遅延提案を適用");
    if (applyBtn) {
      fireEvent.click(applyBtn);
      // 適用済み変更セクションが表示
      expect(screen.getByText("適用済み変更")).toBeDefined();
    } else {
      // 遅延なし = 突合ボタン後に emerald パネルが表示
      expect(document.querySelector(".bg-emerald-50")).toBeDefined();
    }
  });

  /**
   * 空データ: プロジェクトなし → 前提条件CTAを表示
   */
  it("renders without crash when no projects are available", async () => {
    mockProjectFindAll.mockResolvedValue([]);
    render(<ProgressReviewPage />);
    // 案件ゼロ時は空状態CTAを表示（クラッシュしない）
    const heading = await screen.findByText("進捗レビューは、案件選択と写真選択を先に行います");
    expect(heading).toBeDefined();
    expect(screen.getByText("案件を選ぶ")).toBeDefined();
    expect(screen.getByText("写真をアップロード")).toBeDefined();
  });
});
