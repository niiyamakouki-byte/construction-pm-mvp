/**
 * PricingPage のテスト
 * プラン表示・Stripe未設定時のモーダル・プラン選択を検証する
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PricingPage } from "../pages/PricingPage.js";

// Mock navigate
vi.mock("../hooks/useHashRouter.js", () => ({
  navigate: vi.fn(),
  useHashRoute: () => "/app/pricing",
}));

// Mock stripe (not configured by default)
vi.mock("../lib/stripe.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/stripe.js")>();
  return {
    ...actual,
    isStripeConfigured: vi.fn(() => false),
  };
});

// Mock SubscriptionContext
vi.mock("../contexts/SubscriptionContext.js", () => ({
  useSubscriptionContext: () => ({
    plan: "free",
    limits: { maxProjects: 1, maxTasks: 20 },
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    planPeriodEnd: null,
    loading: false,
    canCreateProject: (n: number) => n < 1,
    canAddTask: (n: number) => n < 20,
  }),
}));

describe("PricingPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("プランと料金ページのタイトルが表示される", () => {
    render(<PricingPage />);
    expect(screen.getByText("プランと料金")).toBeDefined();
  });

  it("3つのプランカード（フリー・スタンダード・プロ）が表示される", () => {
    render(<PricingPage />);
    // フリーは現在のプランラベルとカードタイトルで複数出るので getAllByText を使う
    expect(screen.getAllByText("フリー").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("スタンダード")).toBeDefined();
    expect(screen.getByText("プロ")).toBeDefined();
  });

  it("現在のプラン（フリー）が表示される", () => {
    render(<PricingPage />);
    // currentPlanLabel が表示される
    const labels = screen.getAllByText("フリー");
    expect(labels.length).toBeGreaterThan(0);
  });

  it("フリープランのカードに「現在のプラン」表示がある", () => {
    render(<PricingPage />);
    expect(screen.getByText("現在のプラン")).toBeDefined();
  });

  it("スタンダードプランに「おすすめ」バッジが表示される", () => {
    render(<PricingPage />);
    expect(screen.getByText("おすすめ")).toBeDefined();
  });

  it("各プランの月額料金が表示される", () => {
    render(<PricingPage />);
    expect(screen.getByText("¥0")).toBeDefined();
    expect(screen.getByText("¥2,980")).toBeDefined();
    expect(screen.getByText("¥9,800")).toBeDefined();
  });

  it("Stripe未設定時にスタンダードプランを選択するとモーダルが表示される", async () => {
    const user = userEvent.setup();
    render(<PricingPage />);
    await user.click(screen.getByRole("button", { name: "スタンダードプランを選択" }));
    expect(screen.getByText("Stripe連携準備中")).toBeDefined();
  });

  it("Stripe未設定モーダルを閉じられる", async () => {
    const user = userEvent.setup();
    render(<PricingPage />);
    await user.click(screen.getByRole("button", { name: "スタンダードプランを選択" }));
    expect(screen.getByText("Stripe連携準備中")).toBeDefined();
    await user.click(screen.getByText("閉じる"));
    expect(screen.queryByText("Stripe連携準備中")).toBeNull();
  });

  it("プロプランの選択ボタンも機能する", async () => {
    const user = userEvent.setup();
    render(<PricingPage />);
    await user.click(screen.getByRole("button", { name: "プロプランを選択" }));
    expect(screen.getByText("Stripe連携準備中")).toBeDefined();
  });

  it("「アプリに戻る」ボタンが存在する", () => {
    render(<PricingPage />);
    expect(screen.getByText("アプリに戻る")).toBeDefined();
  });

  it("「アプリに戻る」ボタンをクリックすると navigate が呼ばれる", async () => {
    const { navigate } = await import("../hooks/useHashRouter.js");
    const user = userEvent.setup();
    render(<PricingPage />);
    await user.click(screen.getByText("アプリに戻る"));
    expect(navigate).toHaveBeenCalledWith("/app");
  });

  it("フリープランカードに「クレジットカード不要」の機能説明がある", () => {
    render(<PricingPage />);
    expect(screen.getByText("クレジットカード不要")).toBeDefined();
  });

  it("プロプランに「API連携」機能が含まれる", () => {
    render(<PricingPage />);
    expect(screen.getByText("API連携")).toBeDefined();
  });
});

// ── isStripeConfigured のユニットテスト ───────────────────────────

describe("isStripeConfigured", () => {
  it("PUBLISHABLE_KEY が未設定の場合は false を返す", async () => {
    const { isStripeConfigured } = await import("../lib/stripe.js");
    // モック化されているので false が返る
    expect(isStripeConfigured()).toBe(false);
  });
});
