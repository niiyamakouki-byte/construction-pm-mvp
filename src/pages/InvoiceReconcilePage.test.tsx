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
vi.mock("../lib/invoice-store.js", () => ({
  getAllInvoices: vi.fn().mockReturnValue([]),
  updateInvoiceStatus: (...args: unknown[]) => updateInvoiceStatusMock(...args),
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
});
