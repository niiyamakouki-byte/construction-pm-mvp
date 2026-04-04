/**
 * OnboardingWizard の追加テスト
 * ステップ4遷移・プロジェクト名バリデーション（短すぎ）・テンプレートなし時の制御を検証する
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingWizard } from "../components/OnboardingWizard.js";

// Create a proper localStorage mock
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

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

vi.mock("../hooks/useHashRouter.js", () => ({
  navigate: vi.fn(),
  useHashRoute: () => "/app",
}));

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => ({
    create: vi.fn().mockResolvedValue(undefined),
    findAll: vi.fn().mockResolvedValue([]),
  }),
  projectRepository: {
    create: vi.fn().mockResolvedValue(undefined),
    findAll: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("OnboardingWizard 追加テスト", () => {
  beforeEach(() => {
    cleanup();
    vi.stubGlobal("localStorage", createMockLocalStorage());
  });

  it("プログレスバーがステップ 1/4 で 25% 幅になる", async () => {
    const { container } = render(<OnboardingWizard onComplete={() => {}} />);
    // The progress bar div has inline style width
    const progressBar = container.querySelector("[style]") as HTMLElement;
    expect(progressBar?.style.width).toBe("25%");
  });

  it("ステップ2: 工事名が1文字だとバリデーションエラー（2文字以上必要）", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard onComplete={() => {}} />);
    await user.click(screen.getByText("はじめる →"));
    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "A");
    await user.click(screen.getByText("次へ →"));
    expect(screen.getByText("プロジェクト名は2文字以上で入力してください")).toBeDefined();
  });

  it("ステップ3: テンプレート未選択では「作成する」ボタンが disabled", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard onComplete={() => {}} />);
    await user.click(screen.getByText("はじめる →"));
    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "工事テスト");
    await user.click(screen.getByText("次へ →"));
    const createButton = screen.getByText("作成する →").closest("button") as HTMLButtonElement;
    expect(createButton.disabled).toBe(true);
  });

  it("ステップ3: テンプレート選択後は「作成する」ボタンが有効になる", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard onComplete={() => {}} />);
    await user.click(screen.getByText("はじめる →"));
    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "工事テスト");
    await user.click(screen.getByText("次へ →"));
    await user.click(screen.getByText("内装工事"));
    const createButton = screen.getByText("作成する →").closest("button") as HTMLButtonElement;
    expect(createButton.disabled).toBe(false);
  });

  it("ステップ3: 外構工事テンプレートを選択できる", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard onComplete={() => {}} />);
    await user.click(screen.getByText("はじめる →"));
    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "外構テスト");
    await user.click(screen.getByText("次へ →"));
    await user.click(screen.getByText("外構工事"));
    expect(screen.getByText("✓")).toBeDefined();
  });

  it("ステップ3: 設備工事テンプレートを選択できる", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard onComplete={() => {}} />);
    await user.click(screen.getByText("はじめる →"));
    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "設備テスト");
    await user.click(screen.getByText("次へ →"));
    await user.click(screen.getByText("設備工事"));
    expect(screen.getByText("✓")).toBeDefined();
  });

  it("ステップ3→4: テンプレート選択して「作成する」でステップ4に進む", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard onComplete={() => {}} />);
    await user.click(screen.getByText("はじめる →"));
    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "工事D");
    await user.click(screen.getByText("次へ →"));
    await user.click(screen.getByText("内装工事"));
    await user.click(screen.getByText("作成する →"));
    expect(await screen.findByText("準備完了！")).toBeDefined();
    expect(screen.getByText("ステップ 4 / 4")).toBeDefined();
  });

  it("ステップ4: 「工程表を開く」ボタンが表示される", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard onComplete={() => {}} />);
    await user.click(screen.getByText("はじめる →"));
    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "工事E");
    await user.click(screen.getByText("次へ →"));
    await user.click(screen.getByText("内装工事"));
    await user.click(screen.getByText("作成する →"));
    expect(await screen.findByText("工程表を開く →")).toBeDefined();
  });

  it("ステップ4: 「工程表を開く」をクリックすると onComplete が呼ばれる", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<OnboardingWizard onComplete={onComplete} />);
    await user.click(screen.getByText("はじめる →"));
    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "工事F");
    await user.click(screen.getByText("次へ →"));
    await user.click(screen.getByText("内装工事"));
    await user.click(screen.getByText("作成する →"));
    await screen.findByText("工程表を開く →");
    await user.click(screen.getByText("工程表を開く →"));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("ステップ4: スキップボタンが表示されない", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard onComplete={() => {}} />);
    await user.click(screen.getByText("はじめる →"));
    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "工事G");
    await user.click(screen.getByText("次へ →"));
    await user.click(screen.getByText("内装工事"));
    await user.click(screen.getByText("作成する →"));
    await screen.findByText("準備完了！");
    expect(screen.queryByText("スキップ")).toBeNull();
  });

  it("「次にやること」が3つ表示される（ステップ4）", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard onComplete={() => {}} />);
    await user.click(screen.getByText("はじめる →"));
    await user.type(screen.getByPlaceholderText("例: 渋谷オフィスビル内装工事"), "工事H");
    await user.click(screen.getByText("次へ →"));
    await user.click(screen.getByText("内装工事"));
    await user.click(screen.getByText("作成する →"));
    await screen.findByText("準備完了！");
    expect(screen.getByText("工程表でタスクを追加する")).toBeDefined();
    expect(screen.getByText("業者を登録する")).toBeDefined();
    expect(screen.getByText("今日のタスクを確認する")).toBeDefined();
  });

  it("現場住所フィールドが任意で入力できる", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard onComplete={() => {}} />);
    await user.click(screen.getByText("はじめる →"));
    await user.type(screen.getByPlaceholderText("例: 東京都港区南青山3-1-1"), "東京都渋谷区1-2-3");
    expect(screen.getByDisplayValue("東京都渋谷区1-2-3")).toBeDefined();
  });

  it("role=dialog が設定されている", () => {
    render(<OnboardingWizard onComplete={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeDefined();
  });
});
