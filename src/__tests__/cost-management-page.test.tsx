import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CostManagementPage } from "../pages/CostManagementPage.js";
import { clearChangeRequests, createChangeRequest } from "../lib/change-request.js";
import { navigate } from "../hooks/useHashRouter.js";

const mockProjectRepository = {
  findAll: vi.fn(),
};

const mockTaskRepository = {
  findAll: vi.fn(),
};

const mockCostItemRepository = {
  findAll: vi.fn(),
};

const mockExpenseRepository = {
  findAll: vi.fn(),
};

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => mockProjectRepository,
}));

vi.mock("../stores/task-store.js", () => ({
  createTaskRepository: () => mockTaskRepository,
}));

vi.mock("../stores/cost-item-store.js", () => ({
  createCostItemRepository: () => mockCostItemRepository,
}));

vi.mock("../infra/create-app-repository.js", () => ({
  createAppRepository: () => mockExpenseRepository,
}));

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

vi.mock("../hooks/useHashRouter.js", () => ({
  navigate: vi.fn(),
}));

describe("CostManagementPage", () => {
  const now = "2025-04-01T00:00:00.000Z";

  beforeEach(() => {
    cleanup();
    mockProjectRepository.findAll.mockReset();
    mockTaskRepository.findAll.mockReset();
    mockCostItemRepository.findAll.mockReset();
    mockExpenseRepository.findAll.mockReset();
    vi.mocked(navigate).mockClear();
    clearChangeRequests();
  });

  it("案件別のコスト集計とカテゴリ別テーブルを表示する", async () => {
    mockProjectRepository.findAll.mockResolvedValue([
      {
        id: "p1",
        name: "南青山ビル改修",
        description: "",
        status: "active",
        budget: 1000000,
        startDate: "2025-04-01",
        includeWeekends: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    mockTaskRepository.findAll.mockResolvedValue([
      {
        id: "t-cost",
        projectId: "p1",
        name: "Grow 広告運用",
        description: "外注費 50000円",
        status: "in_progress",
        progress: 0,
        dependencies: [],
        createdAt: now,
        updatedAt: now,
      },
    ]);
    mockCostItemRepository.findAll.mockResolvedValue([
      {
        id: "c1",
        projectId: "p1",
        description: "石膏ボード",
        amount: 200000,
        category: "材料費",
        paymentStatus: "paid",
        breakdownType: "material_cost",
        costDate: "2025-04-02",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    mockExpenseRepository.findAll.mockResolvedValue([
      {
        id: "e1",
        projectId: "p1",
        expenseDate: "2025-04-03",
        description: "請求書: nanairo",
        amount: 300000,
        category: "請求書",
        approvalStatus: "pending",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    render(<CostManagementPage />);

    expect(await screen.findByRole("heading", { name: "コスト管理" })).toBeDefined();
    expect(screen.getAllByText("南青山ビル改修").length).toBeGreaterThan(0);
    expect(screen.getAllByText("￥1,000,000").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/石膏ボード/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Grow/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/nanairo/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/材料費/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/外注費/).length).toBeGreaterThan(0);
  });

  it("案件セレクターで表示案件を切り替えられる", async () => {
    const user = userEvent.setup();

    mockProjectRepository.findAll.mockResolvedValue([
      {
        id: "p1",
        name: "南青山ビル改修",
        description: "",
        status: "active",
        budget: 1000000,
        startDate: "2025-04-01",
        includeWeekends: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "p2",
        name: "渋谷店舗新装",
        description: "",
        status: "planning",
        budget: 500000,
        startDate: "2025-05-01",
        includeWeekends: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    mockTaskRepository.findAll.mockResolvedValue([]);
    mockCostItemRepository.findAll.mockResolvedValue([
      {
        id: "c1",
        projectId: "p1",
        description: "石膏ボード",
        amount: 200000,
        category: "材料費",
        paymentStatus: "paid",
        breakdownType: "material_cost",
        costDate: "2025-04-02",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "c2",
        projectId: "p2",
        description: "警備費",
        amount: 80000,
        category: "経費",
        paymentStatus: "unpaid",
        breakdownType: "task_cost",
        costDate: "2025-05-02",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    mockExpenseRepository.findAll.mockResolvedValue([]);

    render(<CostManagementPage />);

    expect(await screen.findByText("石膏ボード")).toBeDefined();
    await user.selectOptions(screen.getByLabelText("案件選択"), "p2");

    expect(await screen.findByText("警備費")).toBeDefined();
    expect(screen.queryByText("石膏ボード")).toBeNull();
  });

  it("変更指示削除は確認ダイアログでキャンセルと承諾を分岐する", async () => {
    const user = userEvent.setup();
    mockProjectRepository.findAll.mockResolvedValue([
      {
        id: "p1",
        name: "南青山ビル改修",
        description: "",
        status: "active",
        budget: 1000000,
        startDate: "2025-04-01",
        includeWeekends: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    mockTaskRepository.findAll.mockResolvedValue([]);
    mockCostItemRepository.findAll.mockResolvedValue([]);
    mockExpenseRepository.findAll.mockResolvedValue([]);
    createChangeRequest({
      id: "cr-delete",
      projectId: "p1",
      requestedBy: "施主",
      description: "壁紙変更",
      impactDescription: "追加材料",
      originalEstimate: 100000,
      revisedEstimate: 130000,
    });

    render(<CostManagementPage />);

    await user.click(await screen.findByRole("button", { name: "変更指示" }));
    await user.click(screen.getByRole("button", { name: "壁紙変更を削除" }));
    expect(screen.getByRole("alertdialog", { name: "変更指示を削除" })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.getByText("壁紙変更")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "壁紙変更を削除" }));
    await user.click(screen.getByRole("button", { name: "削除する" }));
    expect(screen.queryByText("壁紙変更")).toBeNull();
  });

  it("案件ゼロのとき「案件を選択する」「見積から取込」CTAを表示する", async () => {
    mockProjectRepository.findAll.mockResolvedValue([]);
    mockTaskRepository.findAll.mockResolvedValue([]);
    mockCostItemRepository.findAll.mockResolvedValue([]);
    mockExpenseRepository.findAll.mockResolvedValue([]);

    render(<CostManagementPage />);

    expect(await screen.findByText("案件を選択する")).toBeDefined();
    expect(screen.getByText("見積から取込")).toBeDefined();
  });

  it("案件ゼロのCTAから案件一覧と見積へ遷移する", async () => {
    const user = userEvent.setup();
    mockProjectRepository.findAll.mockResolvedValue([]);
    mockTaskRepository.findAll.mockResolvedValue([]);
    mockCostItemRepository.findAll.mockResolvedValue([]);
    mockExpenseRepository.findAll.mockResolvedValue([]);

    render(<CostManagementPage />);

    await user.click(await screen.findByRole("button", { name: "案件を選択する" }));
    expect(vi.mocked(navigate)).toHaveBeenCalledWith("/app");

    await user.click(screen.getByRole("button", { name: "見積から取込" }));
    expect(vi.mocked(navigate)).toHaveBeenCalledWith("/estimate");
  });

  it("コスト項目ゼロのとき「見積から取込」「予算ベースライン作成」CTAを表示する", async () => {
    mockProjectRepository.findAll.mockResolvedValue([
      {
        id: "p1",
        name: "南青山ビル改修",
        description: "",
        status: "active",
        budget: 1000000,
        startDate: "2025-04-01",
        includeWeekends: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    mockTaskRepository.findAll.mockResolvedValue([]);
    mockCostItemRepository.findAll.mockResolvedValue([]);
    mockExpenseRepository.findAll.mockResolvedValue([]);

    render(<CostManagementPage />);

    expect(await screen.findByText("コスト項目はまだありません")).toBeDefined();
    expect(screen.getAllByText("見積から取込").length).toBeGreaterThan(0);
    expect(screen.getAllByText("予算ベースライン作成").length).toBeGreaterThan(0);
  });

});
