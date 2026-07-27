import { describe, it, expect, beforeEach } from "vitest";
import { generateShareToken, verifyShareToken, createShareToken, verifySignedToken, hashPassword, type ShareTokenFetcher } from "../lib/share-token.js";
import { _resetForTest, revoke, markRedeemed } from "../lib/share-token-store.js";
import {
  createSignedShareToken,
  verifySignedShareToken,
  handleShareTokenRequest,
  type ShareTokenResponse,
} from "../lib/share-token-handler.js";
import type { SupabaseAuthVerifier } from "../lib/auth-helper.js";

/**
 * createShareToken/verifySignedToken (src/lib/share-token.ts) は現在ネットワーク越しに
 * /api/share-token へ委譲するだけの薄いラッパー。実際の署名・検証ロジックの正しさは
 * src/lib/__tests__/share-token-handler.test.ts が保証する。
 * ここではラッパーの配線（リクエスト形状・認証ヘッダ・エラー時のfail-closed動作）を検証する。
 * サーバーを実際に立てず、handleShareTokenRequest を呼ぶフェイクの fetch で代替する。
 */
const TEST_ENV: NodeJS.ProcessEnv = { SHARE_TOKEN_SECRET: "test-secret-do-not-use-in-prod" };

const testAuth: SupabaseAuthVerifier = {
  getUser: async (token: string) =>
    token === "valid-jwt"
      ? { data: { user: { id: "user-1" } }, error: null }
      : { data: { user: null }, error: { message: "invalid" } },
};

function fakeServerFetcher(): ShareTokenFetcher {
  return async (_url, init) => {
    const req = {
      method: "POST",
      headers: Object.fromEntries(new Headers(init.headers).entries()),
      body: init.body,
    };
    let status = 200;
    let body: unknown = null;
    const res: ShareTokenResponse = {
      status(code) {
        status = code;
        return res;
      },
      json(b) {
        body = b;
        return res;
      },
      setHeader() {
        /* noop */
      },
    };
    await handleShareTokenRequest(req, res, { auth: testAuth, env: TEST_ENV });
    return new Response(JSON.stringify(body), { status });
  };
}

beforeEach(() => {
  _resetForTest();
});

