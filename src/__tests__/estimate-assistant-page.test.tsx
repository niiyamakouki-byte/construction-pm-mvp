/**
 * EstimateAssistantPage コンポーネントテスト (Sprint 9-A)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { EstimateAssistantPage } from "../components/EstimateAssistantPage.js";

// cost-master.json のモック (テスト用最小データ)
vi.mock("../resources/cost-master.json", () => ({
  default: {
    version: "test",
    updatedAt: "2026-01-01",
    currency: "JPY",
    taxRate: 0.1,
    categories: [
      {
        id: "interior",
        name: "内装・仕上げ",
        items: [
          { code: "IN-005", name: "クロス張り（量産品）", unit: "㎡", unitPrice: 1200 },
          { code: "IN-010", name: "フローリング（合板）", unit: "㎡", unitPrice: 6000 },
        ],
      },
      {
        id: "painting",
        name: "塗装工事",
        items: [
          { code: "PA-001", name: "外壁塗装（シリコン）", unit: "㎡", unitPrice: 2800 },
        ],
      },
    ],
  },
}));

// localStorage モック
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

beforeEach(() => {
  localStorageMock.clear();
});

afterEach(() => {
  cleanup();
});

// ── レンダリング ─────────────────────────────────────────────────────────────

describe("EstimateAssistantPage", () => {
  it("ページタイトルが表示される", () => {
    render(<EstimateAssistantPage />);
    expect(screen.getByText("AI見積アシスタント")).toBeDefined();
  });

  it("ウェルカムメッセージが表示される", () => {
    render(<EstimateAssistantPage />);
    expect(screen.getByText(/こんにちは/)).toBeDefined();
  });

  it("入力欄と送信ボタンが表示される", () => {
    render(<EstimateAssistantPage />);
    expect(screen.getByRole("textbox")).toBeDefined();
    expect(screen.getByRole("button", { name: "送信" })).toBeDefined();
  });

  it("初期状態では概算レンジが表示されない", () => {
    render(<EstimateAssistantPage />);
    expect(screen.getByText(/要望を入力すると/)).toBeDefined();
  });

  it("右側に「概算レンジ（税込）」ヘッダーが表示される", () => {
    render(<EstimateAssistantPage />);
    expect(screen.getByText("概算レンジ（税込）")).toBeDefined();
  });

  // ── 会話フロー ───────────────────────────────────────────────────────────

  it("メッセージを送信するとユーザー発言が表示される", () => {
    render(<EstimateAssistantPage />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "LDK 20㎡のリフォーム" } });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));
    expect(screen.getByText("LDK 20㎡のリフォーム")).toBeDefined();
  });

  it("メッセージを送信するとAI返答が表示される", () => {
    render(<EstimateAssistantPage />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "LDK 20㎡" } });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));
    // AI返答に「標準で」が含まれる
    expect(screen.getByText(/標準で/)).toBeDefined();
  });

  it("送信後に入力欄がクリアされる", () => {
    render(<EstimateAssistantPage />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "LDK 10㎡" } });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));
    expect(input.value).toBe("");
  });

  it("送信後に右パネルに松竹梅レンジが表示される", () => {
    render(<EstimateAssistantPage />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "LDK 20㎡" } });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));
    expect(screen.getByText("標準")).toBeDefined();
    expect(screen.getByText("エコノミー")).toBeDefined();
    expect(screen.getByText("ハイグレード")).toBeDefined();
  });

  it("Enterキーで送信できる", () => {
    render(<EstimateAssistantPage />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "寝室 10㎡" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(screen.getByText("寝室 10㎡")).toBeDefined();
  });

  it("世田谷区注記がAI返答に含まれる", () => {
    render(<EstimateAssistantPage />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "外壁 30㎡ 塗装" } });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));
    expect(screen.getAllByText(/世田谷区標準価格/).length).toBeGreaterThan(0);
  });
});
