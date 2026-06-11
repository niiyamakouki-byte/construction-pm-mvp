import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { navigate } from "../hooks/useHashRouter.js";
import { ProjectDetailPage } from "./ProjectDetailPage.js";

const mockProjectFindById = vi.fn();
const mockProjectUpdate = vi.fn();
const mockTaskFindAll = vi.fn();
const mockTaskCreate = vi.fn();
const mockTaskUpdate = vi.fn();
const mockTaskDelete = vi.fn();
const mockCostItemFindAll = vi.fn();
const mockExpenseFindAll = vi.fn();
const mockGetEntryLog = vi.fn();
const mockGetTodayWorkerCount = vi.fn();

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => ({
    findById: mockProjectFindById,
    update: mockProjectUpdate,
  }),
}));

vi.mock("../stores/task-store.js", () => ({
  createTaskRepository: () => ({
    findAll: mockTaskFindAll,
    create: mockTaskCreate,
    update: mockTaskUpdate,
    delete: mockTaskDelete,
  }),
}));

vi.mock("../stores/cost-item-store.js", () => ({
  createCostItemRepository: () => ({
    findAll: mockCostItemFindAll,
  }),
}));

vi.mock("../infra/create-app-repository.js", () => ({
  createAppRepository: () => ({
    findAll: (...args: Parameters<typeof mockExpenseFindAll>) => mockExpenseFindAll(...args),
  }),
}));

vi.mock("../hooks/useHashRouter.js", () => ({
  navigate: vi.fn(),
}));

vi.mock("../components/ProjectDetailTabs.js", () => ({
  ProjectDetailTabs: () => <div data-testid="project-detail-tabs" />,
}));

vi.mock("../components/ProjectMapEmbed.js", () => ({
  ProjectMapEmbed: ({ address }: { address: string }) => <div data-testid="project-map">{address}</div>,
}));

vi.mock("../components/ProjectFlowWidget.js", () => ({
  ProjectFlowWidget: () => <div data-testid="project-flow-widget" />,
}));

vi.mock("../lib/project-flow.js", () => ({
  createInitialStageProgresses: () => [],
}));

vi.mock("../lib/construction-checklist.js", () => ({
  ConstructionPhase: { demolition: "demolition" },
  getPhaseChecklist: () => [],
  getPhaseLabel: () => "解体",
  evaluatePhaseCompletion: () => ({ percentage: 0, passed: false }),
}));

vi.mock("../lib/qr-code.js", () => ({
  generateProjectQR: () => "https://example.com/qr.png",
  generateFieldModeUrl: () => "https://example.com/field",
}));

vi.mock("../lib/site-entry-qr.js", () => ({
  generateSiteEntryPrintHtml: () => "<html></html>",
}));

vi.mock("../lib/site-entry-log.js", () => ({
  getEntryLog: (...args: Parameters<typeof mockGetEntryLog>) => mockGetEntryLog(...args),
  getTodayWorkerCount: (...args: Parameters<typeof mockGetTodayWorkerCount>) => mockGetTodayWorkerCount(...args),
}));

