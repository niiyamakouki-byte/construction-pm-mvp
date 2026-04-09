import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

const mockExportGanttToPdf = vi.fn();

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

vi.mock("../lib/gantt-pdf-export.js", () => ({
  exportGanttToPdf: (...args: unknown[]) => mockExportGanttToPdf(...args),
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
    mockTaskRepository.create.mockReset();
    mockTaskRepository.update.mockReset();
    mockTaskRepository.delete.mockReset();
    mockProjectRepository.findAll.mockReset();
    mockContractorRepository.findAll.mockReset();
    mockExportGanttToPdf.mockReset();
  });

  it("データ読込中はガント用スケルトンが表示される", () => {
    mockTaskRepository.findAll.mockReturnValueOnce(new Promise(() => {}));
    mockProjectRepository.findAll.mockReturnValueOnce(new Promise(() => {}));
    mockContractorRepository.findAll.mockReturnValueOnce(new Promise(() => {}));

    render(<GanttPage />);

    expect(screen.getByRole("status", { name: "ガントチャートを読み込み中" })).toBeDefined();
  });

  it("案件を選ぶとすぐ工程表とバーが表示される", async () => {
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

    render(<GanttPage initialProjectId="p1" />);

    expect(await screen.findByRole("heading", { name: "南青山ビル改修" })).toBeDefined();
    expect(screen.getByRole("figure", { name: "ガントチャート: 2タスク" })).toBeDefined();
    expect(screen.getAllByText("墨出し").length).toBeGreaterThan(0);
    expect(screen.getAllByText("配線工事").length).toBeGreaterThan(0);
  });

  it("案件チップを押すと表示案件が切り替わる", async () => {
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
    render(<GanttPage initialProjectId="p1" />);

    await screen.findByRole("heading", { name: "南青山ビル改修" });
    await user.click(screen.getByRole("button", { name: "渋谷店舗新装" }));

    expect(await screen.findByRole("heading", { name: "渋谷店舗新装" })).toBeDefined();
    expect(screen.getByRole("figure", { name: "ガントチャート: 1タスク" })).toBeDefined();
    expect(screen.getAllByText("仮設工事").length).toBeGreaterThan(0);
  });

  it("タスクをタップすると編集シートが開く", async () => {
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
    ]);
    mockContractorRepository.findAll.mockResolvedValue([]);

    const user = userEvent.setup();
    render(<GanttPage initialProjectId="p1" />);

    await screen.findByRole("figure", { name: "ガントチャート: 1タスク" });
    await user.click(screen.getAllByText("墨出し")[0]);

    expect(await screen.findByRole("dialog", { name: "タスクを編集" })).toBeDefined();
  });

  it("コスト項目扱いのタスクはガントに表示しない", async () => {
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
        name: "Grow 広告運用",
        description: "外注費 50000円",
        status: "todo",
        progress: 0,
        dependencies: [],
        createdAt: now,
        updatedAt: now,
      },
    ]);
    mockContractorRepository.findAll.mockResolvedValue([]);

    render(<GanttPage initialProjectId="p1" />);

    expect(await screen.findByRole("figure", { name: "ガントチャート: 1タスク" })).toBeDefined();
    expect(screen.getAllByText("墨出し").length).toBeGreaterThan(0);
    expect(screen.queryByText("Grow 広告運用")).toBeNull();
  });

  it("タスクごとの土日稼働設定を保存できる", async () => {
    const now = "2025-01-01T00:00:00.000Z";
    mockProjectRepository.findAll.mockResolvedValue([
      {
        id: "p1",
        name: "南青山ビル改修",
        description: "",
        status: "active",
        startDate: "2025-01-10",
        includeWeekends: false,
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
    ]);
    mockTaskRepository.update.mockResolvedValue({});
    mockContractorRepository.findAll.mockResolvedValue([]);

    const user = userEvent.setup();
    render(<GanttPage initialProjectId="p1" />);

    await screen.findByRole("figure", { name: "ガントチャート: 1タスク" });
    await user.click(screen.getAllByText("墨出し")[0]);
    await user.click(screen.getByRole("checkbox", { name: "上書きする" }));
    await user.click(screen.getByRole("checkbox", { name: /この工程は土日稼働/ }));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mockTaskRepository.update).toHaveBeenCalledWith(
        "t1",
        expect.objectContaining({ includeWeekends: true }),
      );
    });
  });

  it("PDF出力ボタンから工程表PDFを開始できる", async () => {
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
    ]);
    mockContractorRepository.findAll.mockResolvedValue([]);

    const user = userEvent.setup();
    render(<GanttPage initialProjectId="p1" />);

    await screen.findByRole("figure", { name: "ガントチャート: 1タスク" });
    await user.click(screen.getByRole("button", { name: "PDF出力" }));

    expect(mockExportGanttToPdf).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1" }),
      expect.arrayContaining([expect.objectContaining({ id: "t1" })]),
      expect.any(String),
      expect.any(Number),
    );
  });
});
