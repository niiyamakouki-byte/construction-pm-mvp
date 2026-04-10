import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ContractorPortalPage } from "./ContractorPortalPage.js";

const mockFindById = vi.fn();
const mockFindAll = vi.fn();

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => ({
    findById: mockFindById,
  }),
}));

vi.mock("../stores/task-store.js", () => ({
  createTaskRepository: () => ({
    findAll: mockFindAll,
  }),
}));

vi.mock("../lib/site-entry-log.js", () => ({
  getEntryLog: vi.fn().mockReturnValue([]),
}));

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

describe("ContractorPortalPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindById.mockResolvedValue(baseProject);
    mockFindAll.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders loading state initially", () => {
    render(<ContractorPortalPage projectId="proj-1" />);
    expect(screen.getByText("読み込み中...")).toBeDefined();
  });

  it("renders project name after load", async () => {
    render(<ContractorPortalPage projectId="proj-1" />);
    const el = await screen.findByText("南青山リノベーション");
    expect(el).toBeDefined();
  });

  it("shows read-only portal label after load", async () => {
    render(<ContractorPortalPage projectId="proj-1" />);
    await screen.findAllByText("南青山リノベーション");
    expect(screen.getByText(/協力会社ポータル/)).toBeDefined();
  });

  it("shows company name when provided", async () => {
    render(<ContractorPortalPage projectId="proj-1" company="ABC建設" />);
    await screen.findAllByText("南青山リノベーション");
    expect(screen.getByText(/ABC建設/)).toBeDefined();
  });

  it("shows read-only notice", async () => {
    render(<ContractorPortalPage projectId="proj-1" />);
    await screen.findAllByText("南青山リノベーション");
    expect(screen.getByText(/読み取り専用/)).toBeDefined();
  });

  it("renders all 4 tab labels", async () => {
    render(<ContractorPortalPage projectId="proj-1" />);
    await screen.findAllByText("南青山リノベーション");
    expect(screen.getByText("工程表")).toBeDefined();
    expect(screen.getByText("チャット")).toBeDefined();
    expect(screen.getByText("図面")).toBeDefined();
    expect(screen.getByText("入退場")).toBeDefined();
  });

  it("renders not found state for unknown project", async () => {
    mockFindById.mockResolvedValueOnce(null);
    render(<ContractorPortalPage projectId="unknown" />);
    const el = await screen.findByText("プロジェクトが見つかりません");
    expect(el).toBeDefined();
  });
});
