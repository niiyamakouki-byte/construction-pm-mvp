/**
 * invoice-store カオステスト — 異常入力・境界値の網羅
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  addInvoice,
  getInvoice,
  getAllInvoices,
  clearInvoices,
  updateInvoiceStatus,
  invoiceToCostEntry,
} from "./invoice-store.js";

const base = {
  projectId: "proj-1",
  vendorName: "田中工務店",
  amount: 100000,
  tax: 10000,
  total: 110000,
  items: [{ description: "内装工事", quantity: 1, unitPrice: 100000, amount: 100000 }],
  invoiceDate: "2026-04-01",
  dueDate: "2026-04-30",
  status: "未確認" as const,
};

describe("invoice-store: カオステスト", () => {
  beforeEach(() => clearInvoices());

  // ── 金額の境界値 ──────────────────────────────────────────────────────────

  it("金額0円の請求書を登録できる", () => {
    const inv = addInvoice({ ...base, amount: 0, tax: 0, total: 0 });
    expect(inv.total).toBe(0);
    const summary = invoiceToCostEntry(inv);
    expect(summary.amount).toBe(0);
  });

  it("負の金額の請求書はtotalがマイナスになる（バリデーション未実装確認）", () => {
    const inv = addInvoice({ ...base, amount: -50000, tax: -5000, total: -55000 });
    // 現在はバリデーションなし — totalがマイナスのまま格納される
    expect(inv.total).toBe(-55000);
  });

  it("NaNの金額を登録するとtotalがNaNになる（バリデーション未実装確認）", () => {
    const inv = addInvoice({ ...base, amount: NaN, tax: NaN, total: NaN });
    expect(inv.total).toBeNaN();
  });

  it("Infinityの金額を登録するとtotalがInfinityになる（バリデーション未実装確認）", () => {
    const inv = addInvoice({ ...base, amount: Infinity, tax: 0, total: Infinity });
    expect(inv.total).toBe(Infinity);
  });

  // ── 業者名の境界値 ────────────────────────────────────────────────────────

  it("業者名が空文字列の請求書を登録できる", () => {
    const inv = addInvoice({ ...base, vendorName: "" });
    expect(inv.vendorName).toBe("");
    // costEntryのdescriptionが「請求書: 」になる
    expect(invoiceToCostEntry(inv).description).toBe("請求書: ");
  });

  it("業者名10000文字超の請求書を登録できる（文字数制限なし確認）", () => {
    const longName = "あ".repeat(10000);
    const inv = addInvoice({ ...base, vendorName: longName });
    expect(inv.vendorName.length).toBe(10000);
  });

  // ── ステータス遷移（不正スキップ） ────────────────────────────────────────

  it("updateInvoiceStatusは未確認→振込済を制限なく更新する（ステータス遷移バリデーション未実装確認）", () => {
    // 現在の実装はステータス遷移チェックなし
    const inv = addInvoice({ ...base, status: "未確認" });
    const updated = updateInvoiceStatus(inv.id, "振込済");
    // バリデーションがないためスキップ遷移が通ってしまう
    expect(updated?.status).toBe("振込済");
  });

  // ── 重複登録 ─────────────────────────────────────────────────────────────

  it("同じ内容の請求書を2回登録すると別IDで2件保存される", () => {
    addInvoice(base);
    addInvoice(base);
    const all = getAllInvoices();
    expect(all).toHaveLength(2);
    expect(all[0].id).not.toBe(all[1].id);
  });
});
