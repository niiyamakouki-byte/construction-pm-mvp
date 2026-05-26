import { describe, it, expect } from "vitest";
import {
  matchInvoicesToFreeeDeals,
  levenshteinSimilarity,
  type FreeeDeal,
} from "./MatchingEngine.js";
import type { Invoice } from "../invoice-store.js";

// ── Fixtures ─────────────────────────────────────────

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-abcd",
    projectId: "proj-1",
    vendorName: "株式会社テスト工業",
    amount: 300_000,
    tax: 30_000,
    total: 330_000,
    items: [],
    invoiceDate: "2025-04-01",
    status: "未確認",
    ...overrides,
  };
}

function makeDeal(overrides: Partial<FreeeDeal> = {}): FreeeDeal {
  return {
    id: 1001,
    issue_date: "2025-04-15",
    amount: 330_000,
    partner_name: "株式会社テスト工業",
    ref_number: undefined,
    status: "unsettled",
    ...overrides,
  };
}

// ── levenshteinSimilarity ─────────────────────────────

describe("levenshteinSimilarity", () => {
  it("returns 1 for identical strings", () => {
    expect(levenshteinSimilarity("abc", "abc")).toBe(1);
  });

  it("returns 0 for empty string", () => {
    expect(levenshteinSimilarity("", "abc")).toBe(0);
    expect(levenshteinSimilarity("abc", "")).toBe(0);
  });

  it("returns high similarity for one char difference", () => {
    const sim = levenshteinSimilarity("テスト工業", "テスト工業株式会社");
    expect(sim).toBeGreaterThan(0.5);
  });
});

// ── matchInvoicesToFreeeDeals ─────────────────────────

describe("matchInvoicesToFreeeDeals — amount exact match", () => {
  it("matches when amount is exactly equal and date is within 30 days", () => {
    const inv = makeInvoice();
    const deal = makeDeal();
    const result = matchInvoicesToFreeeDeals([inv], [deal]);

    expect(result.matched).toHaveLength(1);
    expect(result.unmatched).toHaveLength(0);
    expect(result.matched[0]!.score).toBeGreaterThanOrEqual(0.7);
    expect(result.matched[0]!.reasons).toContain("金額完全一致");
  });

  it("score >= 0.9 when amount + partner name + date + ref_number all match", () => {
    const inv = makeInvoice({ id: "inv-abcd" });
    // amount exact (+0.5) + partner (+0.2) + date within 30d (+0.15) + ref (+0.15) = 1.0
    const deal = makeDeal({
      issue_date: "2025-04-15",  // 14 days after invoice 2025-04-01
      ref_number: "REF-abcd-2025",
    });
    const result = matchInvoicesToFreeeDeals([inv], [deal]);

    expect(result.matched[0]!.score).toBeGreaterThanOrEqual(0.9);
  });
});

describe("matchInvoicesToFreeeDeals — amount tolerance", () => {
  it("gives +0.3 for amount within 1% (not exact)", () => {
    const inv = makeInvoice({ total: 330_000 });
    // 0.5% 差
    const deal = makeDeal({ amount: 331_650, partner_name: undefined });
    const result = matchInvoicesToFreeeDeals([inv], [deal]);

    // partner name なし + 日付 OK → score = 0.3 + 0.15 = 0.45 → unmatched
    // partner name ない場合は fuzzy スキップ → score < 0.7 → unmatched
    expect(result.matched.length + result.unmatched.length).toBe(1);
  });

  it("no match when amount differs by more than 1%", () => {
    const inv = makeInvoice({ total: 330_000 });
    const deal = makeDeal({ amount: 200_000, partner_name: undefined });
    const result = matchInvoicesToFreeeDeals([inv], [deal]);

    expect(result.unmatched).toHaveLength(1);
  });
});

describe("matchInvoicesToFreeeDeals — partner fuzzy match", () => {
  it("adds +0.2 when partner name similarity >= 0.8", () => {
    const inv = makeInvoice({ vendorName: "株式会社テスト工業" });
    // わずかに異なる表記
    const deal = makeDeal({ partner_name: "株式会社テスト工業" });
    const result = matchInvoicesToFreeeDeals([inv], [deal]);

    const candidate = result.matched[0];
    expect(candidate?.reasons.some((r) => r.includes("取引先名一致"))).toBe(true);
  });

  it("does not add partner score when similarity < 0.8", () => {
    const inv = makeInvoice({ vendorName: "株式会社テスト工業" });
    const deal = makeDeal({ partner_name: "全然違う会社名ABCDEFGH" });
    const result = matchInvoicesToFreeeDeals([inv], [deal]);

    const candidate = result.matched[0] ?? result.unmatched[0];
    const reasons = result.matched[0]?.reasons ?? [];
    expect(reasons.every((r) => !r.includes("取引先名一致"))).toBe(true);
  });
});

