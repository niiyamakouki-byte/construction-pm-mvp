import { describe, it, expect, beforeEach } from "vitest";
import {
  addInvoice,
  getInvoice,
  getAllInvoices,
  getInvoicesByProject,
  getInvoicesByStatus,
  updateInvoiceStatus,
  updateInvoice,
  deleteInvoice,
  clearInvoices,
  getMonthlyInvoiceSummary,
  computeScheduledDate,
  buildPaymentSchedule,
  invoiceToCostEntry,
} from "./invoice-store.js";

const baseInvoice = {
  projectId: "proj-1",
  vendorName: "田中工務店",
  vendorContact: "田中太郎",
  amount: 100000,
  tax: 10000,
  total: 110000,
  items: [{ description: "内装工事", quantity: 1, unitPrice: 100000, amount: 100000 }],
  bankInfo: "三菱UFJ銀行",
  registrationNumber: "T1234567890123",
  invoiceDate: "2026-04-01",
  dueDate: "2026-04-30",
  status: "未確認" as const,
};

describe("invoice-store", () => {
  beforeEach(() => clearInvoices());

  it("adds and retrieves an invoice", () => {
    const inv = addInvoice(baseInvoice);
    expect(inv.id).toMatch(/^inv-/);
    expect(inv.vendorName).toBe("田中工務店");
    expect(getInvoice(inv.id)).toEqual(inv);
  });

  it("returns all invoices", () => {
    addInvoice(baseInvoice);
    addInvoice({ ...baseInvoice, projectId: "proj-2", vendorName: "山田建設" });
    expect(getAllInvoices()).toHaveLength(2);
  });

  it("filters by project", () => {
    addInvoice(baseInvoice);
    addInvoice({ ...baseInvoice, projectId: "proj-2" });
    expect(getInvoicesByProject("proj-1")).toHaveLength(1);
    expect(getInvoicesByProject("proj-2")).toHaveLength(1);
  });

  it("filters by status", () => {
    addInvoice(baseInvoice);
    addInvoice({ ...baseInvoice, status: "振込予定" });
    expect(getInvoicesByStatus("未確認")).toHaveLength(1);
    expect(getInvoicesByStatus("振込予定")).toHaveLength(1);
    expect(getInvoicesByStatus("振込済")).toHaveLength(0);
  });

  it("updates status to 振込済 and sets paidDate", () => {
    const inv = addInvoice(baseInvoice);
    const updated = updateInvoiceStatus(inv.id, "振込済", "2026-04-30");
    expect(updated?.status).toBe("振込済");
    expect(updated?.paidDate).toBe("2026-04-30");
  });

  it("auto-sets paidDate when updating to 振込済 without explicit date", () => {
    const inv = addInvoice(baseInvoice);
    const updated = updateInvoiceStatus(inv.id, "振込済");
    expect(updated?.paidDate).toBeDefined();
  });

  it("preserves paidDate when updating to non-paid status", () => {
    const inv = addInvoice({ ...baseInvoice, status: "振込済", paidDate: "2026-04-15" });
    const updated = updateInvoiceStatus(inv.id, "保留");
    expect(updated?.paidDate).toBe("2026-04-15");
  });

  it("returns undefined for unknown invoice status update", () => {
    expect(updateInvoiceStatus("nonexistent", "確認済")).toBeUndefined();
  });

  it("updates invoice fields", () => {
    const inv = addInvoice(baseInvoice);
    const updated = updateInvoice(inv.id, { vendorName: "鈴木電気" });
    expect(updated?.vendorName).toBe("鈴木電気");
  });

  it("deletes an invoice", () => {
    const inv = addInvoice(baseInvoice);
    expect(deleteInvoice(inv.id)).toBe(true);
    expect(getInvoice(inv.id)).toBeUndefined();
  });

  it("returns false for deleting unknown invoice", () => {
    expect(deleteInvoice("nonexistent")).toBe(false);
  });

  describe("getMonthlyInvoiceSummary", () => {
    it("calculates unpaid total", () => {
      addInvoice({ ...baseInvoice, status: "未確認", total: 110000 });
      addInvoice({ ...baseInvoice, status: "振込予定", total: 220000 });
      addInvoice({ ...baseInvoice, status: "振込済", paidDate: "2026-04-15", total: 330000 });
      const summary = getMonthlyInvoiceSummary("2026-04");
      expect(summary.unpaidTotal).toBe(330000);
      expect(summary.paidTotal).toBe(330000);
    });

    it("calculates this month due total", () => {
      addInvoice({ ...baseInvoice, status: "振込予定", dueDate: "2026-04-30", total: 110000 });
      addInvoice({ ...baseInvoice, status: "振込予定", dueDate: "2026-05-31", total: 220000 });
      const summary = getMonthlyInvoiceSummary("2026-04");
      expect(summary.thisMonthDueTotal).toBe(110000);
    });

    it("returns zeros for empty month", () => {
      const summary = getMonthlyInvoiceSummary("2026-04");
      expect(summary.unpaidTotal).toBe(0);
      expect(summary.thisMonthDueTotal).toBe(0);
      expect(summary.paidTotal).toBe(0);
    });
  });

  describe("computeScheduledDate", () => {
    it("月末締め翌月払い returns last day of next month", () => {
      const result = computeScheduledDate("2026-04-15", "月末締め翌月払い");
      expect(result).toBe("2026-05-31");
    });

    it("月末締め翌々月払い returns last day of month after next", () => {
      const result = computeScheduledDate("2026-04-15", "月末締め翌々月払い");
      expect(result).toBe("2026-06-30");
    });

    it("即時払い returns same date", () => {
      expect(computeScheduledDate("2026-04-15", "即時払い")).toBe("2026-04-15");
    });
  });

  describe("buildPaymentSchedule", () => {
    it("returns pending invoices sorted by scheduled date", () => {
      addInvoice({ ...baseInvoice, status: "振込予定", dueDate: "2026-05-10", total: 110000 });
      addInvoice({ ...baseInvoice, status: "未確認", dueDate: "2026-04-30", total: 220000 });
      addInvoice({ ...baseInvoice, status: "振込済", total: 330000 });
      const schedule = buildPaymentSchedule();
      expect(schedule).toHaveLength(2);
      expect(schedule[0].scheduledDate).toBe("2026-04-30");
      expect(schedule[1].scheduledDate).toBe("2026-05-10");
    });

    it("uses computeScheduledDate when no dueDate", () => {
      addInvoice({ ...baseInvoice, status: "振込予定", dueDate: undefined, invoiceDate: "2026-04-01" });
      const schedule = buildPaymentSchedule("月末締め翌月払い");
      expect(schedule[0].scheduledDate).toBe("2026-05-31");
    });
  });

  describe("invoiceToCostEntry", () => {
    it("converts invoice to cost entry", () => {
      const inv = addInvoice(baseInvoice);
      const entry = invoiceToCostEntry(inv);
      expect(entry.projectId).toBe("proj-1");
      expect(entry.description).toBe("請求書: 田中工務店");
      expect(entry.amount).toBe(110000);
      expect(entry.vendor).toBe("田中工務店");
    });
  });
});