const baseProject = {
  id: "proj-1",
  name: "南青山リノベーション",
  description: "内装工事",
  status: "active" as const,
  mode: "normal" as const,
  startDate: "2025-01-01",
  endDate: "2025-02-01",
  address: "東京都港区南青山1-1-1",
  budget: 5_000_000,
  includeWeekends: false,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-test") });
    mockProjectFindById.mockResolvedValue(baseProject);
    mockProjectUpdate.mockResolvedValue(undefined);
    mockTaskFindAll.mockResolvedValue([]);
    mockTaskCreate.mockResolvedValue(undefined);
    mockTaskUpdate.mockResolvedValue(undefined);
    mockTaskDelete.mockResolvedValue(undefined);
    mockCostItemFindAll.mockResolvedValue([]);
    mockExpenseFindAll.mockResolvedValue([]);
    mockGetEntryLog.mockReturnValue([]);
    mockGetTodayWorkerCount.mockReturnValue(0);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("creates inclusive due dates when applying a construction template", async () => {
    const user = userEvent.setup();
    render(<ProjectDetailPage projectId="proj-1" />);

    await screen.findByText("工事テンプレートからまとめて追加");
    await user.click(screen.getByRole("button", { name: "内装工事（10工程）" }));

    await waitFor(() => {
      expect(mockTaskCreate).toHaveBeenCalled();
    });

    expect(mockTaskCreate.mock.calls[0]?.[0]).toMatchObject({
      name: "墨出し・下地確認",
      startDate: "2025-01-01",
      dueDate: "2025-01-01",
    });
    expect(mockTaskCreate.mock.calls[1]?.[0]).toMatchObject({
      name: "解体・撤去",
      startDate: "2025-01-02",
      dueDate: "2025-01-04",
    });
  });

  it("shows an AI upgrade prompt for completed record-only projects", async () => {
    const user = userEvent.setup();
    mockProjectFindById.mockResolvedValueOnce({
      ...baseProject,
      status: "completed",
      mode: "memo",
    });
    render(<ProjectDetailPage projectId="proj-1" />);

    await screen.findByRole("region", { name: "記録案件のAI提案" });
    expect(screen.getByText("メモ案件")).toBeDefined();
    expect(screen.getByText("この記録から工程表を起こしますか？")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "内装工事で起こす" }));

    await waitFor(() => {
      expect(mockTaskCreate).toHaveBeenCalled();
    });
  });

  it("shows memo empty state without treating missing tasks as an error", async () => {
    mockProjectFindById.mockResolvedValueOnce({
      ...baseProject,
      mode: "memo",
      status: "planning",
    });

    render(<ProjectDetailPage projectId="proj-1" />);

    expect(await screen.findByText("メモ案件")).toBeDefined();
    expect(screen.getByText(/工程表はまだありません/)).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("refreshes weather when the projectId changes", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ current: { temperature_2m: 20, weather_code: 0 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ current: { temperature_2m: 24, weather_code: 61 } }),
      });
    vi.stubGlobal("fetch", fetchMock);
    mockProjectFindById.mockImplementation(async (projectId: string) => {
      if (projectId === "proj-2") {
        return {
          ...baseProject,
          id: "proj-2",
          name: "渋谷改装",
          latitude: 35.66,
          longitude: 139.7,
        };
      }
      return {
        ...baseProject,
        latitude: 35.67,
        longitude: 139.73,
      };
    });

    const { rerender } = render(<ProjectDetailPage projectId="proj-1" />);

    await screen.findByText("20°C");

    rerender(<ProjectDetailPage projectId="proj-2" />);

    await screen.findByText("24°C");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("latitude=35.67");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("latitude=35.66");
  });

  it("dispatches genbahub:assistant-open when AI秘書に相談する button is clicked", async () => {
    const user = userEvent.setup();
    const received: Event[] = [];
    const handler = (e: Event) => received.push(e);
    window.addEventListener("genbahub:assistant-open", handler);

    render(<ProjectDetailPage projectId="proj-1" subPath="chat" />);
    await screen.findByRole("button", { name: "AI秘書に相談する" });
    await user.click(screen.getByRole("button", { name: "AI秘書に相談する" }));

    expect(received).toHaveLength(1);
    expect(received[0]?.type).toBe("genbahub:assistant-open");

    window.removeEventListener("genbahub:assistant-open", handler);
  });

  it("shows the field-start flow and routes each action", async () => {
    const user = userEvent.setup();
    render(<ProjectDetailPage projectId="proj-1" />);

    await screen.findByRole("region", { name: "現場スタート導線" });
    expect(screen.getByText("まず必須にするもの")).toBeDefined();
    expect(screen.getByText("開始写真を上げる")).toBeDefined();
    expect(screen.getByText("終了写真を上げる")).toBeDefined();
    expect(screen.getByText("中間写真も足せる")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "開始写真を開く" }));
    await user.click(screen.getByRole("button", { name: "終了写真を開く" }));
    await user.click(screen.getByRole("button", { name: "キオスクを開く" }));
    await user.click(screen.getByRole("button", { name: "写真一覧を開く" }));

    expect(navigate).toHaveBeenNthCalledWith(1, "/photos");
    expect(navigate).toHaveBeenNthCalledWith(2, "/photos");
    expect(navigate).toHaveBeenNthCalledWith(3, "/entry/proj-1");
    expect(navigate).toHaveBeenNthCalledWith(4, "/photos");
  });

  it("shows a role-aware latest workspace and routes each shortcut", async () => {
    const user = userEvent.setup();
    mockTaskFindAll.mockResolvedValueOnce([
      {
        id: "task-1",
        projectId: "proj-1",
        name: "ボード張り",
        description: "",
        status: "in_progress",
        startDate: "2025-01-06",
        dueDate: "2025-01-08",
        assigneeId: "内野 善隆",
        progress: 50,
        dependencies: [],
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    ]);
    mockGetEntryLog.mockReturnValueOnce([
      {
        id: "entry-1",
        projectId: "proj-1",
        workerName: "内野 善隆",
        company: "内野建装",
        entryTime: "2025-01-06T08:30:00.000Z",
      },
    ]);

    render(<ProjectDetailPage projectId="proj-1" />);

    await screen.findByRole("region", { name: "役割別の最新導線" });
    expect(screen.getByText("想定業種: 内装")).toBeDefined();
    expect(screen.getByText("直近: 内野 善隆")).toBeDefined();
    expect(screen.getAllByText("ボード張り").length).toBeGreaterThan(0);
    expect(screen.getByText("内装向けの共有ビュー")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "工程表を開く" }));
    await user.click(screen.getByRole("button", { name: "共有ビューを開く" }));
    await user.click(screen.getByRole("button", { name: "安全書類を開く" }));
    await user.click(screen.getByRole("button", { name: "連絡タブを開く" }));

    expect(navigate).toHaveBeenNthCalledWith(1, "/gantt/proj-1");
    expect(navigate).toHaveBeenNthCalledWith(2, "/portal/proj-1/%E5%86%85%E9%87%8E%E5%BB%BA%E8%A3%85");
    expect(navigate).toHaveBeenNthCalledWith(3, "/safety");
    expect(navigate).toHaveBeenNthCalledWith(4, "/project/proj-1/chat");
  });
});
