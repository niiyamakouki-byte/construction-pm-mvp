import { describe, it, expect, beforeEach } from "vitest";
import { FreeeRepository } from "./FreeeRepository.js";
import type { FreeeDeal } from "./MatchingEngine.js";

// すべてテストはインメモリモードで実行（useSupabase=false）

function makeRepo() {
  return new FreeeRepository(false);
}

function makeDeal(overrides: Partial<FreeeDeal> = {}): FreeeDeal {
  return {
    id: 1001,
    issue_date: "2025-04-15",
    amount: 330_000,
    partner_name: "テスト商事",
    ref_number: "REF-001",
    status: "unsettled",
    ...overrides,
  };
}

describe("FreeeRepository — saveConnection", () => {
  it("saves a connection without throwing", async () => {
    const repo = makeRepo();
    await expect(
      repo.saveConnection("org-1", 9001, {
        accessToken: "at",
        refreshToken: "rt",
        expiresAt: "2026-01-01T00:00:00Z",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("FreeeRepository — upsertDeals + listCachedDeals", () => {
  it("returns empty list when no deals cached", async () => {
    const repo = makeRepo();
    const deals = await repo.listCachedDeals("org-1");
    expect(deals).toHaveLength(0);
  });

  it("returns cached deals after upsert", async () => {
    const repo = makeRepo();
    await repo.upsertDeals("org-1", 9001, [makeDeal()]);
    const deals = await repo.listCachedDeals("org-1");
    expect(deals).toHaveLength(1);
    expect(deals[0]!.id).toBe(1001);
  });

  it("isolates deals by organization_id", async () => {
    const repo = makeRepo();
    await repo.upsertDeals("org-A", 9001, [makeDeal({ id: 1 })]);
    await repo.upsertDeals("org-B", 9001, [makeDeal({ id: 2 })]);

    const dealsA = await repo.listCachedDeals("org-A");
    const dealsB = await repo.listCachedDeals("org-B");

    expect(dealsA.map((d) => d.id)).toContain(1);
    expect(dealsA.map((d) => d.id)).not.toContain(2);
    expect(dealsB.map((d) => d.id)).toContain(2);
  });

  it("filters by amountMin and amountMax", async () => {
    const repo = makeRepo();
    await repo.upsertDeals("org-1", 9001, [
      makeDeal({ id: 1, amount: 100_000 }),
      makeDeal({ id: 2, amount: 200_000 }),
      makeDeal({ id: 3, amount: 300_000 }),
    ]);

    const deals = await repo.listCachedDeals("org-1", {
      amountMin: 150_000,
      amountMax: 250_000,
    });

    expect(deals).toHaveLength(1);
    expect(deals[0]!.amount).toBe(200_000);
  });

  it("filters by partnerName substring", async () => {
    const repo = makeRepo();
    await repo.upsertDeals("org-1", 9001, [
      makeDeal({ id: 1, partner_name: "テスト商事" }),
      makeDeal({ id: 2, partner_name: "別の会社" }),
    ]);

    const deals = await repo.listCachedDeals("org-1", { partnerName: "テスト" });
    expect(deals).toHaveLength(1);
    expect(deals[0]!.partner_name).toBe("テスト商事");
  });
});

describe("FreeeRepository — recordMatch + listMatches", () => {
  it("records a match and retrieves it", async () => {
    const repo = makeRepo();
    await repo.recordMatch("inv-1", 1001, "org-1", 0.95, "金額完全一致", "auto");
    const matches = await repo.listMatches("org-1");
    expect(matches).toHaveLength(1);
    expect(matches[0]!.invoice_id).toBe("inv-1");
    expect(matches[0]!.freee_deal_id).toBe(1001);
    expect(matches[0]!.match_score).toBe(0.95);
    expect(matches[0]!.matched_by).toBe("auto");
  });

  it("records manual match", async () => {
    const repo = makeRepo();
    await repo.recordMatch("inv-2", 2002, "org-1", 0.75, "手動確定", "manual");
    const matches = await repo.listMatches("org-1");
    expect(matches.find((m) => m.matched_by === "manual")).toBeDefined();
  });

  it("returns empty list when no matches for org", async () => {
    const repo = makeRepo();
    await repo.recordMatch("inv-1", 1001, "org-A", 0.9, "テスト", "auto");
    const matches = await repo.listMatches("org-B");
    expect(matches).toHaveLength(0);
  });
});
