import { describe, expect, it } from "vitest";
import { summarizeInvoicePayments } from "./ProjectFinancePanel.js";
import type { Invoice } from "../lib/invoice-store.js";

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "inv-1",
    projectId: "proj-1",
    vendorName: "テスト",
    amount: 100_000,
    tax: 10_000,
    total: 110_000,
    items: [],
    invoiceDate: "2026-06-01",
    status: "確認待ち",
    ...overrides,
  };
}

describe("summarizeInvoicePayments", () => {
  it("空リストなら 0 / 0", () => {
    expect(summarizeInvoicePayments([])).toEqual({ paidTotal: 0, unpaidTotal: 0 });
  });

  it("支払済み は入金済み合計、それ以外は未入金合計に積み上げる", () => {
    const invoices: Invoice[] = [
      makeInvoice({ id: "a", status: "支払済み", total: 100_000 }),
      makeInvoice({ id: "b", status: "確認待ち", total: 50_000 }),
      makeInvoice({ id: "c", status: "受領", total: 30_000 }),
      makeInvoice({ id: "d", status: "支払予定", total: 20_000 }),
      makeInvoice({ id: "e", status: "確認待ち", total: 10_000 }),
      makeInvoice({ id: "f", status: "支払済み", total: 70_000 }),
    ];
    expect(summarizeInvoicePayments(invoices)).toEqual({
      paidTotal: 170_000,
      unpaidTotal: 110_000,
    });
  });
});