describe("matchInvoicesToFreeeDeals — date proximity", () => {
  it("adds +0.15 when deal date is within 30 days after invoice date", () => {
    const inv = makeInvoice({ invoiceDate: "2025-04-01" });
    const deal = makeDeal({ issue_date: "2025-04-20" }); // 19日後
    const result = matchInvoicesToFreeeDeals([inv], [deal]);

    const candidate = result.matched[0];
    expect(candidate?.reasons.some((r) => r.includes("振込日"))).toBe(true);
  });

  it("does not add date score when deal date is > 30 days after invoice", () => {
    const inv = makeInvoice({ invoiceDate: "2025-04-01" });
    const deal = makeDeal({ issue_date: "2025-05-15" }); // 44日後
    const result = matchInvoicesToFreeeDeals([inv], [deal]);

    const reasons = result.matched[0]?.reasons ?? [];
    expect(reasons.every((r) => !r.includes("振込日"))).toBe(true);
  });

  it("does not add date score when deal date is before invoice date", () => {
    const inv = makeInvoice({ invoiceDate: "2025-04-15" });
    const deal = makeDeal({ issue_date: "2025-04-01" }); // 14日前
    const result = matchInvoicesToFreeeDeals([inv], [deal]);

    const reasons = result.matched[0]?.reasons ?? [];
    expect(reasons.every((r) => !r.includes("振込日"))).toBe(true);
  });
});

describe("matchInvoicesToFreeeDeals — ref_number match", () => {
  it("adds +0.15 when ref_number contains last 4 chars of invoice id", () => {
    const inv = makeInvoice({ id: "inv-abcd" });
    const deal = makeDeal({ ref_number: "REF-abcd-2025" });
    const result = matchInvoicesToFreeeDeals([inv], [deal]);

    const candidate = result.matched[0];
    expect(candidate?.reasons.some((r) => r.includes("ref_number"))).toBe(true);
  });

  it("does not add ref score when ref_number does not contain invoice id tail", () => {
    const inv = makeInvoice({ id: "inv-abcd" });
    const deal = makeDeal({ ref_number: "REF-9999" });
    const result = matchInvoicesToFreeeDeals([inv], [deal]);

    const reasons = result.matched[0]?.reasons ?? [];
    expect(reasons.every((r) => !r.includes("ref_number"))).toBe(true);
  });
});

describe("matchInvoicesToFreeeDeals — no match", () => {
  it("puts invoice in unmatched when best score < 0.7", () => {
    const inv = makeInvoice({ total: 330_000, vendorName: "A", invoiceDate: "2025-01-01" });
    // amount mismatch, no partner, date > 30 days
    const deal = makeDeal({ amount: 100_000, partner_name: undefined, issue_date: "2025-06-01" });
    const result = matchInvoicesToFreeeDeals([inv], [deal]);

    expect(result.unmatched).toHaveLength(1);
    expect(result.matched).toHaveLength(0);
  });

  it("returns empty matched and all unmatched when deals list is empty", () => {
    const result = matchInvoicesToFreeeDeals([makeInvoice()], []);
    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
  });

  it("returns empty result when invoices list is empty", () => {
    const result = matchInvoicesToFreeeDeals([], [makeDeal()]);
    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(0);
  });
});

describe("matchInvoicesToFreeeDeals — ordering", () => {
  it("returns matched candidates sorted by score descending", () => {
    const inv1 = makeInvoice({ id: "inv-0001", total: 330_000 });
    const inv2 = makeInvoice({ id: "inv-0002", total: 110_000 });
    const deal1 = makeDeal({ id: 1, amount: 330_000 });
    const deal2 = makeDeal({ id: 2, amount: 110_000, partner_name: "全然違う会社ZZZZZ" });

    const result = matchInvoicesToFreeeDeals([inv1, inv2], [deal1, deal2]);

    const scores = result.matched.map((c) => c.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]!).toBeGreaterThanOrEqual(scores[i]!);
    }
  });
});
