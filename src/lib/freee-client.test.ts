import { describe, it, expect, vi } from "vitest";
import {
  buildAuthorizeUrl,
  computeExpiresAt,
  exchangeCodeForToken,
  refreshAccessToken,
} from "./freee-client.js";

describe("buildAuthorizeUrl", () => {
  it("必須クエリを含む", () => {
    const url = buildAuthorizeUrl({
      clientId: "cid",
      redirectUri: "https://x/y",
      state: "s",
    });
    expect(url).toContain("client_id=cid");
    expect(url).toContain("response_type=code");
    expect(url).toContain("state=s");
  });
});

describe("computeExpiresAt", () => {
  it("created_at + expires_in で計算する", () => {
    const iso = computeExpiresAt({
      access_token: "a",
      refresh_token: "r",
      token_type: "bearer",
      expires_in: 3600,
      created_at: 1_700_000_000, // unix sec
    });
    expect(iso).toBe(new Date(1_700_003_600 * 1000).toISOString());
  });

  it("created_at が無ければ now 基準", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const iso = computeExpiresAt(
      {
        access_token: "a",
        refresh_token: "r",
        token_type: "bearer",
        expires_in: 60,
      },
      now,
    );
    expect(iso).toBe("2026-01-01T00:01:00.000Z");
  });
});

describe("exchangeCodeForToken", () => {
  it("POST /public_api/token に code を送る", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({
        access_token: "A",
        refresh_token: "R",
        token_type: "bearer",
        expires_in: 21600,
      }),
    });
    const tok = await exchangeCodeForToken(
      { clientId: "cid", clientSecret: "sec", redirectUri: "uri" },
      "CODE",
      fetchMock as unknown as typeof fetch,
    );
    expect(tok.access_token).toBe("A");
    const body = String(fetchMock.mock.calls[0][1].body);
    expect(body).toContain("grant_type=authorization_code");
    expect(body).toContain("code=CODE");
  });
});

describe("refreshAccessToken", () => {
  it("POST /public_api/token に refresh_token を送る", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({
        access_token: "A2",
        refresh_token: "R2",
        token_type: "bearer",
        expires_in: 21600,
      }),
    });
    const tok = await refreshAccessToken(
      { clientId: "cid", clientSecret: "sec" },
      "OLD-REFRESH",
      fetchMock as unknown as typeof fetch,
    );
    expect(tok.access_token).toBe("A2");
    const body = String(fetchMock.mock.calls[0][1].body);
    expect(body).toContain("grant_type=refresh_token");
    expect(body).toContain("refresh_token=OLD-REFRESH");
  });
});
