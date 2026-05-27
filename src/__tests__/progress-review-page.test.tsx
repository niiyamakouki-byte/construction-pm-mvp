import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressReviewPage } from "../pages/ProgressReviewPage.js";
import { navigate } from "../hooks/useHashRouter.js";

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

vi.mock("../hooks/useHashRouter.js", () => ({
  navigate: vi.fn(),
}));

const mockProjectRepository = { findAll: vi.fn() };
const mockTaskRepository = { findAll: vi.fn() };

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => mockProjectRepository,
}));

vi.mock("../stores/task-store.js", () => ({
  createTaskRepository: () => mockTaskRepository,
}));

describe("ProgressReviewPage", () => {
  beforeEach(() => {
    mockProjectRepository.findAll.mockReset();
    mockTaskRepository.findAll.mockReset();
    vi.mocked(navigate).mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("案件ゼロのとき案件選択と写真選択の前提説明CTAを表示する", async () => {
    mockProjectRepository.findAll.mockResolvedValue([]);
    mockTaskRepository.findAll.mockResolvedValue([]);

    render(<ProgressReviewPage />);

    await waitFor(() => {
      expect(screen.getByText("進捗レビューは、案件選択と写真選択を先に行います")).toBeDefined();
    });
    expect(screen.getByText("案件を選ぶ")).toBeDefined();
    expect(screen.getByText("写真をアップロード")).toBeDefined();
  });

  it("「案件を選ぶ」ボタンクリックで /app に遷移する", async () => {
    mockProjectRepository.findAll.mockResolvedValue([]);
    mockTaskRepository.findAll.mockResolvedValue([]);

    render(<ProgressReviewPage />);

    const btn = await screen.findByText("案件を選ぶ");
    btn.click();

    expect(vi.mocked(navigate)).toHaveBeenCalledWith("/app");
  });

  it("「写真をアップロード」ボタンクリックで /today に遷移する", async () => {
    mockProjectRepository.findAll.mockResolvedValue([]);
    mockTaskRepository.findAll.mockResolvedValue([]);

    render(<ProgressReviewPage />);

    const btn = await screen.findByText("写真をアップロード");
    btn.click();

    expect(vi.mocked(navigate)).toHaveBeenCalledWith("/today");
  });
});
