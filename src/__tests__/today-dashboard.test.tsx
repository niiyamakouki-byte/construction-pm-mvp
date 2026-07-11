/**
 * TodayDashboardPage のテスト
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { TodayDashboardPage } from "../pages/TodayDashboardPage.js";
import type { Task, Project, CostItem, Expense, Contractor } from "../domain/types.js";

// Mock fetch for weather API
vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network"))));

// Use local date (not UTC) to match the component's toLocalDateString() helper.
function localDateStr(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Shared store mock state
let mockTasks: Task[] = [];
let mockProjects: Project[] = [];
let mockCostItems: CostItem[] = [];
let mockExpenses: Expense[] = [];
let mockContractors: Contractor[] = [];

const mockTaskFindAll = vi.fn(async () => [...mockTasks]);
const mockTaskUpdate = vi.fn(async () => {});
const mockProjectFindAll = vi.fn(async () => [...mockProjects]);
const mockCostItemFindAll = vi.fn(async () => [...mockCostItems]);
const mockContractorFindAll = vi.fn(async () => [...mockContractors]);
const mockExpenseFindAll = vi.fn(async () => [...mockExpenses]);
const mockPhotoUpload = vi.fn(async (_file: File, _projectId: string) => ({
  id: "photo-1",
  url: "https://example.com/photo.jpg",
  path: "photos/photo.jpg",
  projectId: "p-1",
  createdAt: new Date().toISOString(),
}));
const mockPhotoClassificationUpdate = vi.fn(async () => ({
  id: "photo-1",
  url: "https://example.com/photo.jpg",
  path: "photos/photo.jpg",
  projectId: "p-1",
  createdAt: new Date().toISOString(),
}));

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

vi.mock("../stores/cost-item-store.js", () => ({
  createCostItemRepository: () => ({
    findAll: mockCostItemFindAll,
  }),
}));

vi.mock("../stores/contractor-store.js", () => ({
  createContractorRepository: () => ({
    findAll: mockContractorFindAll,
  }),
}));

vi.mock("../infra/create-app-repository.js", () => ({
  createAppRepository: () => ({
    findAll: mockExpenseFindAll,
  }),
}));

vi.mock("../stores/photo-store.js", () => ({
  createPhotoStore: () => ({
    uploadPhoto: mockPhotoUpload,
    listPhotosByProject: vi.fn(async () => []),
    updatePhotoClassification: mockPhotoClassificationUpdate,
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
  const today = localDateStr();
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

function makeProject(overrides: Partial<Project> = {}): Project {
  const now = new Date().toISOString();
  const today = localDateStr();
  return {
    id: "p-1",
    name: "品川物流センター新築",
    description: "",
    status: "active",
    startDate: today,
    includeWeekends: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeCostItem(overrides: Partial<CostItem> = {}): CostItem {
  const now = new Date().toISOString();
  const today = localDateStr();
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: "11111111-1111-4111-8111-111111111112",
    description: "材料仕入",
    amount: 100000,
    category: "材料費",
    costDate: today,
    paymentStatus: "paid",
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
    mockCostItems = [];
    mockExpenses = [];
    mockContractors = [];
    mockTaskFindAll.mockClear();
    mockTaskUpdate.mockClear();
    mockProjectFindAll.mockClear();
    mockCostItemFindAll.mockClear();
    mockContractorFindAll.mockClear();
    mockExpenseFindAll.mockClear();
    mockPhotoUpload.mockClear();
    mockPhotoClassificationUpdate.mockClear();
    Object.defineProperty(globalThis.URL, "createObjectURL", {
      writable: true,
      configurable: true,
      value: vi.fn(() => "blob:report"),
    });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      writable: true,
      configurable: true,
      value: vi.fn(),
    });
  });

  it("ページタイトル「今日のタスク」が表示される", async () => {
    mockProjects = [makeProject()];
    render(<TodayDashboardPage />);
    await waitFor(() => expect(screen.getByText("今日のタスク")).toBeDefined());
  });

  it("カレンダー未連携時は「今日の予定」がタスク件数を流用せず0件になる", async () => {
    mockProjects = [makeProject()];
    mockTasks = [makeTask({ name: "タスクA" })];
    render(<TodayDashboardPage />);
    await waitFor(() => {
      const scheduleCard = screen.getByText("今日の予定").closest("button");
      expect(scheduleCard).not.toBeNull();
      expect(within(scheduleCard as HTMLElement).getByText("0件")).toBeDefined();
    });
  });

  it("初回ロード中はダッシュボード用スケルトンが表示される", () => {
    mockTaskFindAll.mockReturnValueOnce(new Promise(() => {}));
    mockProjectFindAll.mockReturnValueOnce(new Promise(() => {}));

    render(<TodayDashboardPage />);

    expect(
      screen.getByRole("status", { name: "ダッシュボードを読み込み中" }),
    ).toBeDefined();
  });

  it("空状態メッセージ「今日の予定タスクはありません」が表示される", async () => {
    mockProjects = [makeProject()];
    render(<TodayDashboardPage />);
    await waitFor(() =>
      expect(screen.getByText("今日の予定タスクはありません")).toBeDefined(),
    );
  });

  it("期限が今日のタスクが表示される", async () => {
    const today = localDateStr();
    mockProjects = [makeProject()];
    mockTasks = [makeTask({ name: "今日締切タスク", dueDate: today, status: "todo" })];
    render(<TodayDashboardPage />);
    await waitFor(() => expect(screen.getByText("今日締切タスク")).toBeDefined());
  });

  it("完了済みタスクはフィルタリングされて表示されない", async () => {
    const today = localDateStr();
    mockProjects = [makeProject()];
    mockTasks = [
      makeTask({ name: "完了済みのタスク名", dueDate: today, status: "done" }),
      makeTask({ id: "t-2", name: "未着手タスク", dueDate: today, status: "todo" }),
    ];
    render(<TodayDashboardPage />);
    await waitFor(() => expect(screen.getByText("未着手タスク")).toBeDefined());
    expect(screen.queryByText("完了済みのタスク名")).toBeNull();
  });

  it("データ読み込みエラー時にエラーバナーが表示される", async () => {
    mockProjects = [makeProject()];
    mockTaskFindAll.mockRejectedValueOnce(new Error("読み込みエラー発生"));
    render(<TodayDashboardPage />);
    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("読み込みエラー発生");
    });
  });

  it("stat カード（進行中案件・進行中タスク・完了タスク・期限超過）が表示される", async () => {
    mockProjects = [makeProject()];
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

  it("ダッシュボードカードが実データを表示する", async () => {
    const today = localDateStr();
    mockProjects = [
      makeProject({
        id: "11111111-1111-4111-8111-111111111112",
        budget: 500000,
      }),
      makeProject({
        id: "11111111-1111-4111-8111-111111111113",
        name: "世田谷内装改修",
        status: "planning",
        budget: 250000,
      }),
    ];
    mockTasks = [
      makeTask({
        id: "11111111-1111-4111-8111-111111111114",
        projectId: "11111111-1111-4111-8111-111111111112",
        name: "今日対応タスク",
        dueDate: today,
      }),
      makeTask({
        id: "11111111-1111-4111-8111-111111111115",
        projectId: "11111111-1111-4111-8111-111111111112",
        name: "進行中タスク",
        status: "in_progress",
        startDate: today,
        dueDate: today,
      }),
      makeTask({
        id: "11111111-1111-4111-8111-111111111116",
        projectId: "11111111-1111-4111-8111-111111111113",
        name: "見積作成",
        status: "todo",
        startDate: today,
        dueDate: today,
      }),
    ];
    mockCostItems = [
      makeCostItem({
        projectId: "11111111-1111-4111-8111-111111111112",
        amount: 150000,
      }),
    ];

    render(<TodayDashboardPage />);

    await waitFor(() => {
      const scheduleCard = screen.getByText("今日の予定").closest("button");
      const siteCard = screen.getByText("今週の現場").closest("button");
      const notificationCard = screen.getByText("未読通知").closest("button");
      const estimateCard = screen.getByText("進行中の見積").closest("button");
      const marginCard = screen.getByText("今月の粗利率").closest("button");
      const issueCard = screen.getByText("残課題").closest("button");

      expect(scheduleCard).not.toBeNull();
      expect(siteCard).not.toBeNull();
      expect(notificationCard).not.toBeNull();
      expect(estimateCard).not.toBeNull();
      expect(marginCard).not.toBeNull();
      expect(issueCard).not.toBeNull();

      expect(within(scheduleCard as HTMLElement).getByText("0件")).toBeDefined();
      expect(within(siteCard as HTMLElement).getByText("2現場稼働")).toBeDefined();
      expect(within(notificationCard as HTMLElement).getByText("0件")).toBeDefined();
      expect(within(estimateCard as HTMLElement).getByText("1件")).toBeDefined();
      expect(within(marginCard as HTMLElement).getByText("80.0%")).toBeDefined();
      expect(within(issueCard as HTMLElement).getByText("1件")).toBeDefined();
    });

    expect(screen.getByText("予算 ￥750,000")).toBeDefined();
    expect(screen.queryByText("32.5%")).toBeNull();
  });

  it("「本日の概要」ヘッダーが表示される", async () => {
    mockProjects = [makeProject()];
    render(<TodayDashboardPage />);
    await waitFor(() => expect(screen.getByText("本日の概要")).toBeDefined());
  });

  it("「本日の日報」セクションとHTML出力ボタンが表示される", async () => {
    mockProjects = [makeProject()];
    render(<TodayDashboardPage />);
    await waitFor(() => expect(screen.getByText("本日の日報")).toBeDefined());
    expect(screen.getByRole("button", { name: "HTMLで日報出力" })).toBeDefined();
  });

  it("HTML日報出力ボタンから日報をエクスポートできる", async () => {
    const today = localDateStr();
    mockProjects = [makeProject()];
    mockTasks = [
      makeTask({
        name: "鉄筋組立",
        status: "in_progress",
        startDate: today,
        dueDate: today,
        progress: 55,
      }),
    ];

    render(<TodayDashboardPage />);

    const exportButton = await screen.findByRole("button", { name: "HTMLで日報出力" });
    await waitFor(() => expect(exportButton.hasAttribute("disabled")).toBe(false));

    fireEvent.click(exportButton);

    expect(URL.createObjectURL).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByText("HTML日報を出力しました")).toBeDefined(),
    );
  });

  it("weather pageへの導線が表示される", async () => {
    mockProjects = [makeProject()];
    render(<TodayDashboardPage />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "7日間の現場天気を見る" })).toBeDefined(),
    );
  });

  it("写真は選択だけでは保存せず、確認ボタンでアップロードする", async () => {
    mockProjects = [makeProject()];
    render(<TodayDashboardPage />);

    await waitFor(() => expect(screen.getByText("現場写真アップロード")).toBeDefined());

    const file = new File(["photo"], "kiso.jpg", { type: "image/jpeg" });
    const input = screen.getByLabelText("写真ファイル");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText("kiso.jpg")).toBeDefined());
    expect(mockPhotoUpload).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("カテゴリ"), { target: { value: "foundation" } });
    fireEvent.click(screen.getByRole("button", { name: "この写真を保存" }));

    await waitFor(() => expect(mockPhotoUpload).toHaveBeenCalledTimes(1));
    expect(mockPhotoUpload).toHaveBeenCalledWith(
      file,
      "p-1",
      undefined,
      expect.objectContaining({
        category: "foundation",
        caption: "基礎工事",
      }),
    );
    await waitFor(() => expect(screen.getByText("写真を保存しました")).toBeDefined());
  });

  it("写真ファイル名からカテゴリを自動設定する", async () => {
    mockProjects = [makeProject()];
    render(<TodayDashboardPage />);

    await waitFor(() => expect(screen.getByText("現場写真アップロード")).toBeDefined());

    const file = new File(["photo"], "基礎杭_1F.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("写真ファイル"), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText("基礎杭_1F.jpg")).toBeDefined());
    expect((screen.getByLabelText("カテゴリ") as HTMLSelectElement).value).toBe("foundation");
    expect(screen.getByText(/ファイル名から 基礎工事 に設定済み/)).toBeDefined();
  });

  it("今日のおすすめ: 期限超過 > 今日のタスク > 期限なし の順に並ぶ", async () => {
    const today = localDateStr();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    mockProjects = [makeProject()];
    mockTasks = [
      makeTask({ id: "t-overdue", name: "期限超過タスク", status: "in_progress", dueDate: yesterday }),
      makeTask({ id: "t-today", name: "今日締切タスク", status: "todo", dueDate: today }),
      makeTask({ id: "t-nodate", name: "日付なしタスク", status: "todo", startDate: undefined, dueDate: undefined }),
    ];
    render(<TodayDashboardPage />);

    await waitFor(() =>
      expect(screen.getByText("今日のおすすめアクション")).toBeDefined(),
    );

    const section = screen.getByText("今日のおすすめアクション").closest("section");
    expect(section).not.toBeNull();
    const buttons = Array.from((section as HTMLElement).querySelectorAll("button"));
    const labels = buttons.map((b) => b.textContent ?? "");

    const overdueIdx = labels.findIndex((l) => l.includes("期限超過"));
    const todayIdx = labels.findIndex((l) => l.includes("今日のタスク"));
    const noDateIdx = labels.findIndex((l) => l.includes("工程表で未開始タスクを確認") || l.includes("現場写真"));

    expect(overdueIdx).toBeGreaterThanOrEqual(0);
    expect(todayIdx).toBeGreaterThanOrEqual(0);
    // 期限超過が最初、今日のタスクがその後、期限なしは最後
    expect(overdueIdx).toBeLessThan(todayIdx);
    expect(todayIdx).toBeLessThan(noDateIdx);
  });
});
