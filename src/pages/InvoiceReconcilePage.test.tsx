import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// FreeeRepository をインメモリでスタブ化
const repoMocks = {
  listCachedDeals: vi.fn().mockResolvedValue([]),
  recordMatch: vi.fn().mockResolvedValue(undefined),
  upsertDeals: vi.fn().mockResolvedValue(undefined),
};
vi.mock("../lib/freee/FreeeRepository.js", () => ({
  FreeeRepository: vi.fn().mockImplementation(() => repoMocks),
}));

// invoice-store もスタブ化（空リスト）
const updateInvoiceStatusMock = vi.fn();
const getInvoiceMock = vi.fn();
vi.mock("../lib/invoice-store.js", () => ({
  getAllInvoices: vi.fn().mockReturnValue([]),
  updateInvoiceStatus: (...args: unknown[]) => updateInvoiceStatusMock(...args),
  getInvoice: (...args: unknown[]) => getInvoiceMock(...args),
}));

// notifications モック（pushPaymentConfirmedNotification の呼び出しを記録）
const pushPaymentConfirmedNotificationMock = vi.fn();
vi.mock("../lib/notifications.js", () => ({
  pushPaymentConfirmedNotification: (...args: unknown[]) =>
    pushPaymentConfirmedNotificationMock(...args),
}));

// Supabase クライアントもスタブ化（ログイン済みトークンを返す）
vi.mock("../infra/supabase-client.js", () => ({
  hasSupabaseEnv: () => true,
  getSupabaseClient: () =>
    Promise.resolve({
      auth: {
        getSession: () =>
          Promise.resolve({ data: { session: { access_token: "test-token" } } }),
      },
    }),
}));

import {
  InvoiceReconcilePage,
  freeeDealToMatchingDeal,
} from "./InvoiceReconcilePage.js";

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  repoMocks.listCachedDeals.mockResolvedValue([]);
  repoMocks.recordMatch.mockResolvedValue(undefined);
  repoMocks.upsertDeals.mockResolvedValue(undefined);
});

