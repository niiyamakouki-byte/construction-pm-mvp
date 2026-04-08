import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GanttPage } from "../pages/GanttPage.js";

const mockTaskRepository = {
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockProjectRepository = {
  findAll: vi.fn(),
};

const mockContractorRepository = {
  findAll: vi.fn(),
};

vi.mock("../stores/task-store.js", () => ({
  createTaskRepository: () => mockTaskRepository,
}));

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => mockProjectRepository,
}));

vi.mock("../stores/contractor-store.js", () => ({
  createContractorRepository: () => mockContractorRepository,
}));

vi.mock("../stores/notification-store.js", () => ({
  createNotificationRepository: () => ({ create: vi.fn() }),
}));

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

vi.mock("../hooks/useGanttDrag.js", () => ({
  useGanttDrag: () => ({
    dragState: null,
    dragRef: { current: null },
    startTaskDrag: vi.fn(),
    startTaskResize: vi.fn(),
  }),
}));

describe("GanttPage", () => {
  beforeEach(() => {
    cleanup();
    mockTaskRepository.findAll.mockReset();
    mockProjectRepository.findAll.mockReset();
    mockContractorRepository.findAll.mockReset();
  });

  it("データ読込中はガント用スケルトンが表示される", () => {
    mockTaskRepository.findAll.mockReturnValueOnce(new Promise(() => {}));
    mockProjectRepository.findAll.mockReturnValueOnce(new Promise(() => {}));
    mockContractorRepository.findAll.mockReturnValueOnce(new Promise(() => {}));

    render(<GanttPage />);

    expect(screen.getByRole("status", { name: "ガントチャートを読み込み中" })).toBeDefined();
  });

  it("案件を選ぶと案件工程表ヘッダーと工程バーが表示される", async () => {
    const now = "2025-01-01T00:00:00.000Z";
    mockProjectRepository.findAll.mockResolvedValue([
      {
        id: "p1",
        name: "南青山ビル改修",
        description: "",
        status: "active",
        startDate: "2025-01-10",
        includeWeekends: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "p2",
        name: "渋谷店舗新装",
        description: "",
        status: "planning",
        startDate: "2025-02-01",
        includeWeekends: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    mockTaskRepository.findAll.mockResolvedValue([
      {
        id: "t1",
        projectId: "p1",
        name: "墨出し",
        description: "",
        status: "todo",
        startDate: "2025-01-10",
        dueDate: "2025-01-12",
        progress: 25,
        dependencies: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "t2",
        projectId: "p1",
        name: "配線工事",
        description: "",
        status: "in_progress",
        startDate: "2025-01-13",
        dueDate: "2025-01-18",
        progress: 60,
        dependencies: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "t3",
        projectId: "p2",
        name: "着工準備",
        description: "",
        status: "done",
        startDate: "2025-02-01",
        dueDate: "2025-02-02",
        progress: 100,
        dependencies: [],
        createdAt: now,
        updatedAt: now,
      },
    ]);
    mockContractorRepository.findAll.mockResolvedValue([]);

    render(<GanttPage />);

    expect(await screen.findByText("案件別工程スケジュール")).toBeDefined();
    expect(await screen.findAllByText("南青山ビル改修")).not.toHaveLength(0);
    expect(screen.getByRole("figure", { name: "ガントチャート: 2タスク" })).toBeDefined();
    expect(screen.getAllByText("墨出し").length).toBeGreaterThan(0);
    expect(screen.getAllByText("配線工事").length).toBeGreaterThan(0);
  });

  it("別案件をクリックするとその案件の全工程に切り替わる", async () => {
    const now = "2025-01-01T00:00:00.000Z";
    mockProjectRepository.findAll.mockResolvedValue([
      {
        id: "p1",
        name: "南青山ビル改修",
        description: "",
        status: "active",
        startDate: "2025-01-10",
        includeWeekends: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "p2",
        name: "渋谷店舗新装",
        description: "",
        status: "planning",
        startDate: "2025-02-01",
        includeWeekends: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    mockTaskRepository.findAll.mockResolvedValue([
      {
        id: "t1",
        projectId: "p1",
        name: "墨出し",
        description: "",
        status: "todo",
        startDate: "2025-01-10",
        dueDate: "2025-01-12",
        progress: 25,
        dependencies: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "t2",
        projectId: "p2",
        name: "仮設工事",
        description: "",
        status: "done",
        startDate: "2025-02-01",
        dueDate: "2025-02-03",
        progress: 100,
        dependencies: [],
        createdAt: now,
        updatedAt: now,
      },
    ]);
    mockContractorRepository.findAll.mockResolvedValue([]);

    const user = userEvent.setup();
    render(<GanttPage />);

    await screen.findByText("案件別工程スケジュール");
    await user.click(screen.getByRole("button", { name: /渋谷店舗新装/ }));

    expect(await screen.findAllByText("渋谷店舗新装")).not.toHaveLength(0);
    expect(screen.getByRole("figure", { name: "ガントチャート: 1タスク" })).toBeDefined();
    expect(screen.getAllByText("仮設工事").length).toBeGreaterThan(0);
  });
});
