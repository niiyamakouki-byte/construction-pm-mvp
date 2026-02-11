import { describe, expect, it, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectListPage } from "../pages/ProjectListPage.js";
import { projectRepository } from "../stores/project-store.js";

describe("ProjectListPage", () => {
  beforeEach(async () => {
    cleanup();
    // リポジトリをクリア
    const all = await projectRepository.findAll();
    for (const p of all) {
      await projectRepository.delete(p.id);
    }
  });

  it("空状態で「プロジェクトがありません」と表示される", async () => {
    render(<ProjectListPage />);
    expect(
      await screen.findByText("プロジェクトがありません"),
    ).toBeDefined();
  });

  it("フォームからプロジェクトを作成すると一覧に表示される", async () => {
    const user = userEvent.setup();
    render(<ProjectListPage />);

    // フォーム入力
    await user.type(screen.getByLabelText("名前"), "テスト工事A");
    await user.type(screen.getByLabelText("説明"), "説明文");
    await user.type(screen.getByLabelText("開始日"), "2025-04-01");
    await user.click(screen.getByRole("button", { name: "作成" }));

    // 一覧に表示されることを確認
    expect(await screen.findByText("テスト工事A")).toBeDefined();
    // 空状態メッセージが消えていること
    expect(screen.queryByText("プロジェクトがありません")).toBeNull();
  });
});
