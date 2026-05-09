import { describe, it, expect, vi } from "vitest";
import { submitJournal } from "../lib/freee-api-client.js";
import type { FreeeJournalDraft } from "../lib/freee-journal-mapper.js";

// ── テストヘルパー ─────────────────────────────────────

function makeDraft(overrides: Partial<FreeeJournalDraft> = {}): FreeeJournalDraft {
  return {
    issue_date: "2025-04-15",
    amount: 500,
    account_item: "旅費交通費",
    tax_code: 10,
    partner_name: "JR東日本",
    description: "JR東日本",
    needs_review: false,
    ...overrides,
  };
}

// ── dry-run モード ─────────────────────────────────────

describe("submitJournal — dry-run モード", () => {
  it("access_token 未設定時は ok:true, mode:dry_run を返す", async () => {
    const result = await submitJournal(makeDraft(), {});
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("dry_run");
    expect(result.deal_id).toBeUndefined();
  });

  it("client_id があっても access_token がなければ dry-run", async () => {
    const result = await submitJournal(makeDraft(), { client_id: "abc123" });
    expect(result.mode).toBe("dry_run");
  });
});

// ── live モード ────────────────────────────────────────

describe("submitJournal — live モード", () => {
  it("成功時 (200) は ok:true, mode:live, deal_id を返す", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ deal: { id: 42 } }),
    } as unknown as Response);

    const result = await submitJournal(
      makeDraft(),
      { access_token: "test-token" },
      mockFetch,
    );

    expect(result.ok).toBe(true);
    expect(result.mode).toBe("live");
    expect(result.deal_id).toBe(42);
  });

  it("401 エラー時は日本語エラーメッセージを返す", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    } as unknown as Response);

    const result = await submitJournal(
      makeDraft(),
      { access_token: "bad-token" },
      mockFetch,
    );

    expect(result.ok).toBe(false);
    expect(result.mode).toBe("live");
    expect(result.error).toContain("認証エラー");
  });

  it("403 エラー時は権限エラーメッセージ", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    } as unknown as Response);

    const result = await submitJournal(
      makeDraft(),
      { access_token: "test-token" },
      mockFetch,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("権限エラー");
  });

  it("422 エラー時はバリデーションエラーメッセージ", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "validation failed",
    } as unknown as Response);

    const result = await submitJournal(
      makeDraft(),
      { access_token: "test-token" },
      mockFetch,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("バリデーション");
  });

  it("ネットワークエラー時はネットワークエラーメッセージ", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

    const result = await submitJournal(
      makeDraft(),
      { access_token: "test-token" },
      mockFetch,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("ネットワークエラー");
  });
});
