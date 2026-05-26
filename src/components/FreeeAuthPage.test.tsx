/**
 * FreeeAuthPage — コンポーネントテスト
 */

import { act, render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { FreeeAuthPage } from "./FreeeAuthPage.js";

// ── localStorage モック（DigitalBlackboard パターンに倣う） ──

function makeMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  } as Storage;
}

let mockStorage: Storage;

beforeEach(() => {
  mockStorage = makeMockStorage();
  vi.stubGlobal("localStorage", mockStorage);
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** ボタンクリック後、非同期処理が完了するまで待つ */
async function clickAndWait(btn: HTMLElement) {
  await act(async () => {
    fireEvent.click(btn);
    await new Promise((r) => setTimeout(r, 200));
  });
}

// ── disconnected 状態 ──────────────────────────────────

describe("FreeeAuthPage — disconnected", () => {
  it("接続ボタンが表示される", () => {
    render(<FreeeAuthPage />);
    expect(screen.getByRole("button", { name: /freee と連携する/ })).toBeDefined();
  });

  it("接続ボタンクリックで /api/freee/auth を呼び出す", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://freee.example.com/auth" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    let redirectedTo = "";
    const origLocation = window.location;
    Object.defineProperty(window, "location", {
      value: {
        ...origLocation,
        get href() { return redirectedTo; },
        set href(v: string) { redirectedTo = v; },
      },
      configurable: true,
    });

    render(<FreeeAuthPage />);
    await clickAndWait(screen.getByRole("button", { name: /freee と連携する/ }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/freee/auth",
      expect.objectContaining({ method: "GET" }),
    );
    expect(redirectedTo).toBe("https://freee.example.com/auth");

    Object.defineProperty(window, "location", { value: origLocation, configurable: true });
  });

  it("API エラー時にエラーメッセージを表示する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "サーバーエラー" }),
      }),
    );

    render(<FreeeAuthPage />);
    await clickAndWait(screen.getByRole("button", { name: /freee と連携する/ }));

    const alert = screen.getByRole("alert");
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain("サーバーエラー");
  });
});

// ── connected 状態 ────────────────────────────────────

describe("FreeeAuthPage — connected", () => {
  beforeEach(() => {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    mockStorage.setItem("freee_access_token", "AT");
    mockStorage.setItem("freee_expires_at", future);
  });

  it("接続済みバッジが表示される", () => {
    render(<FreeeAuthPage />);
    expect(screen.getByText("接続済み")).toBeDefined();
  });

  it("連携解除ボタンが表示される", () => {
    render(<FreeeAuthPage />);
    expect(screen.getByRole("button", { name: /連携を解除/ })).toBeDefined();
  });

  it("連携解除で localStorage がクリアされ disconnected 表示になる", () => {
    const onDisconnected = vi.fn();
    render(<FreeeAuthPage onDisconnected={onDisconnected} />);

    fireEvent.click(screen.getByRole("button", { name: /連携を解除/ }));

    expect(mockStorage.getItem("freee_access_token")).toBeNull();
    expect(onDisconnected).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: /freee と連携する/ })).toBeDefined();
  });
});

// ── expired 状態 ──────────────────────────────────────

describe("FreeeAuthPage — expired", () => {
  beforeEach(() => {
    const past = new Date(Date.now() - 1000).toISOString();
    mockStorage.setItem("freee_access_token", "AT");
    mockStorage.setItem("freee_expires_at", past);
  });

  it("期限切れバナーと再接続ボタンが表示される", () => {
    render(<FreeeAuthPage />);
    expect(screen.getByText(/有効期限が切れています/)).toBeDefined();
    expect(screen.getByRole("button", { name: /再接続する/ })).toBeDefined();
  });
});

// ── OAuth callback 処理 ───────────────────────────────

describe("FreeeAuthPage — OAuth callback", () => {
  it("URL に code があれば /api/freee/callback を呼び出す", async () => {
    window.history.replaceState(null, "", "/?code=TEST-CODE");

    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "NEW-AT",
        refresh_token: "NEW-RT",
        expires_at: expiresAt,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const onConnected = vi.fn();
    await act(async () => {
      render(<FreeeAuthPage onConnected={onConnected} />);
      await new Promise((r) => setTimeout(r, 200));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/freee/callback",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mockStorage.getItem("freee_access_token")).toBe("NEW-AT");
    expect(onConnected).toHaveBeenCalledOnce();
  });

  it("callback エラーでアラートが表示される", async () => {
    window.history.replaceState(null, "", "/?code=BAD-CODE");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "無効なコード" }),
      }),
    );

    await act(async () => {
      render(<FreeeAuthPage />);
      await new Promise((r) => setTimeout(r, 200));
    });

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toBeDefined();
      expect(alert.textContent).toContain("無効なコード");
    });
  });
});
