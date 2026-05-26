import { describe, it, expect, beforeEach } from "vitest";
import { revokeShareToken } from "../lib/share-actions.js";
import { revokedTokens, getAuditLog, _resetForTest } from "../lib/share-token-store.js";

beforeEach(() => {
  _resetForTest();
});

describe("revokeShareToken", () => {
  it("adds tokenId to revokedTokens after revoke", () => {
    revokeShareToken("tok-abc123", "施主による手動無効化");
    expect(revokedTokens.has("tok-abc123")).toBe(true);
  });

  it("records revoke event in audit log", () => {
    revokeShareToken("tok-xyz", "URLが漏洩した可能性");
    const log = getAuditLog("unknown");
    const entry = log.find(
      (e) => e.event === "revoked" && e.tokenId === "tok-xyz",
    );
    expect(entry).toBeDefined();
    expect(entry?.reason).toBe("URLが漏洩した可能性");
  });

  it("throws when tokenId is empty", () => {
    expect(() => revokeShareToken("", "理由なし")).toThrow("tokenId is required");
  });

  it("multiple tokens can be revoked independently", () => {
    revokeShareToken("tok-1", "理由A");
    revokeShareToken("tok-2", "理由B");
    expect(revokedTokens.has("tok-1")).toBe(true);
    expect(revokedTokens.has("tok-2")).toBe(true);
    expect(revokedTokens.has("tok-3")).toBe(false);
  });
});
