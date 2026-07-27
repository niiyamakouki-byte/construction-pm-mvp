import { describe, it, expect } from "vitest";
import {
  createSignedShareToken,
  verifySignedShareToken,
  hashPasswordServer,
  handleShareTokenRequest,
  ShareTokenSecretMissingError,
  type ShareTokenRequest,
  type ShareTokenResponse,
} from "../share-token-handler.js";
import type { SupabaseAuthVerifier } from "../auth-helper.js";

const TEST_ENV: NodeJS.ProcessEnv = { SHARE_TOKEN_SECRET: "test-secret-do-not-use-in-prod" };

describe("hashPasswordServer", () => {
  it("returns a non-empty string", () => {
    const h = hashPasswordServer("secret");
    expect(typeof h).toBe("string");
    expect(h.length).toBeGreaterThan(0);
  });

  it("same input always yields same hash", () => {
    expect(hashPasswordServer("mypassword")).toBe(hashPasswordServer("mypassword"));
  });

  it("different inputs yield different hashes", () => {
    expect(hashPasswordServer("abc")).not.toBe(hashPasswordServer("xyz"));
  });
});

describe("createSignedShareToken", () => {
  it("throws ShareTokenSecretMissingError when SHARE_TOKEN_SECRET is unset", () => {
    expect(() =>
      createSignedShareToken("proj-1", { expiresInDays: 30 }, {}),
    ).toThrow(ShareTokenSecretMissingError);
  });

  it("throws when SHARE_TOKEN_SECRET is an empty string", () => {
    expect(() =>
      createSignedShareToken("proj-1", { expiresInDays: 30 }, { SHARE_TOKEN_SECRET: "" }),
    ).toThrow(ShareTokenSecretMissingError);
  });

  it("returns a dot-separated token string", () => {
    const token = createSignedShareToken("proj-A", { expiresInDays: 30 }, TEST_ENV);
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it("token with password embeds passwordHash in claims", () => {
    const token = createSignedShareToken(
      "proj-pw",
      { expiresInDays: 30, password: "s3cr3t" },
      TEST_ENV,
    );
    const claimsB64 = token.split(".")[0];
    const claims = JSON.parse(
      Buffer.from(claimsB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { passwordHash?: string };
    expect(typeof claims.passwordHash).toBe("string");
    expect(claims.passwordHash!.length).toBeGreaterThan(0);
  });

  it("token without password has no passwordHash in claims", () => {
    const token = createSignedShareToken("proj-nopw", { expiresInDays: 30 }, TEST_ENV);
    const claimsB64 = token.split(".")[0];
    const claims = JSON.parse(
      Buffer.from(claimsB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { passwordHash?: string };
    expect(claims.passwordHash).toBeUndefined();
  });
});

describe("verifySignedShareToken", () => {
  it("throws ShareTokenSecretMissingError when SHARE_TOKEN_SECRET is unset", () => {
    expect(() => verifySignedShareToken("a.b", undefined, {})).toThrow(
      ShareTokenSecretMissingError,
    );
  });

  it("valid no-password token returns valid=true and projectId", () => {
    const token = createSignedShareToken("proj-B", { expiresInDays: 30 }, TEST_ENV);
    const result = verifySignedShareToken(token, undefined, TEST_ENV);
    expect(result.valid).toBe(true);
    expect(result.projectId).toBe("proj-B");
  });

  it("expired token returns valid=false and expired=true", () => {
    const token = createSignedShareToken("proj-C", { expiresInDays: -1 }, TEST_ENV);
    const result = verifySignedShareToken(token, undefined, TEST_ENV);
    expect(result.valid).toBe(false);
    expect(result.expired).toBe(true);
    expect(result.projectId).toBe("proj-C");
  });

  it("tampered signature returns valid=false and tampered=true", () => {
    const token = createSignedShareToken("proj-D", { expiresInDays: 7 }, TEST_ENV);
    const tampered = token.slice(0, -4) + "XXXX";
    const result = verifySignedShareToken(tampered, undefined, TEST_ENV);
    expect(result.valid).toBe(false);
    expect(result.tampered).toBe(true);
  });

  it("completely garbled token returns tampered=true", () => {
    const result = verifySignedShareToken("garbage-token-no-dot-separator", undefined, TEST_ENV);
    expect(result.valid).toBe(false);
    expect(result.tampered).toBe(true);
  });

  it("token signed with a different secret is rejected (a stale/leaked secret cannot forge tokens for the new one)", () => {
    const token = createSignedShareToken(
      "proj-rotate",
      { expiresInDays: 30 },
      { SHARE_TOKEN_SECRET: "old-secret" },
    );
    const result = verifySignedShareToken(token, undefined, { SHARE_TOKEN_SECRET: "new-secret" });
    expect(result.valid).toBe(false);
    expect(result.tampered).toBe(true);
  });

  it("password-protected token without password returns requiresPassword=true", () => {
    const token = createSignedShareToken(
      "proj-E",
      { expiresInDays: 30, password: "pw123" },
      TEST_ENV,
    );
    const result = verifySignedShareToken(token, undefined, TEST_ENV);
    expect(result.valid).toBe(false);
    expect(result.requiresPassword).toBe(true);
  });

  it("password-protected token with correct password returns valid=true", () => {
    const token = createSignedShareToken(
      "proj-F",
      { expiresInDays: 30, password: "correct" },
      TEST_ENV,
    );
    const result = verifySignedShareToken(token, "correct", TEST_ENV);
    expect(result.valid).toBe(true);
    expect(result.projectId).toBe("proj-F");
  });

  it("password-protected token with wrong password returns requiresPassword=true", () => {
    const token = createSignedShareToken(
      "proj-G",
      { expiresInDays: 30, password: "right" },
      TEST_ENV,
    );
    const result = verifySignedShareToken(token, "wrong", TEST_ENV);
    expect(result.valid).toBe(false);
    expect(result.requiresPassword).toBe(true);
  });

  it("modifying claims payload invalidates signature", () => {
    const token = createSignedShareToken("proj-K", { expiresInDays: 30 }, TEST_ENV);
    const [claimsB64, sig] = token.split(".");
    const claims = JSON.parse(
      Buffer.from(claimsB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { projectId: string; issuedAt: number; expiresAt: number };
    claims.expiresAt += 24 * 60 * 60 * 1000;
    const newPayload = Buffer.from(JSON.stringify(claims), "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const tampered = `${newPayload}.${sig}`;
    const result = verifySignedShareToken(tampered, undefined, TEST_ENV);
    expect(result.valid).toBe(false);
    expect(result.tampered).toBe(true);
  });
});

// ── handleShareTokenRequest (Vercel handler) ─────────────────────────────────

function makeRes(): ShareTokenResponse & { _status?: number; _body?: unknown } {
  const res: ShareTokenResponse & { _status?: number; _body?: unknown } = {
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: unknown) {
      res._body = body;
      return res;
    },
    setHeader() {
      /* noop */
    },
  };
  return res;
}

const okAuth: SupabaseAuthVerifier = {
  getUser: async (token: string) =>
    token === "valid-jwt"
      ? { data: { user: { id: "user-1", email: "pm@example.com" } }, error: null }
      : { data: { user: null }, error: { message: "invalid token" } },
};

describe("handleShareTokenRequest", () => {
  it("rejects non-POST with 405", async () => {
    const req: ShareTokenRequest = { method: "GET" };
    const res = makeRes();
    await handleShareTokenRequest(req, res, { auth: okAuth, env: TEST_ENV });
    expect(res._status).toBe(405);
  });

  it("action=create without Authorization header returns 401", async () => {
    const req: ShareTokenRequest = {
      method: "POST",
      headers: {},
      body: { action: "create", projectId: "proj-1", expiresInDays: 30 },
    };
    const res = makeRes();
    await handleShareTokenRequest(req, res, { auth: okAuth, env: TEST_ENV });
    expect(res._status).toBe(401);
  });

  it("action=create with valid bearer token issues a token", async () => {
    const req: ShareTokenRequest = {
      method: "POST",
      headers: { authorization: "Bearer valid-jwt" },
      body: { action: "create", projectId: "proj-1", expiresInDays: 30 },
    };
    const res = makeRes();
    await handleShareTokenRequest(req, res, { auth: okAuth, env: TEST_ENV });
    expect(res._status).toBe(200);
    expect(typeof (res._body as { token?: string }).token).toBe("string");
  });

  it("action=create with SHARE_TOKEN_SECRET unset returns 500 (fails closed, no weak fallback)", async () => {
    const req: ShareTokenRequest = {
      method: "POST",
      headers: { authorization: "Bearer valid-jwt" },
      body: { action: "create", projectId: "proj-1", expiresInDays: 30 },
    };
    const res = makeRes();
    await handleShareTokenRequest(req, res, { auth: okAuth, env: {} });
    expect(res._status).toBe(500);
  });

  it("action=verify requires no Authorization header", async () => {
    const created = createSignedShareToken("proj-2", { expiresInDays: 30 }, TEST_ENV);
    const req: ShareTokenRequest = {
      method: "POST",
      headers: {},
      body: { action: "verify", token: created },
    };
    const res = makeRes();
    await handleShareTokenRequest(req, res, { auth: okAuth, env: TEST_ENV });
    expect(res._status).toBe(200);
    expect((res._body as { valid: boolean }).valid).toBe(true);
  });

  it("action=verify with SHARE_TOKEN_SECRET unset returns 500, not a silently-passing result", async () => {
    const req: ShareTokenRequest = {
      method: "POST",
      headers: {},
      body: { action: "verify", token: "whatever.sig" },
    };
    const res = makeRes();
    await handleShareTokenRequest(req, res, { auth: okAuth, env: {} });
    expect(res._status).toBe(500);
  });

  it("unknown action returns 400", async () => {
    const req: ShareTokenRequest = {
      method: "POST",
      headers: {},
      body: { action: "bogus" },
    };
    const res = makeRes();
    await handleShareTokenRequest(req, res, { auth: okAuth, env: TEST_ENV });
    expect(res._status).toBe(400);
  });
});
