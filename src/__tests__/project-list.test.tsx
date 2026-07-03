import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../i18n/index.js";
import { ProjectListPage } from "../pages/ProjectListPage.js";
import { projectRepository } from "../stores/project-store.js";
import { navigate } from "../hooks/useHashRouter.js";

vi.mock("../hooks/useHashRouter.js", () => ({
  navigate: vi.fn(),
}));

describe("ProjectListPage", () => {
  beforeEach(async () => {
    cleanup();
    vi.mocked(navigate).mockClear();
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
      await screen.findByText("まず案件を作りましょう"),
    ).toBeDefined();
  });

  it("フォームからプロジェクトを作成すると一覧に表示される", async () => {
    const user = userEvent.setup();
    render(<ProjectListPage />);

    // Wait for loading to complete, then open form
    await screen.findByText("新規案件");
    await user.click(screen.getByText("新規案件"));

    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "テスト工事A");
    // 詳細フィールドは折り畳み済みなので展開してから入力
    await user.click(screen.getByRole("button", { name: /詳細を設定する/ }));
    await user.type(screen.getByPlaceholderText("工事概要やメモを入力"), "説明文");
    await user.type(screen.getByLabelText("開始日"), "2025-04-01");
    await user.click(screen.getByRole("button", { name: "作成" }));

    // Project name appears in both desktop table and mobile card
    const elements = await screen.findAllByText("テスト工事A");
    expect(elements.length).toBeGreaterThan(0);
    expect(screen.getByText("メモ")).toBeDefined();
    expect(screen.queryByText("最初の案件を作成しましょう")).toBeNull();

    const projects = await projectRepository.findAll();
    expect(projects.find((project) => project.name === "テスト工事A")?.mode).toBe("memo");
  });

  it("開始日未入力時はローカル日付がデフォルトで使われる", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2025, 5, 15, 20, 0, 0));

    const user = userEvent.setup();
    render(<ProjectListPage />);

    // Wait for loading to complete, then open form
    await screen.findByText("新規案件");
    await user.click(screen.getByText("新規案件"));

    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "日付テスト");
    await user.click(screen.getByRole("button", { name: "作成" }));

    const dateElements = await screen.findAllByText("2025-06-15");
    expect(dateElements.length).toBeGreaterThan(0);
  });

  it("完了済み・工程表なしの案件を記録として作成できる", async () => {
    const user = userEvent.setup();
    render(<ProjectListPage />);

    await screen.findByText("新規案件");
    await user.click(screen.getByText("新規案件"));

    await user.click(screen.getByRole("button", { name: /完了済み・工程表なしで記録/ }));
    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "過去案件A");
    await user.click(screen.getByRole("button", { name: "作成" }));

    expect(await screen.findByText("過去案件A")).toBeDefined();
    expect(screen.getByText("記録を開く")).toBeDefined();

    const projects = await projectRepository.findAll();
    const created = projects.find((project) => project.name === "過去案件A");
    expect(created?.status).toBe("completed");
    expect(created?.mode).toBe("memo");
  });

  it("工程表を作る案件は normal として作成される", async () => {
    const user = userEvent.setup();
    render(<ProjectListPage />);

    await screen.findByText("新規案件");
    await user.click(screen.getByText("新規案件"));

    await user.click(screen.getByRole("button", { name: /工程表を作る案件/ }));
    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "通常案件A");
    await user.click(screen.getByRole("button", { name: "作成" }));

    expect(await screen.findByText("通常案件A")).toBeDefined();
    expect(screen.getByText("通常")).toBeDefined();

    const projects = await projectRepository.findAll();
    expect(projects.find((project) => project.name === "通常案件A")?.mode).toBe("normal");
  });

  it("作成失敗時にエラーメッセージが表示される", async () => {
    vi.spyOn(projectRepository, "create").mockRejectedValueOnce(
      new Error("テストエラー"),
    );

    const user = userEvent.setup();
    render(<ProjectListPage />);

    // Wait for loading to complete, then open form
    await screen.findByText("新規案件");
    await user.click(screen.getByText("新規案件"));

    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "工事X");
    await user.click(screen.getByRole("button", { name: "作成" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("テストエラー");
  });

  it("登録成功後に見積作成CTAバナーが表示される", async () => {
    const user = userEvent.setup();
    render(<ProjectListPage />);

    await screen.findByText("新規案件");
    await user.click(screen.getByText("新規案件"));

    await user.type(
      screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"),
      "CTAテスト案件",
    );
    await user.click(screen.getByRole("button", { name: "作成" }));

    // 初回案件作成時は isFirstProject=true となり専用メッセージが表示される
    expect(
      await screen.findByText("最初の案件を作成しました！次はタスクを追加してみましょう"),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: "見積を作成する" }),
    ).toBeDefined();
  });

  it("見積CTAクリックで /estimate へ遷移する", async () => {
    const user = userEvent.setup();
    render(<ProjectListPage />);

    await screen.findByText("新規案件");
    await user.click(screen.getByText("新規案件"));

    await user.type(
      screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"),
      "遷移テスト案件",
    );
    await user.click(screen.getByRole("button", { name: "作成" }));

    const cta = await screen.findByRole("button", {
      name: "見積を作成する",
    });
    await user.click(cta);

    expect(vi.mocked(navigate)).toHaveBeenCalledWith("/estimate");
  });

  it("工程表を作る案件を登録すると工程表CTAが表示され /gantt/xxx へ遷移する", async () => {
    const user = userEvent.setup();
    render(<ProjectListPage />);

    await screen.findByText("新規案件");
    await user.click(screen.getByText("新規案件"));

    await user.click(screen.getByRole("button", { name: /工程表を作る案件/ }));
    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "工程テスト案件");
    await user.click(screen.getByRole("button", { name: "作成" }));

    const cta = await screen.findByRole("button", { name: "工程表を開く" });
    expect(cta).toBeDefined();

    await user.click(cta);

    const calls = vi.mocked(navigate).mock.calls;
    const ganttCall = calls.find((c) => c[0].startsWith("/gantt/"));
    expect(ganttCall).toBeDefined();
  });

  // UX刷新(20260704)でEmpty Stateを「まず案件を作りましょう」カードに統一。
  // 「見積だけ先に作る」導線は新UIでは廃止されたためskip。
  it.skip("空状態に見積だけ先に作る導線が表示され /estimate へ遷移する", async () => {
    const user = userEvent.setup();
    render(<ProjectListPage />);

    const estimateOnly = await screen.findByRole("button", {
      name: "見積だけ先に作る",
    });
    expect(estimateOnly).toBeDefined();

    await user.click(estimateOnly);
    expect(vi.mocked(navigate)).toHaveBeenCalledWith("/estimate");
  });
});
