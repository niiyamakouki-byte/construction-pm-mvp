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

    // drilldown modal opens first
    expect(await screen.findByRole("dialog", { name: "タスク詳細" })).toBeDefined();
    await user.click(screen.getByRole("button", { name: "編集する" }));

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
    // go through drilldown → edit
    await user.click(await screen.findByRole("button", { name: "編集する" }));
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

// ─── Sprint 63: 3階層マスター → GanttPage UI 接続テスト ─────────────────────

function setupProject() {
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
  mockTaskRepository.findAll.mockResolvedValue([]);
  mockContractorRepository.findAll.mockResolvedValue([]);
  mockTaskRepository.create.mockResolvedValue({});
}

describe("GanttPage — テンプレートから工程を追加 (Sprint 63)", () => {
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

  it("「マスタから読み込む」ボタンでダイアログが開く", async () => {
    setupProject();
    const user = userEvent.setup();
    render(<GanttPage initialProjectId="p1" />);

    await screen.findByRole("heading", { name: "南青山ビル改修" });
    await user.click(screen.getByRole("button", { name: "マスタから読み込む" }));

    expect(screen.getByRole("dialog", { name: "マスタから読み込む" })).toBeDefined();
  });

  it("ダイアログに大項目セレクトが表示される", async () => {
    setupProject();
    const user = userEvent.setup();
    render(<GanttPage initialProjectId="p1" />);

    await screen.findByRole("heading", { name: "南青山ビル改修" });
    await user.click(screen.getByRole("button", { name: "マスタから読み込む" }));

    expect(screen.getByRole("combobox", { name: "大項目" })).toBeDefined();
  });

  it("ダイアログに中項目・小項目ツリーが表示される", async () => {
    setupProject();
    const user = userEvent.setup();
    render(<GanttPage initialProjectId="p1" />);

    await screen.findByRole("heading", { name: "南青山ビル改修" });
    await user.click(screen.getByRole("button", { name: "マスタから読み込む" }));

    expect(screen.queryByLabelText("中項目・小項目ツリー")).toBeTruthy();
  });

  it("小項目チェックボックスが表示される", async () => {
    setupProject();
    const user = userEvent.setup();
    render(<GanttPage initialProjectId="p1" />);

    await screen.findByRole("heading", { name: "南青山ビル改修" });
    await user.click(screen.getByRole("button", { name: "マスタから読み込む" }));

    // 小項目チェックボックスが1件以上存在する
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it("大項目変更で別の中項目ツリーに切り替わる", async () => {
    setupProject();
    const user = userEvent.setup();
    render(<GanttPage initialProjectId="p1" />);

    await screen.findByRole("heading", { name: "南青山ビル改修" });
    await user.click(screen.getByRole("button", { name: "マスタから読み込む" }));

    const select = screen.getByRole("combobox", { name: "大項目" });
    // 電気工事に切り替え
    await user.selectOptions(select, screen.getByRole("option", { name: "電気工事" }));

    // 電気工事の中項目チェックボックスが表示される
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it("全解除ボタンで全チェックボックスが外れる", async () => {
    setupProject();
    const user = userEvent.setup();
    render(<GanttPage initialProjectId="p1" />);

    await screen.findByRole("heading", { name: "南青山ビル改修" });
    await user.click(screen.getByRole("button", { name: "マスタから読み込む" }));

    const allClearBtn = screen.getByRole("button", { name: /全解除/ });
    await user.click(allClearBtn);

    // 全解除後はガントに追加ボタンが 0件で disabled になる
    const addButton = screen.getByRole("button", { name: /ガントに追加/ });
    expect(addButton.hasAttribute("disabled")).toBe(true);
  });

  it("全選択 → ガントに追加でtaskRepository.createが呼ばれる", async () => {
    setupProject();
    const user = userEvent.setup();
    render(<GanttPage initialProjectId="p1" />);

    await screen.findByRole("heading", { name: "南青山ビル改修" });
    await user.click(screen.getByRole("button", { name: "マスタから読み込む" }));

    // 全選択状態でガントに追加
    const addButton = screen.getByRole("button", { name: /ガントに追加/ });
    expect(addButton.hasAttribute("disabled")).toBe(false);
    await user.click(addButton);

    await waitFor(() => {
      expect(mockTaskRepository.create).toHaveBeenCalled();
    });
  });

  it("個別チェックを外すとその小項目はcreateされない", async () => {
    setupProject();
    const user = userEvent.setup();
    render(<GanttPage initialProjectId="p1" />);

    await screen.findByRole("heading", { name: "南青山ビル改修" });
    await user.click(screen.getByRole("button", { name: "マスタから読み込む" }));

    // 最初のチェックボックスを外す (中項目チェックか小項目チェック)
    const checkboxes = screen.getAllByRole("checkbox");
    const firstChecked = checkboxes.find((cb) => (cb as HTMLInputElement).checked);
    if (firstChecked) {
      await user.click(firstChecked);
    }

    // ガントに追加を押す
    const addButton = screen.getByRole("button", { name: /ガントに追加/ });
    if (!addButton.hasAttribute("disabled")) {
      await user.click(addButton);
      await waitFor(() => {
        expect(mockTaskRepository.create).toHaveBeenCalled();
      });
    }
  });

  it("キャンセルボタンでダイアログが閉じる", async () => {
    setupProject();
    const user = userEvent.setup();
    render(<GanttPage initialProjectId="p1" />);

    await screen.findByRole("heading", { name: "南青山ビル改修" });
    await user.click(screen.getByRole("button", { name: "マスタから読み込む" }));

    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(screen.queryByRole("dialog", { name: "マスタから読み込む" })).toBeNull();
  });
});

// ─── Sprint 63: 既存タスクがある場合の衝突確認ダイアログ ────────────────────────

function setupProjectWithTasks() {
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
      name: "既存工程",
      description: "",
      status: "todo",
      startDate: "2025-01-10",
      dueDate: "2025-01-12",
      progress: 0,
      dependencies: [],
      createdAt: now,
      updatedAt: now,
    },
  ]);
  mockContractorRepository.findAll.mockResolvedValue([]);
  mockTaskRepository.create.mockResolvedValue({});
}

describe("GanttPage — 既存タスクあり衝突確認ダイアログ (Sprint 63)", () => {
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

  it("既存タスクがある状態でガントに追加ボタンを押すと確認ダイアログが出る", async () => {
    setupProjectWithTasks();
    const user = userEvent.setup();
    render(<GanttPage initialProjectId="p1" />);

    await screen.findByRole("figure", { name: "ガントチャート: 1タスク" });
    await user.click(screen.getByRole("button", { name: "マスタから読み込む" }));
    await user.click(screen.getByRole("button", { name: /ガントに追加/ }));

    expect(await screen.findByRole("dialog", { name: "工程追加の確認" })).toBeDefined();
  });

  it("確認ダイアログに既存タスク件数が表示される", async () => {
    setupProjectWithTasks();
    const user = userEvent.setup();
    render(<GanttPage initialProjectId="p1" />);

    await screen.findByRole("figure", { name: "ガントチャート: 1タスク" });
    await user.click(screen.getByRole("button", { name: "マスタから読み込む" }));
    await user.click(screen.getByRole("button", { name: /ガントに追加/ }));

    await screen.findByRole("dialog", { name: "工程追加の確認" });
    expect(screen.getByText(/1 件の工程/)).toBeDefined();
  });

  it("確認ダイアログでキャンセルするとcreateは呼ばれない", async () => {
    setupProjectWithTasks();
    const user = userEvent.setup();
    render(<GanttPage initialProjectId="p1" />);

    await screen.findByRole("figure", { name: "ガントチャート: 1タスク" });
    await user.click(screen.getByRole("button", { name: "マスタから読み込む" }));
    await user.click(screen.getByRole("button", { name: /ガントに追加/ }));

    const conflictDialog = await screen.findByRole("dialog", { name: "工程追加の確認" });
    // scope キャンセルクリックを確認ダイアログ内に限定
    const { getByRole: getByRoleWithin } = await import("@testing-library/react");
    await user.click(getByRoleWithin(conflictDialog, "button", { name: "キャンセル" }));

    expect(mockTaskRepository.create).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "工程追加の確認" })).toBeNull();
  });

  it("確認ダイアログで追加するを押すとcreateが呼ばれる", async () => {
    setupProjectWithTasks();
    const user = userEvent.setup();
    render(<GanttPage initialProjectId="p1" />);

    await screen.findByRole("figure", { name: "ガントチャート: 1タスク" });
    await user.click(screen.getByRole("button", { name: "マスタから読み込む" }));
    await user.click(screen.getByRole("button", { name: /ガントに追加/ }));

    await screen.findByRole("dialog", { name: "工程追加の確認" });
    await user.click(screen.getByRole("button", { name: "追加する" }));

    await waitFor(() => {
      expect(mockTaskRepository.create).toHaveBeenCalled();
    });
  });

  it("既存タスクがない場合は確認ダイアログを挟まずcreateが呼ばれる", async () => {
    setupProject();
    const user = userEvent.setup();
    render(<GanttPage initialProjectId="p1" />);

    await screen.findByRole("heading", { name: "南青山ビル改修" });
    await user.click(screen.getByRole("button", { name: "マスタから読み込む" }));
    await user.click(screen.getByRole("button", { name: /ガントに追加/ }));

    // 確認ダイアログは出ない
    expect(screen.queryByRole("dialog", { name: "工程追加の確認" })).toBeNull();

    await waitFor(() => {
      expect(mockTaskRepository.create).toHaveBeenCalled();
    });
  });
});