describe("generateShareToken", () => {
  it("returns a token string and payload", () => {
    const { token, payload } = generateShareToken("proj-1", "progress");
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
    expect(payload.projectId).toBe("proj-1");
    expect(payload.scope).toBe("progress");
  });

  it("payload has tokenId as UUID", () => {
    const { payload } = generateShareToken("proj-1", "progress");
    expect(payload.tokenId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("default ttl is 5 minutes", () => {
    const before = Date.now();
    const { payload } = generateShareToken("proj-1", "progress");
    const after = Date.now();
    const ttlMs = payload.expiresAt - payload.issuedAt;
    expect(ttlMs).toBeGreaterThanOrEqual(5 * 60 * 1000 - 1);
    expect(ttlMs).toBeLessThanOrEqual(5 * 60 * 1000 + 1);
    expect(payload.issuedAt).toBeGreaterThanOrEqual(before);
    expect(payload.issuedAt).toBeLessThanOrEqual(after);
  });

  it("custom ttl is respected", () => {
    const { payload } = generateShareToken("proj-1", "photos", {
      ttlMinutes: 30,
    });
    const ttlMs = payload.expiresAt - payload.issuedAt;
    expect(ttlMs).toBeGreaterThanOrEqual(30 * 60 * 1000 - 1);
  });

  it("oneTime defaults to false", () => {
    const { payload } = generateShareToken("proj-1", "all");
    expect(payload.oneTime).toBe(false);
  });

  it("oneTime flag is stored in payload", () => {
    const { payload } = generateShareToken("proj-1", "all", { oneTime: true });
    expect(payload.oneTime).toBe(true);
  });

  it("allowedIps defaults to empty array", () => {
    const { payload } = generateShareToken("proj-1", "progress");
    expect(payload.allowedIps).toEqual([]);
  });

  it("allowedIps is stored in payload", () => {
    const { payload } = generateShareToken("proj-1", "progress", {
      allowedIps: ["192.168.1.0/24"],
    });
    expect(payload.allowedIps).toEqual(["192.168.1.0/24"]);
  });

  it("scope 'photos' is stored correctly", () => {
    const { payload } = generateShareToken("proj-X", "photos");
    expect(payload.scope).toBe("photos");
  });

  it("each call produces a unique tokenId", () => {
    const a = generateShareToken("proj-1", "all");
    const b = generateShareToken("proj-1", "all");
    expect(a.payload.tokenId).not.toBe(b.payload.tokenId);
  });
});

describe("verifyShareToken", () => {
  it("valid token returns ok=true with payload", () => {
    const { token } = generateShareToken("proj-1", "progress");
    const result = verifyShareToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.projectId).toBe("proj-1");
    }
  });

  it("expired token returns reason=expired", () => {
    const { token } = generateShareToken("proj-1", "progress", {
      ttlMinutes: -1,
    });
    const result = verifyShareToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("revoked token returns reason=revoked", () => {
    const { token, payload } = generateShareToken("proj-1", "progress");
    revoke(payload.tokenId, "テスト失効");
    const result = verifyShareToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("revoked");
  });

  it("redeemed one-time token returns reason=redeemed", () => {
    const { token, payload } = generateShareToken("proj-1", "all", {
      oneTime: true,
    });
    markRedeemed(payload.tokenId);
    const result = verifyShareToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("redeemed");
  });

  it("non-oneTime token can be used multiple times", () => {
    const { token, payload } = generateShareToken("proj-1", "all", {
      oneTime: false,
    });
    markRedeemed(payload.tokenId);
    const result = verifyShareToken(token);
    // oneTime=false なので redeemed でも ok
    expect(result.ok).toBe(true);
  });

  it("ip_blocked when IP not in allowedIps", () => {
    const { token } = generateShareToken("proj-1", "progress", {
      allowedIps: ["10.0.0.0/8"],
    });
    const result = verifyShareToken(token, "192.168.1.5");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("ip_blocked");
  });

  it("IP check passes when allowedIps is empty", () => {
    const { token } = generateShareToken("proj-1", "progress", {
      allowedIps: [],
    });
    const result = verifyShareToken(token, "192.168.1.5");
    expect(result.ok).toBe(true);
  });

  it("invalid token string returns reason=invalid", () => {
    const result = verifyShareToken("not-a-valid-token!!!");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid");
  });
});

// ── Sprint 66: createShareToken / verifySignedToken / hashPassword ────────────

describe("hashPassword", () => {
  it("returns a non-empty string", async () => {
    const h = await hashPassword("secret");
    expect(typeof h).toBe("string");
    expect(h.length).toBeGreaterThan(0);
  });

  it("same input always yields same hash", async () => {
    const h1 = await hashPassword("mypassword");
    const h2 = await hashPassword("mypassword");
    expect(h1).toBe(h2);
  });

  it("different inputs yield different hashes", async () => {
    const h1 = await hashPassword("abc");
    const h2 = await hashPassword("xyz");
    expect(h1).not.toBe(h2);
  });

  it("empty string produces a valid hash", async () => {
    const h = await hashPassword("");
    expect(typeof h).toBe("string");
    expect(h.length).toBeGreaterThan(0);
  });
});

describe("createShareToken (client wrapper -> /api/share-token)", () => {
  it("posts action=create with Authorization header when getAccessToken is provided", async () => {
    const token = await createShareToken("proj-A", {
      expiresInDays: 30,
      getAccessToken: async () => "valid-jwt",
      fetcher: fakeServerFetcher(),
    });
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it("throws when the server rejects for lack of Authorization (no getAccessToken given)", async () => {
    await expect(
      createShareToken("proj-noauth", { expiresInDays: 30, fetcher: fakeServerFetcher() }),
    ).rejects.toThrow();
  });

  it("throws when server responds non-ok (e.g. SHARE_TOKEN_SECRET unset)", async () => {
    const brokenFetcher: ShareTokenFetcher = async () =>
      new Response(JSON.stringify({ error: "SHARE_TOKEN_SECRET が設定されていません" }), {
        status: 500,
      });
    await expect(
      createShareToken("proj-B", {
        expiresInDays: 30,
        getAccessToken: async () => "valid-jwt",
        fetcher: brokenFetcher,
      }),
    ).rejects.toThrow(/SHARE_TOKEN_SECRET/);
  });

  it("embedded projectId round-trips via verifySignedToken through the same fake server", async () => {
    const shared = fakeServerFetcher();
    const token = await createShareToken("proj-roundtrip", {
      expiresInDays: 1,
      getAccessToken: async () => "valid-jwt",
      fetcher: shared,
    });
    const result = await verifySignedToken(token, undefined, { fetcher: shared });
    expect(result.valid).toBe(true);
    expect(result.projectId).toBe("proj-roundtrip");
  });
});

describe("verifySignedToken (client wrapper -> /api/share-token)", () => {
  it("valid no-password token returns valid=true and projectId (no auth needed for verify)", async () => {
    const shared = fakeServerFetcher();
    const token = createSignedShareToken("proj-B", { expiresInDays: 30 }, TEST_ENV);
    const result = await verifySignedToken(token, undefined, { fetcher: shared });
    expect(result.valid).toBe(true);
    expect(result.projectId).toBe("proj-B");
  });

  it("expired token returns valid=false and expired=true", async () => {
    const shared = fakeServerFetcher();
    const token = createSignedShareToken("proj-C", { expiresInDays: -1 }, TEST_ENV);
    const result = await verifySignedToken(token, undefined, { fetcher: shared });
    expect(result.valid).toBe(false);
    expect(result.expired).toBe(true);
  });

  it("tampered signature returns valid=false and tampered=true", async () => {
    const shared = fakeServerFetcher();
    const token = createSignedShareToken("proj-D", { expiresInDays: 7 }, TEST_ENV);
    const tampered = token.slice(0, -4) + "XXXX";
    const result = await verifySignedToken(tampered, undefined, { fetcher: shared });
    expect(result.valid).toBe(false);
    expect(result.tampered).toBe(true);
  });

  it("password-protected token: correct password validates, wrong password requires password", async () => {
    const shared = fakeServerFetcher();
    const token = createSignedShareToken(
      "proj-F",
      { expiresInDays: 30, password: "correct" },
      TEST_ENV,
    );
    const ok = await verifySignedToken(token, "correct", { fetcher: shared });
    expect(ok.valid).toBe(true);
    const wrong = await verifySignedToken(token, "wrong", { fetcher: shared });
    expect(wrong.valid).toBe(false);
    expect(wrong.requiresPassword).toBe(true);
  });

  it("fails closed (valid=false, tampered=true) when the server is unreachable", async () => {
    const throwingFetcher: ShareTokenFetcher = async () => {
      throw new Error("network down");
    };
    const result = await verifySignedToken("whatever.sig", undefined, {
      fetcher: throwingFetcher,
    });
    expect(result.valid).toBe(false);
    expect(result.tampered).toBe(true);
  });

  it("fails closed when the server returns a non-ok status (e.g. SHARE_TOKEN_SECRET unset -> 500)", async () => {
    const brokenFetcher: ShareTokenFetcher = async () =>
      new Response(JSON.stringify({ error: "SHARE_TOKEN_SECRET が設定されていません" }), {
        status: 500,
      });
    const result = await verifySignedToken("whatever.sig", undefined, {
      fetcher: brokenFetcher,
    });
    expect(result.valid).toBe(false);
    expect(result.tampered).toBe(true);
  });
});

describe("verifySignedShareToken (server, direct — sanity check that fail-closed decision holds even without env)", () => {
  it("throws rather than silently verifying with a fallback secret when unset", () => {
    expect(() => verifySignedShareToken("a.b", undefined, {})).toThrow();
  });
});
