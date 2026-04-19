import { describe, it, expect, vi } from "vitest";
import {
  handleFreeeRequest,
  type SupabaseFreeeBinding,
} from "./freee-api-handler.js";

function makeRes() {
  const captured: { status?: number; body?: unknown; headers: Record<string, string> } = {
    headers: {},
  };
  const res = {
    status(code: number) {
      captured.status = code;
      return res;
    },
    json(b: unknown) {
      captured.body = b;
    },
    setHeader(name: string, value: string) {
      captured.headers[name] = value;
    },
  };
  return { res, captured };
}

function makeBinding(
  opts: {
    user?: { id: string };
    token?: { access_token: string; refresh_token: string; expires_at: string } | null;
  } = {},
): SupabaseFreeeBinding {
  return {
    auth: {
      getUser: vi.fn(async () => {
        if (!opts.user) return { data: { user: null }, error: { message: "no user" } };
        return { data: { user: opts.user }, error: null };
      }),
    },
    loadToken: vi.fn(async () => opts.token ?? null),
    saveToken: vi.fn(async () => ({ error: null })),
  };
}

// ── auth ─────────────────────────────────────────────

describe("handleFreeeRequest auth", () => {
  it("Bearer なしで 401", async () => {
    const { res, captured } = makeRes();
    await handleFreeeRequest(
      { method: "GET", headers: {} },
      res,
      "companies",
      makeBinding({ user: { id: "u1" } }),
      { clientId: "cid", clientSecret: "csec" },
      vi.fn() as unknown as typeof fetch,
    );
    expect(captured.status).toBe(401);
  });

  it("非 GET は 405", async () => {
    const { res, captured } = makeRes();
    await handleFreeeRequest(
      { method: "POST", headers: { authorization: "Bearer x" } },
      res,
      "companies",
      makeBinding({ user: { id: "u1" } }),
      { clientId: "cid", clientSecret: "csec" },
      vi.fn() as unknown as typeof fetch,
    );
    expect(captured.status).toBe(405);
  });
});

// ── companies ───────────────────────────────────────

describe("handleFreeeRequest companies", () => {
  it("保管済みトークンで freee を呼び json を返す", async () => {
    const { res, captured } = makeRes();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        companies: [{ id: 1, name: "L", role: "admin" }],
      }),
    });
    await handleFreeeRequest(
      { method: "GET", headers: { authorization: "Bearer j" } },
      res,
      "companies",
      makeBinding({
        user: { id: "u1" },
        token: {
          access_token: "AT",
          refresh_token: "RT",
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
      }),
      { clientId: "cid", clientSecret: "csec" },
      fetchMock as unknown as typeof fetch,
    );

    expect(captured.status).toBe(200);
    expect(captured.body).toEqual({
      companies: [{ id: 1, name: "L", role: "admin" }],
    });
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe("https://api.freee.co.jp/api/1/companies");
    expect(call[1].headers.Authorization).toBe("Bearer AT");
  });

  it("未連携なら 409 を返す", async () => {
    const { res, captured } = makeRes();
    await handleFreeeRequest(
      { method: "GET", headers: { authorization: "Bearer j" } },
      res,
      "companies",
      makeBinding({ user: { id: "u1" }, token: null }),
      { clientId: "cid", clientSecret: "csec" },
      vi.fn() as unknown as typeof fetch,
    );
    expect(captured.status).toBe(409);
  });
});

// ── invoices ────────────────────────────────────────

describe("handleFreeeRequest invoices", () => {
  it("company_id 無しは 400", async () => {
    const { res, captured } = makeRes();
    await handleFreeeRequest(
      { method: "GET", headers: { authorization: "Bearer j" }, query: {} },
      res,
      "invoices",
      makeBinding({
        user: { id: "u1" },
        token: {
          access_token: "AT",
          refresh_token: "RT",
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
      }),
      { clientId: "cid", clientSecret: "csec" },
      vi.fn() as unknown as typeof fetch,
    );
    expect(captured.status).toBe(400);
  });

  it("company_id 付きで呼べる", async () => {
    const { res, captured } = makeRes();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ invoices: [] }),
    });
    await handleFreeeRequest(
      {
        method: "GET",
        headers: { authorization: "Bearer j" },
        query: { company_id: "99" },
      },
      res,
      "invoices",
      makeBinding({
        user: { id: "u1" },
        token: {
          access_token: "AT",
          refresh_token: "RT",
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
      }),
      { clientId: "cid", clientSecret: "csec" },
      fetchMock as unknown as typeof fetch,
    );
    expect(captured.status).toBe(200);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("company_id=99");
  });
});
