import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { generateShareToken, verifyShareToken, createShareToken, verifySignedToken, hashPassword } from "../lib/share-token.js";
import { _resetForTest, revoke, markRedeemed } from "../lib/share-token-store.js";

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

describe("createShareToken", () => {
  it("returns a dot-separated token string", async () => {
    const token = await createShareToken("proj-A", { expiresInDays: 30 });
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it("two calls for same project produce different tokens (timestamp differs)", async () => {
    const t1 = await createShareToken("proj-A", { expiresInDays: 7 });
    await new Promise((r) => setTimeout(r, 2));
    const t2 = await createShareToken("proj-A", { expiresInDays: 7 });
    expect(t1).not.toBe(t2);
  });

  it("embedded projectId round-trips via verifySignedToken", async () => {
    const token = await createShareToken("proj-roundtrip", { expiresInDays: 1 });
    const result = await verifySignedToken(token);
    expect(result.valid).toBe(true);
    expect(result.projectId).toBe("proj-roundtrip");
  });

  it("expiresInDays=7 sets expiry within expected range", async () => {
    const before = Date.now();
    const token = await createShareToken("proj-exp", { expiresInDays: 7 });
    const after = Date.now();
    // Decode claims part to check expiresAt
    const claimsB64 = token.split(".")[0];
    const json = atob(claimsB64.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as { expiresAt: number };
    const expected7d = 7 * 24 * 60 * 60 * 1000;
    expect(claims.expiresAt).toBeGreaterThanOrEqual(before + expected7d - 100);
    expect(claims.expiresAt).toBeLessThanOrEqual(after + expected7d + 100);
  });

  it("token with password embeds passwordHash in claims", async () => {
    const token = await createShareToken("proj-pw", { expiresInDays: 30, password: "s3cr3t" });
    const claimsB64 = token.split(".")[0];
    const json = atob(claimsB64.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as { passwordHash?: string };
    expect(typeof claims.passwordHash).toBe("string");
    expect(claims.passwordHash!.length).toBeGreaterThan(0);
  });

  it("token without password has no passwordHash in claims", async () => {
    const token = await createShareToken("proj-nopw", { expiresInDays: 30 });
    const claimsB64 = token.split(".")[0];
    const json = atob(claimsB64.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as { passwordHash?: string };
    expect(claims.passwordHash).toBeUndefined();
  });
});

describe("verifySignedToken", () => {
  it("valid no-password token returns valid=true and projectId", async () => {
    const token = await createShareToken("proj-B", { expiresInDays: 30 });
    const result = await verifySignedToken(token);
    expect(result.valid).toBe(true);
    expect(result.projectId).toBe("proj-B");
  });

  it("expired token returns valid=false and expired=true", async () => {
    const token = await createShareToken("proj-C", { expiresInDays: -1 });
    const result = await verifySignedToken(token);
    expect(result.valid).toBe(false);
    expect(result.expired).toBe(true);
  });

  it("expired token returns projectId even when invalid", async () => {
    const token = await createShareToken("proj-expid", { expiresInDays: -1 });
    const result = await verifySignedToken(token);
    expect(result.projectId).toBe("proj-expid");
  });

  it("tampered signature returns valid=false and tampered=true", async () => {
    const token = await createShareToken("proj-D", { expiresInDays: 7 });
    const tampered = token.slice(0, -4) + "XXXX";
    const result = await verifySignedToken(tampered);
    expect(result.valid).toBe(false);
    expect(result.tampered).toBe(true);
  });

  it("completely garbled token returns tampered=true", async () => {
    const result = await verifySignedToken("garbage-token-no-dot-separator");
    expect(result.valid).toBe(false);
    expect(result.tampered).toBe(true);
  });

  it("password-protected token without password returns requiresPassword=true", async () => {
    const token = await createShareToken("proj-E", { expiresInDays: 30, password: "pw123" });
    const result = await verifySignedToken(token);
    expect(result.valid).toBe(false);
    expect(result.requiresPassword).toBe(true);
  });

  it("password-protected token with correct password returns valid=true", async () => {
    const token = await createShareToken("proj-F", { expiresInDays: 30, password: "correct" });
    const result = await verifySignedToken(token, "correct");
    expect(result.valid).toBe(true);
    expect(result.projectId).toBe("proj-F");
  });

  it("password-protected token with wrong password returns requiresPassword=true", async () => {
    const token = await createShareToken("proj-G", { expiresInDays: 30, password: "right" });
    const result = await verifySignedToken(token, "wrong");
    expect(result.valid).toBe(false);
    expect(result.requiresPassword).toBe(true);
  });

  it("password-protected token with empty string password returns requiresPassword=true", async () => {
    const token = await createShareToken("proj-H", { expiresInDays: 30, password: "secret" });
    const result = await verifySignedToken(token, "");
    expect(result.valid).toBe(false);
    expect(result.requiresPassword).toBe(true);
  });

  it("Date.now mock: token valid just before expiry", async () => {
    const token = await createShareToken("proj-I", { expiresInDays: 1 });
    // Mock Date.now to 1 ms before expiry
    const claimsB64 = token.split(".")[0];
    const claims = JSON.parse(atob(claimsB64.replace(/-/g, "+").replace(/_/g, "/"))) as { expiresAt: number };
    vi.spyOn(Date, "now").mockReturnValue(claims.expiresAt - 1);
    const result = await verifySignedToken(token);
    vi.restoreAllMocks();
    expect(result.valid).toBe(true);
  });

  it("Date.now mock: token expired 1 ms after expiry", async () => {
    const token = await createShareToken("proj-J", { expiresInDays: 1 });
    const claimsB64 = token.split(".")[0];
    const claims = JSON.parse(atob(claimsB64.replace(/-/g, "+").replace(/_/g, "/"))) as { expiresAt: number };
    vi.spyOn(Date, "now").mockReturnValue(claims.expiresAt + 1);
    const result = await verifySignedToken(token);
    vi.restoreAllMocks();
    expect(result.valid).toBe(false);
    expect(result.expired).toBe(true);
  });

  it("modifying claims payload invalidates signature", async () => {
    const token = await createShareToken("proj-K", { expiresInDays: 30 });
    const [claimsB64, sig] = token.split(".");
    const claims = JSON.parse(atob(claimsB64.replace(/-/g, "+").replace(/_/g, "/"))) as { projectId: string; issuedAt: number; expiresAt: number };
    // Extend expiry by 1 day
    claims.expiresAt += 24 * 60 * 60 * 1000;
    const newPayload = btoa(JSON.stringify(claims)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const tampered = `${newPayload}.${sig}`;
    const result = await verifySignedToken(tampered);
    expect(result.valid).toBe(false);
    expect(result.tampered).toBe(true);
  });
});
