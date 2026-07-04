/**
 * AssistantChatPanel UI テスト
 *
 * (3) panel 折りたたみ/展開
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
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
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 844 });
  });

  it("モバイル初期状態では FAB ボタンのみ表示される（チャットウィンドウは非表示）", () => {
    render(<AssistantChatPanel userId="test-user" />);

    const fab = screen.getByTestId("assistant-chat-fab");
    expect(fab).toBeTruthy();

    // チャットウィンドウは表示されていない
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("デスクトップ初期状態では FAB を表示しない", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1280 });
    render(<AssistantChatPanel userId="test-user" />);

    expect(screen.queryByTestId("assistant-chat-fab")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("デスクトップでは assistant-open イベントでチャットを開ける", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1280 });
    render(<AssistantChatPanel userId="test-user" />);

    act(() => {
      window.dispatchEvent(new CustomEvent("genbahub:assistant-open"));
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeTruthy();
    });
  });

  it("モバイルの FAB は下ナビを避けた位置に出る", () => {
    render(<AssistantChatPanel userId="test-user" />);

    const wrapper = screen.getByTestId("assistant-chat-fab").parentElement as HTMLElement;
    expect(wrapper.style.top).toBe("676px");
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

describe("AssistantChatPanel — /api/chat/poll ポーリングの開始/停止", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1280 });
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 800 });
    // 本番相当の挙動を検証するため DEV フラグを無効化（デフォルトは vitest 上で DEV=true）
    vi.stubEnv("DEV", false);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  function setVisibility(state: "visible" | "hidden") {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => state,
    });
    fireEvent(document, new Event("visibilitychange"));
  }

  it("パネルを開いていない間は poll を呼ばない", async () => {
    render(<AssistantChatPanel userId="test-user" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("パネルを開くと poll が定期的に呼ばれ、閉じると呼ばれなくなる", async () => {
    render(<AssistantChatPanel userId="test-user" />);

    // 開く
    await act(async () => {
      window.dispatchEvent(new CustomEvent("genbahub:assistant-open"));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    // 閉じる
    const dialog = screen.getByRole("dialog");
    const closeBtn = dialog.querySelector('[aria-label="チャットを閉じる"]') as HTMLElement;
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    const callsAfterClose = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(global.fetch).toHaveBeenCalledTimes(callsAfterClose);
  });

  it("タブが非表示になると poll を止め、再表示で再開する", async () => {
    render(<AssistantChatPanel userId="test-user" />);

    await act(async () => {
      window.dispatchEvent(new CustomEvent("genbahub:assistant-open"));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // タブを非表示に
    await act(async () => {
      setVisibility("hidden");
    });

    const callsWhileHidden = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(global.fetch).toHaveBeenCalledTimes(callsWhileHidden);

    // 再表示すると再開する
    await act(async () => {
      setVisibility("visible");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callsWhileHidden);
  });
});
