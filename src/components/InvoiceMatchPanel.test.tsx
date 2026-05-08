import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoiceMatchPanel } from "./InvoiceMatchPanel.js";
import type { MatchResult } from "../lib/freee/MatchingEngine.js";
import type { Invoice } from "../lib/invoice-store.js";
import type { FreeeDeal } from "../lib/freee/MatchingEngine.js";

// ── Fixtures ──────────────────────────────────────────

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-abcd",
    projectId: "proj-1",
    vendorName: "テスト商事",
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
    partner_name: "テスト商事",
    status: "unsettled",
    ...overrides,
  };
}

function makeMatchResult(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    matched: [],
    unmatched: [],
    ...overrides,
  };
}

beforeEach(() => {
  cleanup();
});

// ── テスト ────────────────────────────────────────────

describe("InvoiceMatchPanel", () => {
  it("renders header text", () => {
    render(
      <InvoiceMatchPanel
        matchResult={makeMatchResult()}
        onConfirm={vi.fn()}
        onReject={vi.fn()}
        onAutoMatchAll={vi.fn()}
      />,
    );
    expect(screen.getByText("freee 入金照合")).toBeDefined();
  });

  it("shows invoice vendor name in invoice list", () => {
    const result = makeMatchResult({
      matched: [
        {
          invoice: makeInvoice({ vendorName: "山田建設" }),
          deal: makeDeal(),
          score: 0.9,
          reasons: ["金額完全一致"],
        },
      ],
    });
    render(
      <InvoiceMatchPanel
        matchResult={result}
        onConfirm={vi.fn()}
        onReject={vi.fn()}
        onAutoMatchAll={vi.fn()}
      />,
    );
    expect(screen.getAllByText("山田建設").length).toBeGreaterThan(0);
  });

  it("shows auto-match button when score >= 0.9 candidate exists", () => {
    const result = makeMatchResult({
      matched: [
        {
          invoice: makeInvoice(),
          deal: makeDeal(),
          score: 0.95,
          reasons: ["金額完全一致"],
        },
      ],
    });
    render(
      <InvoiceMatchPanel
        matchResult={result}
        onConfirm={vi.fn()}
        onReject={vi.fn()}
        onAutoMatchAll={vi.fn()}
      />,
    );
    expect(screen.getByText(/一括 auto-match/)).toBeDefined();
  });

  it("calls onAutoMatchAll when auto-match button is clicked", async () => {
    const user = userEvent.setup();
    const onAutoMatchAll = vi.fn();
    const result = makeMatchResult({
      matched: [
        {
          invoice: makeInvoice(),
          deal: makeDeal(),
          score: 0.95,
          reasons: ["金額完全一致"],
        },
      ],
    });
    render(
      <InvoiceMatchPanel
        matchResult={result}
        onConfirm={vi.fn()}
        onReject={vi.fn()}
        onAutoMatchAll={onAutoMatchAll}
      />,
    );
    await user.click(screen.getByText(/一括 auto-match/));
    expect(onAutoMatchAll).toHaveBeenCalledOnce();
  });

  it("shows empty message when no invoices", () => {
    render(
      <InvoiceMatchPanel
        matchResult={makeMatchResult()}
        onConfirm={vi.fn()}
        onReject={vi.fn()}
        onAutoMatchAll={vi.fn()}
      />,
    );
    expect(screen.getByText("請求書がありません")).toBeDefined();
  });
});
