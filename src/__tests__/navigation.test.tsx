/**
 * Navigation コンポーネントのテスト
 * メニュー項目のレンダリング・ルートハイライト・ナビゲーション動作を検証
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Navigation } from "../components/Navigation.js";
import type { NavItem } from "../components/Navigation.js";

function makeItems(activeKey?: string): NavItem[] {
  return [
    { key: "today", label: "ダッシュボード", icon: "📊", path: "/today", active: activeKey === "today" },
    { key: "app", label: "案件一覧", icon: "📋", path: "/app", active: activeKey === "app" },
    { key: "cross-gantt", label: "ガントチャート", icon: "📅", path: "/cross-project-gantt", active: activeKey === "cross-gantt" },
    { key: "tasks", label: "タスク", icon: "✅", path: "/tasks", active: activeKey === "tasks" },
    { key: "estimate", label: "見積", icon: "💰", path: "/estimate", active: activeKey === "estimate" },
    { key: "progress-review", label: "進捗レビュー", icon: "📸", path: "/progress-review", active: activeKey === "progress-review" },
    { key: "safety", label: "安全管理", icon: "🏗️", path: "/safety", active: activeKey === "safety" },
    { key: "crm", label: "CRM", icon: "👥", path: "/crm", active: activeKey === "crm" },
    { key: "contractors", label: "協力会社", icon: "🤝", path: "/contractors", active: activeKey === "contractors" },
    { key: "invoice", label: "請求書", icon: "🧾", path: "/invoice", active: activeKey === "invoice" },
    { key: "reports", label: "レポート", icon: "📈", path: "/reports", active: activeKey === "reports" },
  ];
}

describe("Navigation", () => {
  beforeEach(() => {
    cleanup();
  });

  it("ハンバーガーボタンをクリックするとメニューの全11項目が表示される", async () => {
    const user = userEvent.setup();
    render(<Navigation items={makeItems()} onNavigate={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "ナビゲーションを開く" }));

    const nav = screen.getByRole("navigation", { name: "中央ナビゲーション" });
    const buttons = within(nav).getAllByRole("button");
    expect(buttons).toHaveLength(11);
  });

  it("アクティブなルートの項目が aria-current=page を持つ", async () => {
    const user = userEvent.setup();
    render(<Navigation items={makeItems("progress-review")} onNavigate={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "ナビゲーションを開く" }));

    const nav = screen.getByRole("navigation", { name: "中央ナビゲーション" });
    const activeButton = within(nav).getByRole("button", { name: /進捗レビュー/ });
    expect(activeButton.getAttribute("aria-current")).toBe("page");

    // 非アクティブ項目は aria-current を持たない
    const inactiveButton = within(nav).getByRole("button", { name: /案件一覧/ });
    expect(inactiveButton.getAttribute("aria-current")).toBeNull();
  });

  it("メニュー項目をクリックすると onNavigate が呼ばれメニューが閉じる", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<Navigation items={makeItems()} onNavigate={onNavigate} />);

    await user.click(screen.getByRole("button", { name: "ナビゲーションを開く" }));

    const nav = screen.getByRole("navigation", { name: "中央ナビゲーション" });
    await user.click(within(nav).getByRole("button", { name: /ガントチャート/ }));

    expect(onNavigate).toHaveBeenCalledWith("/cross-project-gantt");
    // メニューが閉じてナビゲーション開くボタンに戻る
    expect(screen.getByRole("button", { name: "ナビゲーションを開く" })).toBeDefined();
  });
});
