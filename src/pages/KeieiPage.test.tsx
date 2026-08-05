import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { KeieiPage } from "./KeieiPage.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubFetch(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) }),
  );
}

describe("KeieiPage", () => {
  it("shows a guidance message instead of a blank screen when the local dev bridge is unreachable", async () => {
    stubFetch(null, false);
    render(<KeieiPage />);
    expect(await screen.findByText(/ローカル環境でのみ表示できます/)).toBeDefined();
  });

  it("shows guidance (not a blank screen) when no keiei report has ever been generated", async () => {
    stubFetch({ ok: false, reason: "経営レポートが見つかりません" });
    render(<KeieiPage />);
    expect(await screen.findByText("経営データがまだありません")).toBeDefined();
    expect(screen.getByText("経営レポートが見つかりません")).toBeDefined();
  });

  it("renders real balance as plain text and runway as a visually distinct 予測 badge, plus the data-quality warning", async () => {
    stubFetch({
      ok: true,
      asOf: "2026-08-05",
      bankBalance: 1_239_279,
      runway: {
        worst: { months: 0.6, exhaustedOn: "2026-08-21", assumption: "固定費を日割りで一定支出と仮定" },
        best: { months: 0.6, exhaustedOn: "2026-08-21", assumption: "固定費を日割りで一定支出と仮定" },
        historical: null,
      },
      receivables: {
        count: 1,
        total: 2_282_500,
        rows: [{ client: "ビルドライフ木村様", title: "解体工事", amount: 2_282_500, dueDate: "2026-08-31", invoiceNumber: "INV-1" }],
      },
      monthCashflow: null,
      dataQuality: { unregisteredWalletTxns: 628, asOf: "2026-08-05", note: "3口座90日窓" },
      warnings: [],
    });
    render(<KeieiPage />);

    await waitFor(() => expect(screen.getByText("￥1,239,279")).toBeDefined());
    // 予測バッジが独立して存在する = 見た目で実績と区別されている
    expect(screen.getAllByText("予測").length).toBeGreaterThan(0);
    expect(screen.getByText(/未登録取引 628件/)).toBeDefined();
    expect(screen.getByText("ビルドライフ木村様")).toBeDefined();
    expect(screen.getByText(/不明（データ未投入）/)).toBeDefined();
  });
});
