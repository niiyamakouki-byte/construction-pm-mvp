import { describe, it, expect, vi, afterEach } from "vitest";
import { matchInvoices } from "../invoice-matcher.js";
import { FreeeClient } from "../client.js";
import type { Invoice as GenbaInvoice } from "../../invoice-store.js";

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Fixtures ─────────────────────────────────────────

const baseGenba: GenbaInvoice = {
  id: "inv-1",
  projectId: "proj-1",
  vendorName: "株式会社テスト",
  amount: 300_000,
  tax: 30_000,
  total: 330_000,
  items: [],
  invoiceDate: "2025-04-10",
  status: "未確認",
};

function mockClient(invoices: object[]): FreeeClient {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ invoices }),
    }),
  );
  return new FreeeClient("token");
}

// ── matchInvoices ─────────────────────────────────────

describe("matchInvoices — exact match", () => {
  it("returns exact when amount and date both match", async () => {
    const client = mockClient([
      {
        id: 201,
        company_id: 1,
        issue_date: "2025-04-10",
        invoice_number: "F-001",
        total_amount: 330_000,
        total_vat: 30_000,
        sub_total: 300_000,
        invoice_status: "submitted",
        invoice_lines: [],
      },
    ]);

    const results = await matchInvoices(client, 1, [baseGenba]);
    expect(results[0]?.matchType).toBe("exact");
    expect(results[0]?.confidence).toBe(1.0);
    expect(results[0]?.freeeInvoiceId).toBe(201);
  });

  it("returns exact when date differs by 3 days (within tolerance)", async () => {
    const client = mockClient([
      {
        id: 202,
        company_id: 1,
        issue_date: "2025-04-13",
        invoice_number: "F-002",
        total_amount: 330_000,
        total_vat: 30_000,
        sub_total: 300_000,
        invoice_status: "submitted",
        invoice_lines: [],
      },
    ]);

    const results = await matchInvoices(client, 1, [baseGenba]);
    expect(results[0]?.matchType).toBe("exact");
  });
});

describe("matchInvoices — amount_only match", () => {
  it("returns amount_only when amount matches but date differs > 3 days", async () => {
    const client = mockClient([
      {
        id: 203,
        company_id: 1,
        issue_date: "2025-04-20",
        invoice_number: "F-003",
        total_amount: 330_000,
        total_vat: 30_000,
        sub_total: 300_000,
        invoice_status: "submitted",
        invoice_lines: [],
      },
    ]);

    const results = await matchInvoices(client, 1, [baseGenba]);
    expect(results[0]?.matchType).toBe("amount_only");
    expect(results[0]?.confidence).toBe(0.6);
    expect(results[0]?.discrepancies).toBeDefined();
  });
});

describe("matchInvoices — no match", () => {
  it("returns none when no freee invoices exist", async () => {
    const client = mockClient([]);
    const results = await matchInvoices(client, 1, [baseGenba]);
    expect(results[0]?.matchType).toBe("none");
    expect(results[0]?.confidence).toBe(0);
  });

  it("returns none when amount differs", async () => {
    const client = mockClient([
      {
        id: 204,
        company_id: 1,
        issue_date: "2025-04-10",
        invoice_number: "F-004",
        total_amount: 999_999,
        total_vat: 0,
        sub_total: 999_999,
        invoice_status: "submitted",
        invoice_lines: [],
      },
    ]);

    const results = await matchInvoices(client, 1, [baseGenba]);
    expect(results[0]?.matchType).toBe("none");
  });
});

describe("matchInvoices — unconfigured client", () => {
  it("returns none for all invoices when client not configured", async () => {
    const client = new FreeeClient();   // no token
    const results = await matchInvoices(client, 1, [baseGenba, { ...baseGenba, id: "inv-2" }]);
    expect(results).toHaveLength(2);
    results.forEach((r) => expect(r.matchType).toBe("none"));
  });
});
