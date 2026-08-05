import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadKeieiSnapshot } from "./keiei-snapshot.js";

let root: string;

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

function writeJson(file: string, data: unknown) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data));
}

describe("loadKeieiSnapshot", () => {
  it("returns ok:false when no morning report exists yet", () => {
    root = mkdtempSync(path.join(tmpdir(), "keiei-snapshot-"));
    const snapshot = loadKeieiSnapshot(root);
    expect(snapshot.ok).toBe(false);
  });

  it("maps a real morning-report shape into the wire format, with predicted runway kept separate from actuals", () => {
    root = mkdtempSync(path.join(tmpdir(), "keiei-snapshot-"));
    writeJson(path.join(root, "reports", "2026-08-05-morning.json"), {
      date: "2026-08-05",
      bank_balance: 1_239_279,
      runway: {
        worst_case: { months: 0.6, exhausted_on: "2026-08-21", assumption: "悲観の前提文" },
        best_case: { months: 0.6, exhausted_on: "2026-08-21", assumption: "楽観の前提文" },
        with_historical_revenue: { months: null, exhausted_on: null, assumption: "実績反映の前提文" },
      },
      data_quality: { unregistered_wallet_txns: 628, as_of: "2026-08-05", note: "3口座90日窓" },
    });
    writeJson(path.join(root, "receivables", "2026-07.json"), {
      rows: [
        { status: "unpaid", client: "A社", title: "工事1", amount: 2_282_500, due_date: "2026-08-31", invoice_number: "INV-1" },
        { status: "paid", client: "B社", title: "工事2", amount: 500_000, due_date: "2026-08-31", invoice_number: "INV-2" },
      ],
    });

    const snapshot = loadKeieiSnapshot(root);
    if (!snapshot.ok) throw new Error("expected ok:true");

    expect(snapshot.bankBalance).toBe(1_239_279);
    expect(snapshot.runway?.worst.exhaustedOn).toBe("2026-08-21");
    expect(snapshot.runway?.historical?.months).toBeNull();
    // paid行は未回収から除外される
    expect(snapshot.receivables).toEqual({
      count: 1,
      total: 2_282_500,
      rows: [{ client: "A社", title: "工事1", amount: 2_282_500, dueDate: "2026-08-31", invoiceNumber: "INV-1" }],
    });
    expect(snapshot.dataQuality).toEqual({ unregisteredWalletTxns: 628, asOf: "2026-08-05", note: "3口座90日窓" });
    // ledgerデータが無い月は0円を捏造せずnull(不明)を返す
    expect(snapshot.monthCashflow).toBeNull();
    expect(snapshot.warnings).toContain("今月の入出金: ledgerデータ未投入のため不明");
  });

  it("computes month income/expense once ledger rows exist, instead of guessing", () => {
    root = mkdtempSync(path.join(tmpdir(), "keiei-snapshot-"));
    writeJson(path.join(root, "reports", "2026-08-05-morning.json"), { date: "2026-08-05", bank_balance: 100 });
    const month = new Date().toISOString().slice(0, 7);
    writeJson(path.join(root, "ledger", `${month}.json`), {
      rows: [
        { date: `${month}-01`, direction: "income", amount: 300_000 },
        { date: `${month}-02`, direction: "expense", amount: 120_000 },
      ],
    });

    const snapshot = loadKeieiSnapshot(root);
    if (!snapshot.ok) throw new Error("expected ok:true");
    expect(snapshot.monthCashflow).toEqual({ month, income: 300_000, expense: 120_000 });
  });
});
