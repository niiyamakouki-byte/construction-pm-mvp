import { describe, it, expect, vi, afterEach } from "vitest";
import { generateProjectExpenseReport } from "../expense-reporter.js";
import { FreeeClient } from "../client.js";

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Fixtures ─────────────────────────────────────────

const period = {
  from: new Date("2025-04-01"),
  to: new Date("2025-04-30"),
};

const mockDeal = {
  id: 1,
  company_id: 1,
  issue_date: "2025-04-15",
  amount: 1_000_000,
  type: "income",
  status: "unsettled",
  ref_number: "proj-abc",
  details: [{ id: 1, account_item_id: 1, tax_code: 21, amount: 1_000_000, description: "工事" }],
};

const mockCostDeal = {
  id: 2,
  company_id: 1,
  issue_date: "2025-04-20",
  amount: 600_000,
  type: "expense",
  status: "unsettled",
  ref_number: "proj-abc",
  details: [{ id: 2, account_item_id: 3, tax_code: 21, amount: 600_000, description: "材料費" }],
};

function mockClientWithDeals(deals: object[]): FreeeClient {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ deals, meta: { total_count: deals.length } }),
    }),
  );
  return new FreeeClient("token");
}

// ── generateProjectExpenseReport ─────────────────────

describe("generateProjectExpenseReport — unconfigured", () => {
  it("returns empty report when client not configured", async () => {
    const client = new FreeeClient();   // no token
    const report = await generateProjectExpenseReport(client, 1, "proj-abc", period);
    expect(report.totalRevenue).toBe(0);
    expect(report.totalCost).toBe(0);
    expect(report.grossProfit).toBe(0);
    expect(report.breakdown).toHaveLength(0);
  });
});

describe("generateProjectExpenseReport — revenue and cost", () => {
  it("calculates gross profit correctly", async () => {
    const client = mockClientWithDeals([mockDeal, mockCostDeal]);
    const report = await generateProjectExpenseReport(client, 1, "proj-abc", period);
    expect(report.totalRevenue).toBe(1_000_000);
    expect(report.totalCost).toBe(600_000);
    expect(report.grossProfit).toBe(400_000);
  });

  it("includes breakdown by account category", async () => {
    const client = mockClientWithDeals([mockDeal, mockCostDeal]);
    const report = await generateProjectExpenseReport(client, 1, "proj-abc", period);
    expect(report.breakdown.length).toBeGreaterThan(0);
    const labels = report.breakdown.map((b) => b.category);
    expect(labels).toContain("売上高");
    expect(labels).toContain("材料費");
  });

  it("filters deals by ref_number (projectId)", async () => {
    const otherDeal = { ...mockDeal, id: 99, ref_number: "other-proj" };
    const client = mockClientWithDeals([mockDeal, otherDeal]);
    const report = await generateProjectExpenseReport(client, 1, "proj-abc", period);
    // only mockDeal matches proj-abc
    expect(report.totalRevenue).toBe(1_000_000);
  });

  it("returns empty report when no deals match projectId", async () => {
    const client = mockClientWithDeals([{ ...mockDeal, ref_number: "other" }]);
    const report = await generateProjectExpenseReport(client, 1, "proj-abc", period);
    expect(report.totalRevenue).toBe(0);
    expect(report.grossProfit).toBe(0);
  });
});

describe("generateProjectExpenseReport — metadata", () => {
  it("echoes projectId and period in report", async () => {
    const client = mockClientWithDeals([]);
    const report = await generateProjectExpenseReport(client, 1, "proj-xyz", period);
    expect(report.projectId).toBe("proj-xyz");
    expect(report.period.from).toEqual(period.from);
    expect(report.period.to).toEqual(period.to);
  });
});
