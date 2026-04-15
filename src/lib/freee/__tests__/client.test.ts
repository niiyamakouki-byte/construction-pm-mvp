import { describe, it, expect, vi, afterEach } from "vitest";
import { FreeeClient } from "../client.js";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env["FREEE_ACCESS_TOKEN"];
});

// ── isConfigured ─────────────────────────────────────

describe("FreeeClient.isConfigured", () => {
  it("returns false when no token provided and env not set", () => {
    const client = new FreeeClient();
    expect(client.isConfigured()).toBe(false);
  });

  it("returns true when token passed directly", () => {
    const client = new FreeeClient("test-token");
    expect(client.isConfigured()).toBe(true);
  });

  it("returns true when FREEE_ACCESS_TOKEN env is set", () => {
    process.env["FREEE_ACCESS_TOKEN"] = "env-token";
    const client = new FreeeClient();
    expect(client.isConfigured()).toBe(true);
  });

  it("prefers constructor arg over env var", () => {
    process.env["FREEE_ACCESS_TOKEN"] = "env-token";
    const client = new FreeeClient("direct-token");
    expect(client.isConfigured()).toBe(true);
  });
});

// ── Unconfigured throws ──────────────────────────────

describe("FreeeClient unconfigured", () => {
  it("throws on getCompanies when not configured", async () => {
    const client = new FreeeClient();
    await expect(client.getCompanies()).rejects.toThrow("FREEE_ACCESS_TOKEN");
  });
});

// ── Mock fetch ───────────────────────────────────────

describe("FreeeClient API calls", () => {
  it("GET /api/1/companies returns companies array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          companies: [{ id: 1, name: "ラポルタ", role: "admin" }],
        }),
      }),
    );

    const client = new FreeeClient("token");
    const result = await client.getCompanies();
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("ラポルタ");
  });

  it("GET /api/1/deals returns deals array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          deals: [
            {
              id: 10,
              company_id: 1,
              issue_date: "2025-04-01",
              amount: 500_000,
              type: "income",
              status: "unsettled",
              details: [],
            },
          ],
          meta: { total_count: 1 },
        }),
      }),
    );

    const client = new FreeeClient("token");
    const deals = await client.listDeals(1);
    expect(deals).toHaveLength(1);
    expect(deals[0]?.amount).toBe(500_000);
  });

  it("POST /api/1/deals creates a deal", async () => {
    const created = {
      id: 99,
      company_id: 1,
      issue_date: "2025-04-01",
      amount: 1_000_000,
      type: "income",
      status: "unsettled",
      details: [],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ deal: created }),
      }),
    );

    const client = new FreeeClient("token");
    const deal = await client.createDeal(1, {
      issue_date: "2025-04-01",
      amount: 1_000_000,
      type: "income",
      details: [],
    });
    expect(deal.id).toBe(99);
  });

  it("GET /api/1/invoices returns invoices array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          invoices: [
            {
              id: 200,
              company_id: 1,
              issue_date: "2025-04-10",
              invoice_number: "INV-001",
              total_amount: 330_000,
              total_vat: 30_000,
              sub_total: 300_000,
              invoice_status: "submitted",
              invoice_lines: [],
            },
          ],
        }),
      }),
    );

    const client = new FreeeClient("token");
    const invoices = await client.listInvoices(1);
    expect(invoices).toHaveLength(1);
    expect(invoices[0]?.total_amount).toBe(330_000);
  });

  it("GET /api/1/walletables returns wallets array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          walletables: [
            { id: 5, name: "三菱UFJ普通", type: "bank_account" },
          ],
        }),
      }),
    );

    const client = new FreeeClient("token");
    const wallets = await client.listWallets(1);
    expect(wallets).toHaveLength(1);
    expect(wallets[0]?.name).toBe("三菱UFJ普通");
  });

  it("throws on non-ok HTTP response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      }),
    );

    const client = new FreeeClient("bad-token");
    await expect(client.getCompanies()).rejects.toThrow("401");
  });
});
