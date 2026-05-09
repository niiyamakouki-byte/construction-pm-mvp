/**
 * SiteAssistantPage のテスト (Sprint 12-A)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { SiteAssistantPage, resetPastCaseStore } from "../components/SiteAssistantPage.js";

// localStorage モック
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

vi.stubGlobal("localStorage", localStorageMock);

describe("SiteAssistantPage", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    resetPastCaseStore();
    cleanup();
  });

  it("ヘッダーが表示される", () => {
    render(<SiteAssistantPage />);
    expect(screen.getByText("現場AIアシスタント")).toBeDefined();
  });

  it("テキストエリアが表示される", () => {
    render(<SiteAssistantPage />);
    expect(screen.getByRole("textbox")).toBeDefined();
  });

  it("「質問する」ボタンが表示される", () => {
    render(<SiteAssistantPage />);
    expect(screen.getByText("質問する")).toBeDefined();
  });

  it("初期状態では「質問する」ボタンが disabled である", () => {
    render(<SiteAssistantPage />);
    const btn = screen.getByText("質問する") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("テキスト入力後に「質問する」ボタンが有効になる", () => {
    render(<SiteAssistantPage />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "塗料が足りない" } });
    const btn = screen.getByText("質問する") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("「質問する」ボタンクリックで Solution カードが表示される", () => {
    render(<SiteAssistantPage />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "足りない 在庫がない" } });
    fireEvent.click(screen.getByText("質問する"));
    const adoptButtons = screen.getAllByText("採用");
    expect(adoptButtons.length).toBeGreaterThan(0);
  });

  it("「質問する」後に履歴サイドバーに1件追加される", () => {
    render(<SiteAssistantPage />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "材料が足りない" },
    });
    fireEvent.click(screen.getByText("質問する"));
    expect(screen.queryByText("まだ質問がありません")).toBeNull();
  });

  it("送信後に入力欄がクリアされる", () => {
    render(<SiteAssistantPage />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "危険な状況" } });
    fireEvent.click(screen.getByText("質問する"));
    expect(textarea.value).toBe("");
  });

  it("プロジェクト選択セレクトが表示される", () => {
    render(<SiteAssistantPage />);
    expect(screen.getByRole("combobox")).toBeDefined();
  });

  it("「直近の質問」サイドバーヘッダーが表示される", () => {
    render(<SiteAssistantPage />);
    expect(screen.getByText("直近の質問")).toBeDefined();
  });

  it("初期状態の履歴は「まだ質問がありません」と表示される", () => {
    render(<SiteAssistantPage />);
    expect(screen.getByText("まだ質問がありません")).toBeDefined();
  });
});
