/* @vitest-environment node */

/**
 * inquiry-repository テスト — service role insert
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContactSubmission } from "./contact-webhook-receiver.js";
import type { EstimateRange } from "../estimate-assistant/cost-lookup.js";

const insertMock = vi.fn();
const fromMock = vi.fn(() => ({ insert: insertMock }));
const createClient = vi.fn(() => ({ from: fromMock }));

vi.mock("@supabase/supabase-js", () => ({
  createClient,
}));

const submission: ContactSubmission = {
  id: "inquiry-1",
  name: "新山光輝",
  email: "test@laporta.co.jp",
  message: "LDK リフォームの相談",
  source: "laporta-hp",
  timestamp: "2026-09-04T10:00:00.000Z",
};

const estimate: EstimateRange = {
  items: [],
  totalLow: 100000,
  totalMid: 120000,
  totalHigh: 150000,
  taxIncludedLow: 110000,
  taxIncludedMid: 132000,
  taxIncludedHigh: 165000,
};

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  createClient.mockClear();
  fromMock.mockClear();
  insertMock.mockReset();
  insertMock.mockResolvedValue({ error: null });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("insertInquiryRecord", () => {
  it("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 未設定なら何もしない", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { insertInquiryRecord } = await import("./inquiry-repository.js");
    await insertInquiryRecord({ submission, estimate });

    expect(createClient).not.toHaveBeenCalled();
  });

  it("環境変数が揃っていれば service role client で inquiries に insert する", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    const { insertInquiryRecord } = await import("./inquiry-repository.js");
    await insertInquiryRecord({ submission, estimate });

    expect(createClient).toHaveBeenCalledWith("https://example.supabase.co", "service-role-key", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(fromMock).toHaveBeenCalledWith("inquiries");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: "laporta-hp", submission, estimate, status: "new" }),
    );
  });

  it("insert がエラーを返したら throw する", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    insertMock.mockResolvedValue({ error: { message: "insert failed" } });

    const { insertInquiryRecord } = await import("./inquiry-repository.js");
    await expect(insertInquiryRecord({ submission, estimate })).rejects.toThrow("insert failed");
  });
});
