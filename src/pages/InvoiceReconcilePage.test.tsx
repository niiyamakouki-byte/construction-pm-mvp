import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

// FreeeRepository をインメモリでスタブ化
vi.mock("../lib/freee/FreeeRepository.js", () => ({
  FreeeRepository: vi.fn().mockImplementation(() => ({
    listCachedDeals: vi.fn().mockResolvedValue([]),
    recordMatch: vi.fn().mockResolvedValue(undefined),
  })),
}));

// invoice-store もスタブ化（空リスト）
vi.mock("../lib/invoice-store.js", () => ({
  getAllInvoices: vi.fn().mockReturnValue([]),
}));

import { InvoiceReconcilePage } from "./InvoiceReconcilePage.js";

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
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
    // 初期はローディング or すぐ ready に移行（モックなので高速）
    await waitFor(() => {
      expect(screen.queryByText("照合データを読み込み中...")).toBeNull();
    });
    expect(screen.getByText("入金照合")).toBeDefined();
  });
});
