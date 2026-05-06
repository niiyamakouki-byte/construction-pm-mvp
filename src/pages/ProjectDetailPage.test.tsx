import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectDetailPage } from "./ProjectDetailPage.js";

const mockProjectFindById = vi.fn();
const mockProjectUpdate = vi.fn();
const mockTaskFindAll = vi.fn();
const mockTaskCreate = vi.fn();
const mockTaskUpdate = vi.fn();
const mockTaskDelete = vi.fn();
const mockCostItemFindAll = vi.fn();
const mockExpenseFindAll = vi.fn();

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
    findAll: mockExpenseFindAll,
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

vi.mock("../components/ProjectChat.js", () => ({
  ProjectChat: () => <div data-testid="project-chat" />,
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
  getEntryLog: () => [],
  getTodayWorkerCount: () => 0,
}));

const baseProject = {
  id: "proj-1",
  name: "南青山リノベーション",
  description: "内装工事",
  status: "active" as const,
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
});
