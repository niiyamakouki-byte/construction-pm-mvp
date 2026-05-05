/**
 * AssistantChatPanel UI テスト
 *
 * (3) panel 折りたたみ/展開
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { AssistantChatPanel } from "../components/AssistantChatPanel.js";

// framer-motion をスタブ化: jsdom では exit アニメーションが DOM に残るため
// AnimatePresence はそのまま children を描画するパススルーにする
vi.mock("framer-motion", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    motion: new Proxy(
      {},
      {
        get: (_: unknown, tag: string) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          React.forwardRef(({ children, ...props }: any, ref: any) =>
            React.createElement(tag, { ...props, ref }, children)
          ),
      }
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

// localStorage をモック（jsdom 環境では clear() が未実装のため）
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// fetch をモック（API 呼び出しをスタブ）
beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ messages: [] }),
  });

  localStorageMock.clear();
});

afterEach(() => {
  cleanup();
});

describe("AssistantChatPanel", () => {
  it("初期状態では FAB ボタンのみ表示される（チャットウィンドウは非表示）", () => {
    render(<AssistantChatPanel userId="test-user" />);

    const fab = screen.getByTestId("assistant-chat-fab");
    expect(fab).toBeTruthy();

    // チャットウィンドウは表示されていない
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("FAB ボタンをクリックするとチャットウィンドウが展開する", () => {
    render(<AssistantChatPanel userId="test-user" />);

    const fab = screen.getByTestId("assistant-chat-fab");
    fireEvent.click(fab);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
  });

  it("展開中は FAB が非表示になり、閉じるボタンでパネルを折りたためる", () => {
    render(<AssistantChatPanel userId="test-user" />);

    const fab = screen.getByTestId("assistant-chat-fab");

    // 展開 → FAB は消える
    fireEvent.click(fab);
    expect(screen.queryByTestId("assistant-chat-fab")).toBeNull();
    expect(screen.getByRole("dialog")).toBeTruthy();

    // ヘッダーの閉じるボタンで折りたたむ
    const dialog = screen.getByRole("dialog");
    const closeBtn = dialog.querySelector('[aria-label="チャットを閉じる"]') as HTMLElement;
    fireEvent.click(closeBtn);
    expect(screen.queryByRole("dialog")).toBeNull();
    // FAB が再表示される
    expect(screen.getByTestId("assistant-chat-fab")).toBeTruthy();
  });

  it("Escape キーでパネルを閉じられる", () => {
    render(<AssistantChatPanel userId="test-user" />);

    fireEvent.click(screen.getByTestId("assistant-chat-fab"));
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Ctrl+K でパネルをトグル開閉できる", () => {
    render(<AssistantChatPanel userId="test-user" />);

    // 開く
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeTruthy();

    // 閉じる
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("閉じるボタンでチャットウィンドウを折りたためる", () => {
    render(<AssistantChatPanel userId="test-user" />);

    // 展開
    fireEvent.click(screen.getByTestId("assistant-chat-fab"));
    expect(screen.getByRole("dialog")).toBeTruthy();

    // ヘッダーの閉じるボタン（dialog 内に存在するもの）
    const dialog = screen.getByRole("dialog");
    const closeBtn = dialog.querySelector('[aria-label="チャットを閉じる"]') as HTMLElement;
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("展開するとプレースホルダー付きの入力エリアが表示される", () => {
    render(<AssistantChatPanel userId="test-user" />);
    fireEvent.click(screen.getByTestId("assistant-chat-fab"));

    const textarea = screen.getByLabelText("メッセージ入力");
    expect(textarea).toBeTruthy();
  });

  it("入力が空の場合は送信ボタンが無効化されている", () => {
    render(<AssistantChatPanel userId="test-user" />);
    fireEvent.click(screen.getByTestId("assistant-chat-fab"));

    const sendBtn = screen.getByLabelText("送信");
    expect((sendBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("テキストを入力すると送信ボタンが有効化される", () => {
    render(<AssistantChatPanel userId="test-user" />);
    fireEvent.click(screen.getByTestId("assistant-chat-fab"));

    const textarea = screen.getByLabelText("メッセージ入力");
    fireEvent.change(textarea, { target: { value: "テストメッセージ" } });

    const sendBtn = screen.getByLabelText("送信");
    expect((sendBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("送信後にメッセージが吹き出しとして表示される", async () => {
    render(<AssistantChatPanel userId="test-user" />);
    fireEvent.click(screen.getByTestId("assistant-chat-fab"));

    const textarea = screen.getByLabelText("メッセージ入力");
    fireEvent.change(textarea, { target: { value: "こんにちは" } });
    fireEvent.click(screen.getByLabelText("送信"));

    await waitFor(() => {
      expect(screen.getByText("こんにちは")).toBeTruthy();
    });
  });

  it("/estimate コマンドを送信すると秘書の返答が表示される", async () => {
    render(<AssistantChatPanel userId="test-user" />);
    fireEvent.click(screen.getByTestId("assistant-chat-fab"));

    const textarea = screen.getByLabelText("メッセージ入力");
    fireEvent.change(textarea, { target: { value: "/estimate 壁紙 LDK 30㎡" } });
    fireEvent.click(screen.getByLabelText("送信"));

    await waitFor(() => {
      expect(screen.getByText("/estimate 壁紙 LDK 30㎡")).toBeTruthy();
    });
    // 秘書の返答に見積が含まれる
    await waitFor(() => {
      const texts = screen.getAllByText(/見積/);
      expect(texts.length).toBeGreaterThan(0);
    });
  });

  it("/help コマンドを送信するとコマンド一覧が表示される", async () => {
    render(<AssistantChatPanel userId="test-user" />);
    fireEvent.click(screen.getByTestId("assistant-chat-fab"));

    const textarea = screen.getByLabelText("メッセージ入力");
    fireEvent.change(textarea, { target: { value: "/help" } });
    fireEvent.click(screen.getByLabelText("送信"));

    await waitFor(() => {
      const texts = screen.getAllByText(/\/estimate/);
      expect(texts.length).toBeGreaterThan(0);
    });
  });
});
