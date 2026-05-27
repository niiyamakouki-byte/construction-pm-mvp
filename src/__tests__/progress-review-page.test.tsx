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

  it("案件ゼロのとき前提説明と「案件を選ぶ」「写真をアップロード」CTAを表示する", async () => {
    mockProjectRepository.findAll.mockResolvedValue([]);
    mockTaskRepository.findAll.mockResolvedValue([]);

    render(<ProgressReviewPage />);

    await waitFor(() => {
      expect(screen.getByText("進捗レビューを始めるには、案件と写真が必要です")).toBeDefined();
    });
    expect(screen.getByText("案件を選ぶ")).toBeDefined();
    expect(screen.getByText("写真をアップロード")).toBeDefined();
  });

  it("「案件を選ぶ」ボタンクリックで /projects に遷移する", async () => {
    mockProjectRepository.findAll.mockResolvedValue([]);
    mockTaskRepository.findAll.mockResolvedValue([]);

    render(<ProgressReviewPage />);

    const btn = await screen.findByText("案件を選ぶ");
    btn.click();

    expect(vi.mocked(navigate)).toHaveBeenCalledWith("/projects");
  });

  it("「写真をアップロード」ボタンクリックで /photo に遷移する", async () => {
    mockProjectRepository.findAll.mockResolvedValue([]);
    mockTaskRepository.findAll.mockResolvedValue([]);

    render(<ProgressReviewPage />);

    const btn = await screen.findByText("写真をアップロード");
    btn.click();

    expect(vi.mocked(navigate)).toHaveBeenCalledWith("/photo");
  });
});
