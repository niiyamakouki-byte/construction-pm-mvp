import { describe, it, expect, vi } from "vitest";
import {
  buildConsentRedirect,
  handleOAuthCallback,
  type FreeeTokenUpserter,
} from "./freee-oauth-handler.js";

// ── buildConsentRedirect ──────────────────────────────

describe("buildConsentRedirect", () => {
  it("client_id / redirect_uri / state を含む authorize URL を返す", () => {
    const url = buildConsentRedirect({
      clientId: "cid-123",
      redirectUri: "https://app.example.com/api/freee/callback",
      state: "user-abc",
    });
    expect(url).toContain("accounts.secure.freee.co.jp/public_api/authorize");
    expect(url).toContain("client_id=cid-123");
    expect(url).toContain("response_type=code");
    expect(url).toContain("state=user-abc");
    expect(url).toContain("redirect_uri=https");
  });
});

// ── handleOAuthCallback ───────────────────────────────

function makeStore(
  behavior: "ok" | "err" = "ok",
): FreeeTokenUpserter & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    upsert: vi.fn(async (row: unknown) => {
      calls.push(row);
      return behavior === "ok"
        ? { error: null }
        : { error: { message: "duplicate key" } };
    }),
  };
}

describe("handleOAuthCallback", () => {
  it("code を token に交換して store に upsert する", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({
        access_token: "AT",
        refresh_token: "RT",
        token_type: "bearer",
        expires_in: 21600,
        scope: "read write",
      }),
    });
    const store = makeStore("ok");
    const now = new Date("2026-04-19T00:00:00.000Z");

    const result = await handleOAuthCallback({
      code: "auth-code-xyz",
      userId: "user-1",
      config: {
        clientId: "cid",
        clientSecret: "csec",
        redirectUri: "https://app.example.com/api/freee/callback",
      },
      store,
      fetchImpl: fetchMock as unknown as typeof fetch,
      now,
    });

    // freee の token エンドポイントに POST している
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe(
      "https://accounts.secure.freee.co.jp/public_api/token",
    );
    expect(call[1].method).toBe("POST");
    const body = String(call[1].body);
    expect(body).toContain("grant_type=authorization_code");
    expect(body).toContain("code=auth-code-xyz");
    expect(body).toContain("client_id=cid");
    expect(body).toContain("client_secret=csec");

    // Supabase に保存された内容
    expect(store.calls[0]).toMatchObject({
      user_id: "user-1",
      access_token: "AT",
      refresh_token: "RT",
      scope: "read write",
    });
    // expires_at は now + 21600s
    expect(result.expiresAt).toBe("2026-04-19T06:00:00.000Z");
  });

  it("freee が非OKを返したら throw", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "invalid_grant",
      json: async () => ({}),
    });
    await expect(
      handleOAuthCallback({
        code: "bad",
        userId: "u",
        config: {
          clientId: "cid",
          clientSecret: "csec",
          redirectUri: "x",
        },
        store: makeStore("ok"),
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/freee token exchange failed/);
  });

  it("Supabase upsert が失敗したら throw", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({
        access_token: "AT",
        refresh_token: "RT",
        token_type: "bearer",
        expires_in: 21600,
      }),
    });
    await expect(
      handleOAuthCallback({
        code: "c",
        userId: "u",
        config: {
          clientId: "cid",
          clientSecret: "csec",
          redirectUri: "x",
        },
        store: makeStore("err"),
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/token 保存に失敗/);
  });
});
