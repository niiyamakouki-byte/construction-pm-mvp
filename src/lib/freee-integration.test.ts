import { describe, it, expect, beforeEach } from "vitest";
import {
  MockFreeeClient,
  categorizeExpense,
  checkUnpaidInvoices,
} from "./freee-integration.js";
import type { FreeeInvoice, FreeeExpense } from "./freee-integration.js";

const baseInvoice: FreeeInvoice = {
  id: "inv-001",
  partnerId: "partner-1",
  partnerName: "田中工務店",
  invoiceNumber: "INV-2026-001",
  totalAmount: 550000,
  dueDate: "2026-04-30",
  status: "sent",
};

describe("MockFreeeClient", () => {
  let client: MockFreeeClient;

  beforeEach(() => {
    client = new MockFreeeClient();
  });

  it("authenticate後にgetInvoicesが成功する", async () => {
    await client.authenticate("cid", "csec");
    client.seedInvoice(baseInvoice);
    const invoices = await client.getInvoices();
    expect(invoices).toHaveLength(1);
    expect(invoices[0].partnerName).toBe("田中工務店");
  });

  it("未認証でgetInvoicesを呼ぶとエラー", async () => {
    await expect(client.getInvoices()).rejects.toThrow("not authenticated");
  });

  it("getPaymentsが特定請求書の入金を返す", async () => {
    await client.authenticate("cid", "csec");
    client.seedPayment({
      id: "pay-001",
      invoiceId: "inv-001",
      amount: 550000,
      paidAt: "2026-04-25",
      method: "bank_transfer",
    });
    const payments = await client.getPayments("inv-001");
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe(550000);
  });

  it("別の請求書IDではgetPaymentsが空を返す", async () => {
    await client.authenticate("cid", "csec");
    client.seedPayment({
      id: "pay-001",
      invoiceId: "inv-001",
      amount: 100000,
      paidAt: "2026-04-20",
      method: "cash",
    });
    const payments = await client.getPayments("inv-999");
    expect(payments).toHaveLength(0);
  });

  it("createExpenseで経費が登録されgetExpensesで取得できる", async () => {
    await client.authenticate("cid", "csec");
    const data: Omit<FreeeExpense, "id"> = {
      date: "2026-04-10",
      amount: 3200,
      category: "交通費",
      description: "タクシー代（現場往復）",
    };
    const created = await client.createExpense(data);
    expect(created.id).toMatch(/^exp-/);
    expect(created.amount).toBe(3200);

    const all = await client.getExpenses();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(created.id);
  });

  it("createExpenseでreceiptUrlを含む経費を登録できる", async () => {
    await client.authenticate("cid", "csec");
    const created = await client.createExpense({
      date: "2026-04-11",
      amount: 15000,
      category: "外注費",
      description: "電気工事 外注",
      receiptUrl: "https://example.com/receipt/123.pdf",
    });
    expect(created.receiptUrl).toBe("https://example.com/receipt/123.pdf");
  });

  it("reset後は未認証状態でデータも消える", async () => {
    await client.authenticate("cid", "csec");
    client.seedInvoice(baseInvoice);
    client.reset();
    await expect(client.getInvoices()).rejects.toThrow("not authenticated");
  });
});

describe("checkUnpaidInvoices", () => {
  it("sentとoverdueのみ返す", () => {
    const invoices: FreeeInvoice[] = [
      { ...baseInvoice, id: "i1", status: "draft" },
      { ...baseInvoice, id: "i2", status: "sent" },
      { ...baseInvoice, id: "i3", status: "paid" },
      { ...baseInvoice, id: "i4", status: "overdue" },
    ];
    const unpaid = checkUnpaidInvoices(invoices);
    expect(unpaid).toHaveLength(2);
    expect(unpaid.map((i) => i.id)).toEqual(["i2", "i4"]);
  });

  it("全件paidなら空配列を返す", () => {
    const invoices: FreeeInvoice[] = [
      { ...baseInvoice, id: "i1", status: "paid" },
      { ...baseInvoice, id: "i2", status: "paid" },
    ];
    expect(checkUnpaidInvoices(invoices)).toHaveLength(0);
  });

  it("空配列を渡すと空配列が返る", () => {
    expect(checkUnpaidInvoices([])).toHaveLength(0);
  });
});

describe("categorizeExpense", () => {
  it("交通費キーワードでカテゴリを推定する", () => {
    expect(categorizeExpense("タクシー代（現場往復）")).toBe("交通費");
    expect(categorizeExpense("電車代 南青山→新宿")).toBe("交通費");
  });

  it("飲食費キーワードでカテゴリを推定する", () => {
    expect(categorizeExpense("懇親会 居酒屋")).toBe("飲食費");
    expect(categorizeExpense("ランチミーティング")).toBe("飲食費");
  });

  it("工具・資材費キーワードでカテゴリを推定する", () => {
    expect(categorizeExpense("内装資材 購入")).toBe("工具・資材費");
    expect(categorizeExpense("工具代")).toBe("工具・資材費");
  });

  it("外注費キーワードでカテゴリを推定する", () => {
    expect(categorizeExpense("電気工事 外注費")).toBe("外注費");
  });

  it("マッチしない場合はその他を返す", () => {
    expect(categorizeExpense("謎の支出XYZ")).toBe("その他");
    expect(categorizeExpense("")).toBe("その他");
  });
});
