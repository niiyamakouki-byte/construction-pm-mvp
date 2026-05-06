import { describe, it, expect, vi } from "vitest";
import { FreeeApi, isExpired, type StoredFreeeToken } from "./freee-api.js";

// ── In-memory TokenStore ──────────────────────────────

function makeStore(initial: StoredFreeeToken | null) {
  let current = initial;
  return {
    load: vi.fn(async () => current),
    save: vi.fn(async (t: StoredFreeeToken) => {
      current = t;
    }),
    get current() {
      return current;
    },
  };
}

function validToken(): StoredFreeeToken {
  return {
    accessToken: "access-1",
    refreshToken: "refresh-1",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // +1h
  };
}

function expiredToken(): StoredFreeeToken {
  return {
    accessToken: "access-old",
    refreshToken: "refresh-old",
    expiresAt: new Date(Date.now() - 60 * 1000).toISOString(), // -1m
  };
}

// ── isExpired ─────────────────────────────────────────

describe("isExpired", () => {
  it("過去日時は expired", () => {
    expect(isExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
  });
  it("60秒以内も expired 扱い（leeway）", () => {
    expect(isExpired(new Date(Date.now() + 30_000).toISOString())).toBe(true);
  });
  it("十分先は有効", () => {
    expect(isExpired(new Date(Date.now() + 10 * 60 * 1000).toISOString())).toBe(
      false,
    );
  });
  it("Invalid Date 文字列は expired 扱い（サイレント誤判定を防ぐ）", () => {
    expect(isExpired("not-a-date")).toBe(true);
    expect(isExpired("")).toBe(true);
    expect(isExpired("2025-13-99")).toBe(true);
  });
});

// ── getCompanies ─────────────────────────────────────

describe("FreeeApi.getCompanies", () => {
  it("Authorization ヘッダ付きで /api/1/companies を呼ぶ", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        companies: [{ id: 1, name: "ラポルタ", role: "admin" }],
      }),
    });
    const store = makeStore(validToken());

    const api = new FreeeApi({
      store,
      clientId: "cid",
      clientSecret: "csec",
      fetchImpl: fetchMock,
    });

    const companies = await api.getCompanies();
    expect(companies).toHaveLength(1);
    expect(companies[0]?.name).toBe("ラポルタ");

    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe("https://api.freee.co.jp/api/1/companies");
    expect(call[1].headers.Authorization).toBe("Bearer access-1");
  });

  it("未保存トークンなら throw", async () => {
    const store = makeStore(null);
    const api = new FreeeApi({
      store,
      clientId: "cid",
      clientSecret: "csec",
      fetchImpl: vi.fn(),
    });
    await expect(api.getCompanies()).rejects.toThrow(/freee未連携/);
  });
});

// ── getInvoices / getDeals ────────────────────────────

describe("FreeeApi.getInvoices", () => {
  it("company_id クエリを付ける", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ invoices: [] }),
    });
    const api = new FreeeApi({
      store: makeStore(validToken()),
      clientId: "cid",
      clientSecret: "csec",
      fetchImpl: fetchMock,
    });
    await api.getInvoices(42, { start_issue_date: "2026-04-01" });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("company_id=42");
    expect(url).toContain("start_issue_date=2026-04-01");
  });
});

describe("FreeeApi.getDeals", () => {
  it("deals 配列を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        deals: [
          {
            id: 10,
            company_id: 42,
            issue_date: "2026-04-10",
            amount: 100_000,
            type: "income",
            status: "settled",
            details: [],
          },
        ],
      }),
    });
    const api = new FreeeApi({
      store: makeStore(validToken()),
      clientId: "cid",
      clientSecret: "csec",
      fetchImpl: fetchMock,
    });
    const deals = await api.getDeals(42);
    expect(deals).toHaveLength(1);
    expect(deals[0]?.amount).toBe(100_000);
  });
});

// ── refresh フロー ────────────────────────────────────

describe("FreeeApi refresh flow", () => {
  it("期限切れなら先に refresh してから本 API を呼ぶ", async () => {
    const store = makeStore(expiredToken());
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/public_api/token")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: "fresh-access",
            refresh_token: "fresh-refresh",
            token_type: "bearer",
            expires_in: 21600,
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ companies: [{ id: 1, name: "L", role: "admin" }] }),
      };
    });

    const api = new FreeeApi({
      store,
      clientId: "cid",
      clientSecret: "csec",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await api.getCompanies();

    // 1回目 token endpoint, 2回目 companies
    const calls = fetchMock.mock.calls as unknown as Array<[string, { headers: Record<string, string> }]>;
    expect(calls[0][0]).toContain("/public_api/token");
    expect(calls[1][0]).toContain("/api/1/companies");
    // store に新しいトークンが保存されている
    expect(store.current?.accessToken).toBe("fresh-access");
    // Authorization ヘッダは新しい access_token
    expect(calls[1][1].headers.Authorization).toBe("Bearer fresh-access");
  });

  it("401 が返ったら refresh してリトライする", async () => {
    const store = makeStore(validToken());
    let callCount = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/public_api/token")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: "after-401",
            refresh_token: "r2",
            token_type: "bearer",
            expires_in: 21600,
          }),
        };
      }
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 401, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ companies: [] }),
      };
    });

    const api = new FreeeApi({
      store,
      clientId: "cid",
      clientSecret: "csec",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await api.getCompanies();

    // companies が 2 回呼ばれている（1回目 401、2回目 成功）
    expect(callCount).toBe(2);
    expect(store.current?.accessToken).toBe("after-401");
  });

  it("API が 500 を返したら throw", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    const api = new FreeeApi({
      store: makeStore(validToken()),
      clientId: "cid",
      clientSecret: "csec",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await expect(api.getCompanies()).rejects.toThrow(/500/);
  });

  it("429 なら Retry-After を含むエラーをスロー（無限ループ防止）", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: (name: string) => (name === "Retry-After" ? "30" : null) },
      json: async () => ({}),
    });
    const api = new FreeeApi({
      store: makeStore(validToken()),
      clientId: "cid",
      clientSecret: "csec",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await expect(api.getCompanies()).rejects.toThrow(/429/);
    await expect(api.getCompanies()).rejects.toThrow(/30s/);
    // fetch は再試行されていない（429 で即 throw）
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
