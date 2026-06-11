import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBanner } from "./NotificationBanner.js";
import type { CostItem, Expense, Project, Task } from "../domain/types.js";

// localStorage stub (jsdom may have --localstorage-file issues)
const localStorageData: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageData[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageData[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageData[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(localStorageData)) delete localStorageData[k]; }),
};

let mockProjects: Project[] = [];
let mockTasks: Task[] = [];
let mockCostItems: CostItem[] = [];
let mockExpenses: Expense[] = [];

const mockProjectFindAll = vi.fn(async () => [...mockProjects]);
const mockTaskFindAll = vi.fn(async () => [...mockTasks]);
const mockCostItemFindAll = vi.fn(async () => [...mockCostItems]);
const mockExpenseFindAll = vi.fn(async () => [...mockExpenses]);
const mockNavigate = vi.hoisted(() => vi.fn());
const mockWeatherWarnings = vi.hoisted(() => [] as Array<{
  siteId: string;
  siteName: string;
  dateLabel: string;
  projectId: string;
  day: { dt: number };
  risk: { reasons: string[] };
}>);

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

vi.mock("../lib/weather.js", () => ({
  fetchConstructionSiteForecasts: vi.fn(async () => []),
  collectWeatherWarnings: vi.fn(() => mockWeatherWarnings),
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
    mockWeatherWarnings.length = 0;
    localStorageMock.clear();
    vi.stubGlobal("localStorage", localStorageMock);
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
    mockWeatherWarnings.push({
      siteId: "site-1",
      siteName: "青山オフィス改修",
      dateLabel: "明日",
      projectId: "p-1",
      day: { dt: 1 },
      risk: { reasons: ["強風注意"] },
    });

    render(<NotificationBanner refreshKey="/today" />);

    // overdue (2000-01-01) はstaleなので件数から除外され、ヒント表示に回る
    expect(await screen.findByText("重要通知 3件")).toBeDefined();
    expect(screen.getByText(/\+1件は30日以上前/)).toBeDefined();
    expect(await screen.findByText("期限超過タスク")).toBeDefined();
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

  it("collapses to summary bar and persists state in localStorage", async () => {
    const user = userEvent.setup();
    mockProjects = [makeProject({ id: "p-1", name: "青山オフィス改修" })];
    mockTasks = [makeTask({ id: "t-overdue", dueDate: "2000-01-01" })];

    render(<NotificationBanner refreshKey="/app" />);

    // Wait for notifications to load
    await screen.findByRole("button", { name: "通知一覧へ" });

    // Collapse via the chevron-up button
    const collapseBtn = screen.getByRole("button", { name: "通知を折りたたむ" });
    await user.click(collapseBtn);

    // Full banner cards should be gone, summary bar shown
    expect(screen.queryByRole("button", { name: "通知一覧へ" })).toBeNull();
    expect(screen.getByText(/重要通知 \d+件/)).toBeDefined();

    // localStorage key should be set
    expect(localStorageMock.setItem).toHaveBeenCalledWith("gh-banner-collapsed", "1");

    // Expand restores full banner and clears key (two expand buttons exist — text row and chevron)
    const expandBtns = screen.getAllByRole("button", { name: "通知を展開" });
    await user.click(expandBtns[0]);

    await screen.findByRole("button", { name: "通知一覧へ" });
    expect(localStorageMock.setItem).toHaveBeenCalledWith("gh-banner-collapsed", "0");
  });

  it("renders procurement alerts as orange workflow notifications", async () => {
    const user = userEvent.setup();
    const today = new Date();
    const twoDaysOut = new Date(today);
    twoDaysOut.setDate(today.getDate() + 2);

    mockProjects = [makeProject({ id: "p-1", name: "青山オフィス改修" })];
    mockTasks = [
      makeTask({
        id: "t-procurement",
        name: "配電盤搬入",
        startDate: toLocalDateString(twoDaysOut),
        lead_time: 2,
      }),
    ];

    render(<NotificationBanner refreshKey="/gantt" />);

    const expandBtns = await screen.findAllByRole("button", { name: "通知を展開" });
    await user.click(expandBtns[0]);

    expect(await screen.findByText("調達アラート")).toBeDefined();
    expect(screen.getByText(/リードタイム 2日/)).toBeDefined();
  });

  it("groups same-kind notifications behind a collapsible header", async () => {
    const user = userEvent.setup();
    mockProjects = [makeProject({ id: "p-1", name: "青山オフィス改修", budget: 0 })];
    // 3件のfresh overdueを投入してグルーピングが発火することを確認
    const today = new Date();
    const d = (offset: number) => {
      const dt = new Date(today);
      dt.setDate(today.getDate() - offset);
      return toLocalDateString(dt);
    };
    mockTasks = [
      makeTask({ id: "t-1", name: "外壁洗浄", dueDate: d(3) }),
      makeTask({ id: "t-2", name: "床養生", dueDate: d(5) }),
      makeTask({ id: "t-3", name: "搬入確認", dueDate: d(7) }),
    ];

    render(<NotificationBanner refreshKey="/grouping" />);

    // 重要通知件数とグループヘッダーが見える（collapsed→expanded のuseEffect完了を待つ）
    expect(await screen.findByText("重要通知 3件")).toBeDefined();
    const header = await screen.findByRole("button", { name: /期限超過タスク 3件/ });
    expect(header).toBeDefined();
    expect(header.getAttribute("aria-expanded")).toBe("false");

    // デフォルトでは個別タスク名は折りたたまれている
    expect(screen.queryByText(/外壁洗浄/)).toBeNull();

    // 展開すると個別が出る
    await user.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(await screen.findByText(/外壁洗浄/)).toBeDefined();
    expect(screen.getByText(/床養生/)).toBeDefined();
    expect(screen.getByText(/搬入確認/)).toBeDefined();
  });

  it("hides stale overdue items behind a sub-group inside the overdue group", async () => {
    const user = userEvent.setup();
    mockProjects = [makeProject({ id: "p-1", name: "青山オフィス改修", budget: 0 })];
    // 1件は最近 (fresh), 2件は30日以上前 (stale)
    const today = new Date();
    const recentOverdue = new Date(today);
    recentOverdue.setDate(today.getDate() - 3);
    const oldOverdue = new Date(today);
    oldOverdue.setDate(today.getDate() - 90);
    mockTasks = [
      makeTask({ id: "t-fresh", name: "新しい超過A", dueDate: toLocalDateString(recentOverdue) }),
      makeTask({ id: "t-old-1", name: "古い超過A", dueDate: toLocalDateString(oldOverdue) }),
      makeTask({ id: "t-old-2", name: "古い超過B", dueDate: toLocalDateString(oldOverdue) }),
    ];

    render(<NotificationBanner refreshKey="/stale" />);

    // 親グループを展開
    const header = await screen.findByRole("button", { name: /期限超過タスク 3件/ });
    await user.click(header);

    // freshはすぐ見える、staleは折りたたみ内
    expect(await screen.findByText(/新しい超過A/)).toBeDefined();
    expect(screen.queryByText(/古い超過A/)).toBeNull();

    // staleサブグループを展開
    const staleHeader = screen.getByRole("button", { name: /30日以上前の超過 2件/ });
    await user.click(staleHeader);
    expect(await screen.findByText(/古い超過A/)).toBeDefined();
    expect(screen.getByText(/古い超過B/)).toBeDefined();
  });

  it("hides a notification after pressing × (既読) and keeps it hidden across remount", async () => {
    const user = userEvent.setup();
    mockProjects = [makeProject({ id: "p-1", name: "青山オフィス改修", budget: 0 })];
    const today = new Date();
    const recentOverdue = new Date(today);
    recentOverdue.setDate(today.getDate() - 3);
    mockTasks = [
      makeTask({ id: "t-fresh", name: "新しい超過A", dueDate: toLocalDateString(recentOverdue) }),
    ];

    const { unmount } = render(<NotificationBanner refreshKey="/dismiss" />);

    expect(await screen.findByText("重要通知 1件")).toBeDefined();
    // 単独通知なのでヘッダーなく直接表示。×ボタンが見える。
    expect(await screen.findByText(/新しい超過A/)).toBeDefined();
    const dismissBtn = screen.getByRole("button", { name: "既読にして非表示" });
    await user.click(dismissBtn);

    // バナーは消える
    expect(screen.queryByText(/新しい超過A/)).toBeNull();

    // リロード相当 = unmount → 再 mount。localStorage は維持される。
    unmount();
    render(<NotificationBanner refreshKey="/dismiss" />);

    // 非表示が永続化されているのでバナーは出ない
    await mockTaskFindAll.mock.results[mockTaskFindAll.mock.results.length - 1]?.value;
    expect(screen.queryByText(/新しい超過A/)).toBeNull();
    expect(screen.queryByText("重要通知 1件")).toBeNull();
  });

  it("hides a snoozed notification until its until-time has passed", async () => {
    const user = userEvent.setup();
    mockProjects = [makeProject({ id: "p-1", name: "青山オフィス改修", budget: 0 })];
    const today = new Date();
    const recentOverdue = new Date(today);
    recentOverdue.setDate(today.getDate() - 3);
    mockTasks = [
      makeTask({ id: "t-fresh", name: "新しい超過A", dueDate: toLocalDateString(recentOverdue) }),
    ];

    const { unmount } = render(<NotificationBanner refreshKey="/snooze" />);

    expect(await screen.findByText(/新しい超過A/)).toBeDefined();
    const snoozeBtn = screen.getByRole("button", { name: "後で（明日の朝まで非表示）" });
    await user.click(snoozeBtn);

    expect(screen.queryByText(/新しい超過A/)).toBeNull();

    // localStorageに snooze が書かれている
    const raw = localStorageData["genbahub.notification.dismissals"];
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw as string) as Record<string, { type: string; until: string }>;
    expect(parsed["overdue:t-fresh"]?.type).toBe("snooze");
    expect(parsed["overdue:t-fresh"]?.until).toBeDefined();

    // until を過去日時に書き換え → 期限切れ → 再表示されるはず
    parsed["overdue:t-fresh"] = { type: "snooze", until: "2000-01-01T00:00:00.000Z" };
    localStorageData["genbahub.notification.dismissals"] = JSON.stringify(parsed);

    unmount();
    render(<NotificationBanner refreshKey="/snooze" />);
    expect(await screen.findByText(/新しい超過A/)).toBeDefined();
  });

  it("subtracts dismissed items from the header count", async () => {
    const user = userEvent.setup();
    mockProjects = [makeProject({ id: "p-1", name: "青山オフィス改修", budget: 0 })];
    const today = new Date();
    const d = (offset: number) => {
      const dt = new Date(today);
      dt.setDate(today.getDate() - offset);
      return toLocalDateString(dt);
    };
    mockTasks = [
      makeTask({ id: "t-1", name: "外壁洗浄", dueDate: d(3) }),
      makeTask({ id: "t-2", name: "床養生", dueDate: d(5) }),
      makeTask({ id: "t-3", name: "搬入確認", dueDate: d(7) }),
    ];

    render(<NotificationBanner refreshKey="/count" />);

    expect(await screen.findByText("重要通知 3件")).toBeDefined();
    const header = await screen.findByRole("button", { name: /期限超過タスク 3件/ });
    await user.click(header);

    // 1件×、もう1件を 後で
    const dismissBtns = await screen.findAllByRole("button", { name: "既読にして非表示" });
    await user.click(dismissBtns[0]);
    const snoozeBtns = screen.getAllByRole("button", { name: "後で（明日の朝まで非表示）" });
    await user.click(snoozeBtns[0]);

    // 残り1件なのでヘッダー件数が 1 になる
    expect(await screen.findByText("重要通知 1件")).toBeDefined();
  });

  it("keeps non-critical notifications collapsed by default", async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    mockProjects = [makeProject({ id: "p-1", name: "青山オフィス改修" })];
    mockTasks = [
      makeTask({
        id: "t-upcoming",
        projectId: "p-1",
        name: "搬入確認",
        dueDate: toLocalDateString(tomorrow),
      }),
    ];

    render(<NotificationBanner refreshKey="/tasks" />);

    expect(await screen.findByText("重要通知 1件")).toBeDefined();
    expect(screen.queryByRole("button", { name: "通知一覧へ" })).toBeNull();
    expect(screen.queryByText("3日以内の期限")).toBeNull();
    expect(screen.getByRole("button", { name: "一覧" })).toBeDefined();
  });
});
