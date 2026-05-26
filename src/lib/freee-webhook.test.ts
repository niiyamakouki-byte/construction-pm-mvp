import { describe, it, expect, vi } from "vitest";
import {
  tokensMatch,
  formatDiscordContent,
  postToDiscord,
  type FreeePayload,
} from "./freee-webhook.js";

describe("tokensMatch", () => {
  it("returns true for identical tokens", () => {
    expect(tokensMatch("abc123xyz", "abc123xyz")).toBe(true);
  });

  it("returns false for mismatched tokens", () => {
    expect(tokensMatch("abc", "xyz")).toBe(false);
  });

  it("returns false for different-length tokens", () => {
    expect(tokensMatch("abc", "abcd")).toBe(false);
  });

  it("returns false for empty received token", () => {
    expect(tokensMatch("", "expected")).toBe(false);
  });

  it("returns false for empty expected token", () => {
    expect(tokensMatch("received", "")).toBe(false);
  });
});

describe("formatDiscordContent", () => {
  it("formats wallet_txn deposit (positive amount) as 入金", () => {
    const payload: FreeePayload = {
      resource: "accounting:wallet_txn",
      action: "created",
      created_at: "2026-05-11T12:00:00Z",
      wallet_txn: { amount: 100000, date: "2026-05-11", description: "テスト入金" },
    };
    const content = formatDiscordContent(payload);
    expect(content).toContain("wallet_txn");
    expect(content).toContain("created");
    expect(content).toContain("🟢 入金");
    expect(content).toContain("¥100,000");
    expect(content).toContain("テスト入金");
    expect(content).toContain("2026-05-11");
  });

  it("formats wallet_txn withdrawal (negative amount) as 出金", () => {
    const payload: FreeePayload = {
      resource: "accounting:wallet_txn",
      action: "created",
      wallet_txn: { amount: -3000, date: "2026-05-11" },
    };
    const content = formatDiscordContent(payload);
    expect(content).toContain("🔴 出金");
    expect(content).toContain("¥-3,000");
  });

  it("formats deal payload", () => {
    const payload: FreeePayload = {
      resource: "accounting:deal",
      action: "created",
      deal: { amount: 540000, issue_date: "2026-05-11", type: "income" },
    };
    const content = formatDiscordContent(payload);
    expect(content).toContain("💴 ¥540,000");
    expect(content).toContain("(income)");
    expect(content).toContain("2026-05-11");
  });

  it("handles empty payload with placeholders", () => {
    const content = formatDiscordContent({});
    expect(content).toContain("unknown");
    expect(content).toContain("freee 通知");
  });

  it("skips wallet_txn block when amount missing", () => {
    const payload: FreeePayload = {
      resource: "accounting:wallet_txn",
      action: "created",
      wallet_txn: { description: "no amount" },
    };
    const content = formatDiscordContent(payload);
    expect(content).not.toContain("🟢");
    expect(content).not.toContain("🔴");
    expect(content).toContain("no amount");
  });
});

describe("postToDiscord", () => {
  it("POSTs JSON body to given url", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => "" }) as Response);
    await postToDiscord("https://discord.example/webhook", "hello", fetchMock as unknown as typeof fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://discord.example/webhook");
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as { body: string }).body) as { content: string };
    expect(body.content).toBe("hello");
  });

  it("logs error on non-2xx response without throwing", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => "server error",
    }) as Response);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      postToDiscord("https://x", "y", fetchMock as unknown as typeof fetch),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
