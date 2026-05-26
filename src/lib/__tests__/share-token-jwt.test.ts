/**
 * share-token-jwt.test.ts
 * JWT share-token: 生成→検証 round-trip、期限切れ、パスワード一致/不一致、署名改ざん検出
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateJwtShareToken,
  hashPassword,
  jwtTokenRequiresPassword,
  verifyJwtShareToken,
} from "../share-token-jwt.js";

// ── localStorage mock ─────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

beforeEach(() => {
  localStorage.clear();
});

// ── hashPassword ──────────────────────────────────────────────────────────────

describe("hashPassword", () => {
  it("returns 64-char hex string", async () => {
    const h = await hashPassword("secret");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", async () => {
    const h1 = await hashPassword("abc");
    const h2 = await hashPassword("abc");
    expect(h1).toBe(h2);
  });

  it("differs for different passwords", async () => {
    const h1 = await hashPassword("abc");
    const h2 = await hashPassword("xyz");
    expect(h1).not.toBe(h2);
  });
});

// ── generateJwtShareToken ─────────────────────────────────────────────────────

describe("generateJwtShareToken", () => {
  it("returns a 3-part JWT string", async () => {
    const token = await generateJwtShareToken("proj-1");
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
  });

  it("payload contains correct projectId", async () => {
    const token = await generateJwtShareToken("proj-abc");
    const payloadJson = atob(
      token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"),
    );
    const payload = JSON.parse(payloadJson) as { sub: string };
    expect(payload.sub).toBe("proj-abc");
  });

  it("sets exp in the future", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const token = await generateJwtShareToken("proj-2");
    const payloadJson = atob(
      token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"),
    );
    const payload = JSON.parse(payloadJson) as { exp: number };
    expect(payload.exp).toBeGreaterThan(nowSec);
  });

  it("includes pwd hash when password is provided", async () => {
    const token = await generateJwtShareToken("proj-3", { password: "pass123" });
    const payloadJson = atob(
      token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"),
    );
    const payload = JSON.parse(payloadJson) as { pwd?: string };
    expect(typeof payload.pwd).toBe("string");
    expect(payload.pwd).toHaveLength(64);
  });

  it("omits pwd when no password is provided", async () => {
    const token = await generateJwtShareToken("proj-4");
    const payloadJson = atob(
      token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"),
    );
    const payload = JSON.parse(payloadJson) as { pwd?: string };
    expect(payload.pwd).toBeUndefined();
  });
});

// ── verifyJwtShareToken — round-trip ─────────────────────────────────────────

describe("verifyJwtShareToken — round-trip", () => {
  it("returns ok=true for a valid token without password", async () => {
    const token = await generateJwtShareToken("proj-rt1");
    const result = await verifyJwtShareToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.sub).toBe("proj-rt1");
    }
  });

  it("returns ok=true for a valid token with correct password", async () => {
    const token = await generateJwtShareToken("proj-rt2", { password: "mypassword" });
    const result = await verifyJwtShareToken(token, "mypassword");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.sub).toBe("proj-rt2");
    }
  });

  it("different projects produce different tokens", async () => {
    const t1 = await generateJwtShareToken("proj-x");
    const t2 = await generateJwtShareToken("proj-y");
    expect(t1).not.toBe(t2);
  });
});

// ── verifyJwtShareToken — expiry ──────────────────────────────────────────────

describe("verifyJwtShareToken — expiry", () => {
  it("returns expired for a token with past exp", async () => {
    // ttlMinutes = -1 → already expired
    const token = await generateJwtShareToken("proj-exp", { ttlMinutes: -1 });
    const result = await verifyJwtShareToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("expired");
    }
  });

  it("is valid just before expiry", async () => {
    // ttlMinutes = 1 → still valid
    const token = await generateJwtShareToken("proj-exp2", { ttlMinutes: 1 });
    const result = await verifyJwtShareToken(token);
    expect(result.ok).toBe(true);
  });
});

// ── verifyJwtShareToken — password ───────────────────────────────────────────

describe("verifyJwtShareToken — password", () => {
  it("returns password_required when pwd is set but no password given", async () => {
    const token = await generateJwtShareToken("proj-pw1", { password: "secret" });
    const result = await verifyJwtShareToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("password_required");
    }
  });

  it("returns password_mismatch for wrong password", async () => {
    const token = await generateJwtShareToken("proj-pw2", { password: "correct" });
    const result = await verifyJwtShareToken(token, "wrong");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("password_mismatch");
    }
  });

  it("returns ok=true for correct password", async () => {
    const token = await generateJwtShareToken("proj-pw3", { password: "rightpass" });
    const result = await verifyJwtShareToken(token, "rightpass");
    expect(result.ok).toBe(true);
  });
});

// ── verifyJwtShareToken — signature tampering ─────────────────────────────────

describe("verifyJwtShareToken — signature tampering", () => {
  it("detects tampered payload", async () => {
    const token = await generateJwtShareToken("proj-tamper1");
    const [header, , sig] = token.split(".");
    // Replace payload with a different project
    const fakePayload = btoa(JSON.stringify({ sub: "evil-proj", iat: 0, exp: 9999999999 }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const tampered = `${header}.${fakePayload}.${sig}`;
    const result = await verifyJwtShareToken(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_signature");
    }
  });

  it("detects tampered signature", async () => {
    const token = await generateJwtShareToken("proj-tamper2");
    const [header, payload] = token.split(".");
    const tamperedSig = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const tampered = `${header}.${payload}.${tamperedSig}`;
    const result = await verifyJwtShareToken(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_signature");
    }
  });

  it("returns malformed for non-JWT string", async () => {
    const result = await verifyJwtShareToken("not-a-jwt");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("malformed");
    }
  });

  it("returns malformed for 2-part string", async () => {
    const result = await verifyJwtShareToken("header.payload");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("malformed");
    }
  });
});

// ── jwtTokenRequiresPassword ──────────────────────────────────────────────────

describe("jwtTokenRequiresPassword", () => {
  it("returns false for token without password", async () => {
    const token = await generateJwtShareToken("proj-np");
    expect(jwtTokenRequiresPassword(token)).toBe(false);
  });

  it("returns true for token with password", async () => {
    const token = await generateJwtShareToken("proj-wpass", { password: "pw" });
    expect(jwtTokenRequiresPassword(token)).toBe(true);
  });

  it("returns false for malformed token", () => {
    expect(jwtTokenRequiresPassword("not.a.real.jwt.with.too.many.dots")).toBe(false);
  });
});
