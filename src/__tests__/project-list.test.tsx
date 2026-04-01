import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectListPage } from "../pages/ProjectListPage.js";
import { projectRepository } from "../stores/project-store.js";

describe("ProjectListPage", () => {
  beforeEach(async () => {
    cleanup();
    const all = await projectRepository.findAll();
    for (const p of all) {
      await projectRepository.delete(p.id);
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("空状態でオンボーディングメッセージが表示される", async () => {
    render(<ProjectListPage />);
    expect(
      await screen.findByText("最初のプロジェクトを作成しましょう"),
    ).toBeDefined();
  });

  it("フォームからプロジェクトを作成すると一覧に表示される", async () => {
    const user = userEvent.setup();
    render(<ProjectListPage />);

    // Open the form first (collapsible)
    await user.click(screen.getByText("新規プロジェクト"));

    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "テスト工事A");
    await user.type(screen.getByPlaceholderText("工事概要やメモを入力"), "説明文");
    await user.type(screen.getByLabelText("開始日"), "2025-04-01");
    await user.click(screen.getByRole("button", { name: "作成" }));

    // Project name appears in both desktop table and mobile card
    const elements = await screen.findAllByText("テスト工事A");
    expect(elements.length).toBeGreaterThan(0);
    expect(screen.queryByText("最初のプロジェクトを作成しましょう")).toBeNull();
  });

  it("開始日未入力時はローカル日付がデフォルトで使われる", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2025, 5, 15, 20, 0, 0));

    const user = userEvent.setup();
    render(<ProjectListPage />);

    // Open the form
    await user.click(screen.getByText("新規プロジェクト"));

    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "日付テスト");
    await user.click(screen.getByRole("button", { name: "作成" }));

    const dateElements = await screen.findAllByText("2025-06-15");
    expect(dateElements.length).toBeGreaterThan(0);
  });

  it("作成失敗時にエラーメッセージが表示される", async () => {
    vi.spyOn(projectRepository, "create").mockRejectedValueOnce(
      new Error("テストエラー"),
    );

    const user = userEvent.setup();
    render(<ProjectListPage />);

    // Open the form
    await user.click(screen.getByText("新規プロジェクト"));

    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "工事X");
    await user.click(screen.getByRole("button", { name: "作成" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("テストエラー");
  });
});
