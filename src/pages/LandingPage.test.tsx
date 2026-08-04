import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LandingPage } from "./LandingPage.js";
import { navigate } from "../hooks/useHashRouter.js";

vi.mock("../hooks/useHashRouter.js", () => ({
  navigate: vi.fn(),
}));

describe("LandingPage 比較表セクション", () => {
  afterEach(() => {
    cleanup();
  });

  it("比較セクションの見出しが表示される", () => {
    render(<LandingPage />);
    expect(screen.getByText("内装工事会社に選ばれる理由")).toBeTruthy();
  });

  it("比較表ヘッダにLapoSiteが複数箇所に表示される（デスクトップ＋モバイル）", () => {
    render(<LandingPage />);
    const genbaHubHeaders = screen.getAllByText(/LapoSite/);
    expect(genbaHubHeaders.length).toBeGreaterThan(0);
  });

  it("内装工程テンプレの比較行が存在する（デスクトップ表・モバイルカード両対応）", () => {
    render(<LandingPage />);
    // デスクトップ表とモバイルカードの両方に出現するため getAllByText を使用
    const rows = screen.getAllByText("内装工程テンプレ（LGS/ボード/クロス/床）");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("比較表に汎用ツールの価格目安が表示される", () => {
    render(<LandingPage />);
    // デスクトップ表とモバイルカードの両方に出現するため getAllByText を使用
    const priceItems = screen.getAllByText("¥36,000〜");
    expect(priceItems.length).toBeGreaterThan(0);
  });

  it("免責注釈が表示される", () => {
    render(<LandingPage />);
    const disclaimers = screen.getAllByText(/各社公開情報の概算/);
    expect(disclaimers.length).toBeGreaterThan(0);
  });
});

describe("LandingPage ヒーロー登録距離ゼロCTA", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("メール入力→送信で /signup?email=... へ遷移する", async () => {
    const user = userEvent.setup();
    render(<LandingPage />);
    const emailInput = screen.getByLabelText("メールアドレス");
    const form = emailInput.closest("form") as HTMLFormElement;
    await user.type(emailInput, "taro@example.com");
    await user.click(within(form).getByRole("button", { name: "無料で始める" }));
    expect(navigate).toHaveBeenCalledWith("/signup?email=taro%40example.com");
  });
});
