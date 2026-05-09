import { describe, it, expect, beforeEach } from "vitest";
import { generateShareToken, verifyShareToken } from "../lib/share-token.js";
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