describe("InvoiceReconcilePage", () => {
  it("renders page heading", async () => {
    render(<InvoiceReconcilePage />);
    await waitFor(() => {
      expect(screen.getByText("入金照合")).toBeDefined();
    });
  });

  it("shows freee 入金照合 panel after load", async () => {
    render(<InvoiceReconcilePage />);
    await waitFor(() => {
      expect(screen.getByText("freee 入金照合")).toBeDefined();
    });
  });

  it("shows loading state initially then transitions to ready", async () => {
    render(<InvoiceReconcilePage />);
    await waitFor(() => {
      expect(screen.queryByText("照合データを読み込み中...")).toBeNull();
    });
    expect(screen.getByText("入金照合")).toBeDefined();
  });

  it("freee 同期ボタンが /api/freee/deals を呼び upsertDeals に渡す", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/api/freee/companies")) {
        return new Response(JSON.stringify({ companies: [{ id: 42, name: "test", role: "admin" }] }), {
          status: 200,
        });
      }
      if (url.includes("/api/freee/deals")) {
        return new Response(
          JSON.stringify({
            deals: [
              {
                id: 7,
                company_id: 42,
                issue_date: "2026-06-01",
                amount: 330_000,
                partner_name: "山田建設",
                status: "settled",
                type: "income",
                details: [],
              },
            ],
            meta: { total_count: 1 },
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<InvoiceReconcilePage />);
    await waitFor(() => expect(screen.getByText("freee 入金照合")).toBeDefined());

    await user.click(screen.getByRole("button", { name: /freee 同期/ }));

    await waitFor(() => {
      expect(repoMocks.upsertDeals).toHaveBeenCalled();
    });
    const [, companyId, deals] = repoMocks.upsertDeals.mock.calls[0]!;
    expect(companyId).toBe(42);
    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({ id: 7, amount: 330_000 });

    vi.unstubAllGlobals();
  });

  it("freee 401 で連携が必要バナーを表示する", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<InvoiceReconcilePage />);
    await waitFor(() => expect(screen.getByText("freee 入金照合")).toBeDefined());

    await user.click(screen.getByRole("button", { name: /freee 同期/ }));

    await waitFor(() => {
      expect(screen.getByText("freee 連携が必要です")).toBeDefined();
    });

    vi.unstubAllGlobals();
  });

  it("freeeDealToMatchingDeal: Deal の必須フィールドを引き継ぐ", () => {
    const mapped = freeeDealToMatchingDeal({
      id: 1,
      company_id: 99,
      issue_date: "2026-06-01",
      amount: 100,
      partner_name: "X",
      ref_number: "INV-2026",
      status: "settled",
      type: "income",
      details: [],
    });
    expect(mapped).toEqual({
      id: 1,
      issue_date: "2026-06-01",
      amount: 100,
      partner_name: "X",
      ref_number: "INV-2026",
      status: "settled",
    });
  });

  it("照合確定で pushPaymentConfirmedNotification が呼ばれる", async () => {
    const user = userEvent.setup();
    const testInvoice = {
      id: "inv-99",
      projectId: "p-1",
      vendorName: "山田建設",
      amount: 300_000,
      tax: 30_000,
      total: 330_000,
      items: [],
      invoiceDate: "2026-06-01",
      status: "振込予定" as const,
    };
    // getAllInvoices が請求書1件を返す
    const { getAllInvoices } = await import("../lib/invoice-store.js");
    vi.mocked(getAllInvoices).mockReturnValue([testInvoice]);
    // getInvoice も同じ請求書を返す
    getInvoiceMock.mockReturnValue(testInvoice);
    // listCachedDeals が金額一致の freee deal を返す（スコア >= 0.7 で matched になる）
    repoMocks.listCachedDeals.mockResolvedValue([
      {
        id: 7,
        issue_date: "2026-06-01",
        amount: 330_000,
        partner_name: "山田建設",
        ref_number: null,
        status: "settled",
      },
    ]);

    render(<InvoiceReconcilePage />);
    await waitFor(() => expect(screen.getByText("freee 入金照合")).toBeDefined());

    const confirmButton = await screen.findByRole("button", { name: /確定/ });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(pushPaymentConfirmedNotificationMock).toHaveBeenCalledTimes(1);
    });
    expect(pushPaymentConfirmedNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: "inv-99",
        vendorName: "山田建設",
        amount: 330_000,
      }),
    );
  });

  it("照合確定が失敗した場合は pushPaymentConfirmedNotification が呼ばれない", async () => {
    const user = userEvent.setup();
    const testInvoice = {
      id: "inv-err",
      projectId: "p-1",
      vendorName: "エラー建設",
      amount: 100_000,
      tax: 10_000,
      total: 110_000,
      items: [],
      invoiceDate: "2026-06-01",
      status: "振込予定" as const,
    };
    const { getAllInvoices } = await import("../lib/invoice-store.js");
    vi.mocked(getAllInvoices).mockReturnValue([testInvoice]);
    getInvoiceMock.mockReturnValue(testInvoice);
    repoMocks.listCachedDeals.mockResolvedValue([
      {
        id: 8,
        issue_date: "2026-06-01",
        amount: 110_000,
        partner_name: "エラー建設",
        ref_number: null,
        status: "settled",
      },
    ]);
    // recordMatch を失敗させる
    repoMocks.recordMatch.mockRejectedValue(new Error("DB error"));

    render(<InvoiceReconcilePage />);
    await waitFor(() => expect(screen.getByText("freee 入金照合")).toBeDefined());

    const confirmButton = await screen.findByRole("button", { name: /確定/ });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeDefined();
    });
    expect(pushPaymentConfirmedNotificationMock).not.toHaveBeenCalled();
  });
});
