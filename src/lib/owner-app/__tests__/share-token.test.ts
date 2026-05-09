/**
 * share-token.test.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateShareToken,
  listShareTokens,
  revokeShareToken,
  validateShareToken,
} from "../share-token.js";

const STORAGE_KEY = "genbahub:owner-tokens";

// jsdom では localStorage.clear が未実装のためモックする
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

beforeEach(() => {
  localStorage.clear();
  // Ensure crypto.getRandomValues works in jsdom
  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, "crypto", {
      value: {
        getRandomValues: (arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
          return arr;
        },
      },
    });
  }
});

afterEach(() => {
  localStorage.clear();
});

describe("generateShareToken", () => {
  it("returns a non-empty token string", () => {
    const token = generateShareToken("proj-1");
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);
  });

  it("persists token to localStorage", () => {
    generateShareToken("proj-2");
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!);
    expect(stored).toHaveLength(1);
    expect(stored[0].projectId).toBe("proj-2");
  });

  it("uses default 30-day expiry", () => {
    const before = Date.now();
    generateShareToken("proj-3");
    const after = Date.now();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    const exp = stored[0].expiresAt as number;
    expect(exp).toBeGreaterThanOrEqual(before + 30 * 24 * 60 * 60 * 1000 - 100);
    expect(exp).toBeLessThanOrEqual(after + 30 * 24 * 60 * 60 * 1000 + 100);
  });

  it("supports custom expiry days", () => {
    const before = Date.now();
    generateShareToken("proj-4", 7);
    const after = Date.now();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    const exp = stored[0].expiresAt as number;
    expect(exp).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 * 1000 - 100);
    expect(exp).toBeLessThanOrEqual(after + 7 * 24 * 60 * 60 * 1000 + 100);
  });

  it("generates unique tokens each call", () => {
    const t1 = generateShareToken("proj-5");
    const t2 = generateShareToken("proj-5");
    expect(t1).not.toBe(t2);
  });
});

describe("validateShareToken", () => {
  it("returns OwnerSession for a valid token", () => {
    const token = generateShareToken("proj-A");
    const session = validateShareToken(token);
    expect(session).not.toBeNull();
    expect(session?.projectId).toBe("proj-A");
    expect(session?.token).toBe(token);
  });

  it("returns null for unknown token", () => {
    expect(validateShareToken("unknown-token")).toBeNull();
  });

  it("returns null for expired token", () => {
    const token = generateShareToken("proj-B", -1); // already expired
    expect(validateShareToken(token)).toBeNull();
  });

  it("returns null after revokeShareToken", () => {
    const token = generateShareToken("proj-C");
    revokeShareToken(token);
    expect(validateShareToken(token)).toBeNull();
  });

  it("includes expiresAt in returned session", () => {
    const token = generateShareToken("proj-D");
    const session = validateShareToken(token);
    expect(typeof session?.expiresAt).toBe("number");
    expect(session!.expiresAt).toBeGreaterThan(Date.now());
  });
});

describe("revokeShareToken", () => {
  it("marks token as revoked in storage", () => {
    const token = generateShareToken("proj-E");
    revokeShareToken(token);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored[0].revoked).toBe(true);
  });

  it("is idempotent — revoking twice does not throw", () => {
    const token = generateShareToken("proj-F");
    expect(() => {
      revokeShareToken(token);
      revokeShareToken(token);
    }).not.toThrow();
  });

  it("revoking non-existent token does not throw", () => {
    expect(() => revokeShareToken("does-not-exist")).not.toThrow();
  });
});

describe("listShareTokens", () => {
  it("returns empty array for project with no tokens", () => {
    expect(listShareTokens("empty-project")).toEqual([]);
  });

  it("returns tokens for the given project", () => {
    generateShareToken("proj-G");
    generateShareToken("proj-G");
    generateShareToken("other-proj");
    const tokens = listShareTokens("proj-G");
    expect(tokens).toHaveLength(2);
    expect(tokens.every((t) => !t.revoked)).toBe(true);
  });

  it("reflects revoked status", () => {
    const token = generateShareToken("proj-H");
    revokeShareToken(token);
    const tokens = listShareTokens("proj-H");
    expect(tokens[0].revoked).toBe(true);
  });
});
