/**
 * FreeeClient — OAuth token refresh テスト
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { FreeeClient, LocalStorageTokenStore } from "../client.js";

// ── localStorage モック ───────────────────────────────

function makeLocalStorage() {
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
  mockStorage = makeLocalStorage();
  vi.stubGlobal("localStorage", mockStorage);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── LocalStorageTokenStore ───────────────────────────

describe("LocalStorageTokenStore — getAccessToken", () => {
  it("トークンがなければ null を返す", () => {
    const store = new LocalStorageTokenStore("cid");
    expect(store.getAccessToken()).toBeNull();
  });

  it("有効期限内なら access_token を返す", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    mockStorage.setItem("freee_access_token", "tok");
    mockStorage.setItem("freee_expires_at", future);
    const store = new LocalStorageTokenStore("cid");
    expect(store.getAccessToken()).toBe("tok");
  });

  it("有効期限切れなら null を返す", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    mockStorage.setItem("freee_access_token", "tok");
    mockStorage.setItem("freee_expires_at", past);
    const store = new LocalStorageTokenStore("cid");
    expect(store.getAccessToken()).toBeNull();
  });
});

describe("LocalStorageTokenStore — isExpiringSoon", () => {
  it("5 分以内に切れる場合は true", () => {
    const soon = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    mockStorage.setItem("freee_expires_at", soon);
    const store = new LocalStorageTokenStore("cid");
    expect(store.isExpiringSoon()).toBe(true);
  });

  it("十分な余裕がある場合は false", () => {
    const far = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    mockStorage.setItem("freee_expires_at", far);
    const store = new LocalStorageTokenStore("cid");
    expect(store.isExpiringSoon()).toBe(false);
  });

  it("expires_at がなければ true（期限切れ扱い）", () => {
    const store = new LocalStorageTokenStore("cid");
    expect(store.isExpiringSoon()).toBe(true);
  });
});

describe("LocalStorageTokenStore — refresh", () => {
  it("POST /public_api/token に refresh_token を送り、localStorage を更新する", async () => {
    mockStorage.setItem("freee_refresh_token", "OLD-RT");

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "NEW-AT",
        refresh_token: "NEW-RT",
        token_type: "bearer",
        expires_in: 21600,
      }),
    });

    const store = new LocalStorageTokenStore("cid", mockFetch as unknown as typeof fetch);
    const newToken = await store.refresh();

    expect(newToken).toBe("NEW-AT");
    expect(mockStorage.getItem("freee_access_token")).toBe("NEW-AT");
    expect(mockStorage.getItem("freee_refresh_token")).toBe("NEW-RT");
    expect(mockStorage.getItem("freee_expires_at")).toBeTruthy();

    const body = String(mockFetch.mock.calls[0][1].body);
    expect(body).toContain("grant_type=refresh_token");
    expect(body).toContain("refresh_token=OLD-RT");
    expect(body).toContain("client_id=cid");
  });

  it("refresh_token が無ければエラーを投げる", async () => {
    const store = new LocalStorageTokenStore("cid");
    await expect(store.refresh()).rejects.toThrow("refresh_token");
  });

  it("API エラー時はエラーを投げる", async () => {
    mockStorage.setItem("freee_refresh_token", "OLD-RT");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });
    const store = new LocalStorageTokenStore("cid", mockFetch as unknown as typeof fetch);
    await expect(store.refresh()).rejects.toThrow("401");
  });
});

describe("LocalStorageTokenStore — save / clear", () => {
  it("save() で 3 つのキーを保存する", () => {
    const store = new LocalStorageTokenStore("cid");
    store.save({
      accessToken: "AT",
      refreshToken: "RT",
      expiresAt: "2030-01-01T00:00:00.000Z",
    });
    expect(mockStorage.getItem("freee_access_token")).toBe("AT");
    expect(mockStorage.getItem("freee_refresh_token")).toBe("RT");
    expect(mockStorage.getItem("freee_expires_at")).toBe("2030-01-01T00:00:00.000Z");
  });

  it("clear() で全キーを削除する", () => {
    mockStorage.setItem("freee_access_token", "AT");
    mockStorage.setItem("freee_refresh_token", "RT");
    mockStorage.setItem("freee_expires_at", "2030-01-01T00:00:00.000Z");
    const store = new LocalStorageTokenStore("cid");
    store.clear();
    expect(mockStorage.getItem("freee_access_token")).toBeNull();
    expect(mockStorage.getItem("freee_refresh_token")).toBeNull();
    expect(mockStorage.getItem("freee_expires_at")).toBeNull();
  });
});

// ── FreeeClient with OAuthTokenStore ─────────────────

describe("FreeeClient — OAuthTokenStore 注入", () => {
  it("isConfigured() は store があれば true を返す", () => {
    const store = {
      getAccessToken: () => "tok",
      isExpiringSoon: () => false,
      refresh: async () => "tok",
    };
    const client = new FreeeClient(store);
    expect(client.isConfigured()).toBe(true);
  });

  it("isExpiringSoon の場合は refresh が先に呼ばれる", async () => {
    const refreshMock = vi.fn().mockResolvedValue("NEW-TOKEN");
    const store = {
      getAccessToken: () => null,
      isExpiringSoon: () => true,
      refresh: refreshMock,
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ companies: [] }),
      }),
    );

    const client = new FreeeClient(store);
    await client.getCompanies();
    expect(refreshMock).toHaveBeenCalledOnce();
    const headers = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toContain("NEW-TOKEN");
  });

  it("401 レスポンス → refresh → リトライ", async () => {
    let callCount = 0;
    const refreshMock = vi.fn().mockResolvedValue("REFRESHED-TOKEN");
    const store = {
      getAccessToken: () => "INITIAL-TOKEN",
      isExpiringSoon: () => false,
      refresh: refreshMock,
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ ok: false, status: 401, text: async () => "" });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ companies: [] }),
        });
      }),
    );

    const client = new FreeeClient(store);
    const companies = await client.getCompanies();
    expect(refreshMock).toHaveBeenCalledOnce();
    expect(callCount).toBe(2);
    expect(companies).toEqual([]);
  });
});

describe("FreeeClient — static token", () => {
  it("静的トークンで API を呼べる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ companies: [{ id: 1, name: "A", role: "admin" }] }),
      }),
    );

    const client = new FreeeClient("static-token");
    const result = await client.getCompanies();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("トークン未設定で API 呼び出しするとエラー", async () => {
    const client = new FreeeClient();
    await expect(client.getCompanies()).rejects.toThrow();
  });
});
