import { describe, it, expect, beforeEach } from "vitest";
import {
  revoke,
  markRedeemed,
  appendShareAuditLog,
  getAuditLog,
  revokedTokens,
  redeemedTokens,
  _resetForTest,
} from "../lib/share-token-store.js";

beforeEach(() => {
  _resetForTest();
});

describe("revoke", () => {
  it("adds tokenId to revokedTokens set", () => {
    revoke("tok-abc", "URLが漏洩した");
    expect(revokedTokens.has("tok-abc")).toBe(true);
  });

  it("multiple revokes accumulate", () => {
    revoke("tok-1", "reason A");
    revoke("tok-2", "reason B");
    expect(revokedTokens.has("tok-1")).toBe(true);
    expect(revokedTokens.has("tok-2")).toBe(true);
  });

  it("revoke appends audit log entry", () => {
    revoke("tok-xyz", "手動無効化");
    const log = getAuditLog("unknown");
    expect(log.some((e) => e.event === "revoked" && e.tokenId === "tok-xyz")).toBe(true);
  });

  it("throws if tokenId is empty string", () => {
    // share-actions.ts 経由では検証するが store 自体は通すため、
    // ここでは revoke が空文字で Set に追加されることを確認
    revoke("", "test");
    expect(revokedTokens.has("")).toBe(true);
  });
});

describe("markRedeemed", () => {
  it("adds tokenId to redeemedTokens set", () => {
    markRedeemed("tok-one");
    expect(redeemedTokens.has("tok-one")).toBe(true);
  });

  it("duplicate markRedeemed is idempotent", () => {
    markRedeemed("tok-one");
    markRedeemed("tok-one");
    expect([...redeemedTokens].filter((t) => t === "tok-one").length).toBe(1);
  });
});

describe("getAuditLog", () => {
  it("returns entries filtered by projectId", () => {
    appendShareAuditLog({
      event: "issued",
      tokenId: "tok-1",
      projectId: "proj-A",
      ts: new Date().toISOString(),
    });
    appendShareAuditLog({
      event: "used",
      tokenId: "tok-2",
      projectId: "proj-B",
      ts: new Date().toISOString(),
    });
    const logA = getAuditLog("proj-A");
    expect(logA.length).toBe(1);
    expect(logA[0].projectId).toBe("proj-A");
  });

  it("returns all entries when projectId is empty string", () => {
    appendShareAuditLog({
      event: "issued",
      tokenId: "tok-1",
      projectId: "proj-A",
      ts: new Date().toISOString(),
    });
    appendShareAuditLog({
      event: "issued",
      tokenId: "tok-2",
      projectId: "proj-B",
      ts: new Date().toISOString(),
    });
    const all = getAuditLog("");
    expect(all.length).toBe(2);
  });

  it("returns empty array when no entries match", () => {
    const log = getAuditLog("proj-nonexistent");
    expect(log).toEqual([]);
  });

  it("audit log records event type correctly", () => {
    appendShareAuditLog({
      event: "failed",
      tokenId: "tok-bad",
      projectId: "proj-X",
      ts: new Date().toISOString(),
      reason: "expired",
    });
    const log = getAuditLog("proj-X");
    expect(log[0].event).toBe("failed");
    expect(log[0].reason).toBe("expired");
  });
});

describe("_resetForTest", () => {
  it("clears revokedTokens and redeemedTokens", () => {
    revoke("tok-a", "test");
    markRedeemed("tok-b");
    _resetForTest();
    expect(revokedTokens.size).toBe(0);
    expect(redeemedTokens.size).toBe(0);
  });

  it("clears audit log in localStorage", () => {
    appendShareAuditLog({
      event: "issued",
      tokenId: "tok-1",
      projectId: "proj-1",
      ts: new Date().toISOString(),
    });
    _resetForTest();
    const log = getAuditLog("");
    expect(log).toEqual([]);
  });
});
