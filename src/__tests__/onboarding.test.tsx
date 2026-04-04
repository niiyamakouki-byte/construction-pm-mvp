import { describe, expect, it, beforeEach, vi } from "vitest";
import { cleanup, render, screen, renderHook, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingWizard, useOnboardingDone } from "../components/OnboardingWizard.js";
import { HelpPage } from "../pages/HelpPage.js";

const { mockProjectCreate } = vi.hoisted(() => ({
  mockProjectCreate: vi.fn().mockResolvedValue(undefined),
}));

// Create a proper localStorage mock since Node's built-in localStorage is incomplete
function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

// Mock OrganizationContext
vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

// Mock navigate
vi.mock("../hooks/useHashRouter.js", () => ({
  navigate: vi.fn(),
  useHashRoute: () => "/app",
}));

// Mock project-store create
vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => ({
    create: mockProjectCreate,
    findAll: vi.fn().mockResolvedValue([]),
  }),
  projectRepository: {
    create: vi.fn().mockResolvedValue(undefined),
    findAll: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("OnboardingWizard", () => {
  beforeEach(() => {
    cleanup();
    vi.stubGlobal("localStorage", createMockLocalStorage());
    mockProjectCreate.mockReset();
    mockProjectCreate.mockResolvedValue(undefined);
  });

  it("ステップ1: ようこそ画面が表示される", () => {
    render(<OnboardingWizard onComplete={() => {}} />);
    expect(screen.getByText("GenbaHubへようこそ！")).toBeDefined();
    expect(screen.getByText("ステップ 1 / 4")).toBeDefined();
  });

  it("「はじめる」でステップ2に進む", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard onComplete={() => {}} />);
    await user.click(screen.getByText("はじめる →"));
    expect(screen.getByText("最初のプロジェクトを作ろう")).toBeDefined();
    expect(screen.getByText("ステップ 2 / 4")).toBeDefined();
  });

  it("ステップ2: 工事名未入力でバリデーションエラー", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard onComplete={() => {}} />);
    await user.click(screen.getByText("はじめる →"));
    await user.click(screen.getByText("次へ →"));
    expect(screen.getByText("プロジェクト名を入力してください")).toBeDefined();
  });

  it("ステップ2: 工事名入力でステップ3に進む", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard onComplete={() => {}} />);
    await user.click(screen.getByText("はじめる →"));
    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "テスト工事");
    await user.click(screen.getByText("次へ →"));
    expect(screen.getByText("工程表を作ろう")).toBeDefined();
    expect(screen.getByText("ステップ 3 / 4")).toBeDefined();
  });

  it("ステップ3: テンプレート選択でハイライトされる", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard onComplete={() => {}} />);
    // Go to step 3
    await user.click(screen.getByText("はじめる →"));
    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "工事テスト");
    await user.click(screen.getByText("次へ →"));
    // Select template
    await user.click(screen.getByText("内装工事"));
    expect(screen.getByText("✓")).toBeDefined();
  });

  it("スキップボタンで onComplete が呼ばれる", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<OnboardingWizard onComplete={onComplete} />);
    await user.click(screen.getByText("スキップ"));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("ステップ3で「戻る」を押すとステップ2に戻る", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard onComplete={() => {}} />);
    await user.click(screen.getByText("はじめる →"));
    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "工事B");
    await user.click(screen.getByText("次へ →"));
    await user.click(screen.getByText("戻る"));
    expect(screen.getByText("最初のプロジェクトを作ろう")).toBeDefined();
  });

  it("プロジェクト作成失敗時はエラーを表示してステップ3に留まる", async () => {
    mockProjectCreate.mockRejectedValueOnce(new Error("保存に失敗しました"));

    const user = userEvent.setup();
    render(<OnboardingWizard onComplete={() => {}} />);

    await user.click(screen.getByText("はじめる →"));
    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "工事C");
    await user.click(screen.getByText("次へ →"));
    await user.click(screen.getByText("内装工事"));
    await user.click(screen.getByText("作成する →"));

    expect((await screen.findByRole("alert")).textContent).toContain("保存に失敗しました");
    expect(screen.getByText("工程表を作ろう")).toBeDefined();
    expect(screen.getByText("ステップ 3 / 4")).toBeDefined();
    expect(screen.queryByText("準備完了！")).toBeNull();
  });
});

describe("useOnboardingDone", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMockLocalStorage());
  });

  it("初期状態は false", () => {
    const { result } = renderHook(() => useOnboardingDone());
    expect(result.current[0]).toBe(false);
  });

  it("markDone を呼ぶと true になる", () => {
    const { result } = renderHook(() => useOnboardingDone());
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem("genbahub_onboarding_done")).toBe("1");
  });
});

describe("HelpPage", () => {
  beforeEach(() => {
    cleanup();
  });

  it("よくある質問が10件表示される", () => {
    render(<HelpPage />);
    const buttons = screen.getAllByRole("button");
    // Each FAQ item is a button
    expect(buttons.length).toBeGreaterThanOrEqual(10);
  });

  it("「工程表の作り方」タップで回答が展開される（aria-expanded）", async () => {
    const user = userEvent.setup();
    render(<HelpPage />);
    // Use closest to get the button element from the text span
    const textEl = screen.getByText("工程表の作り方を教えてください");
    const btn = textEl.closest("button") as HTMLButtonElement;
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    await user.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });

  it("同じ質問を再タップで折りたたまれる", async () => {
    const user = userEvent.setup();
    render(<HelpPage />);
    const textEl = screen.getByText("工程表の作り方を教えてください");
    const btn = textEl.closest("button") as HTMLButtonElement;
    await user.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    await user.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("別の質問をタップすると最初の質問が閉じる", async () => {
    const user = userEvent.setup();
    render(<HelpPage />);
    const btn1 = (screen.getByText("工程表の作り方を教えてください").closest("button")) as HTMLButtonElement;
    const btn2 = (screen.getByText("タスクを追加するにはどうすればいいですか？").closest("button")) as HTMLButtonElement;
    await user.click(btn1);
    expect(btn1.getAttribute("aria-expanded")).toBe("true");
    await user.click(btn2);
    expect(btn1.getAttribute("aria-expanded")).toBe("false");
    expect(btn2.getAttribute("aria-expanded")).toBe("true");
  });
});
