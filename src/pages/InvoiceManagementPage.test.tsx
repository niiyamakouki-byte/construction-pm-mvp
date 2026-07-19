import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvoiceManagementPage } from "./InvoiceManagementPage.js";
import { addInvoice, clearInvoices } from "../lib/invoice-store.js";

const mockProjectRepository = {
  findAll: vi.fn(),
};

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => mockProjectRepository,
}));

describe("InvoiceManagementPage", () => {
  beforeEach(() => {
    clearInvoices();
    mockProjectRepository.findAll.mockReset();
    mockProjectRepository.findAll.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it("請求書なしの空状態から登録フォームを開ける", async () => {
    render(<InvoiceManagementPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "請求書がありません" })).toBeDefined();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "請求書を登録" })[0]);

    expect(screen.getByRole("heading", { name: "請求書を登録" })).toBeDefined();
  });

  it("render中のstate update警告を発生させない", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<InvoiceManagementPage />);

    await waitFor(() => expect(mockProjectRepository.findAll).toHaveBeenCalledTimes(1));
    expect(consoleError.mock.calls.flat().join("\n")).not.toMatch(/render|state update/i);
    consoleError.mockRestore();
  });

  it("フィルター適用時に一致なしでフィルター解除ボタンが表示される", async () => {
    // 「確認待ち」の請求書を1件追加
    addInvoice({
      projectId: "proj-1",
      vendorName: "テスト業者",
      amount: 100000,
      tax: 10000,
      total: 110000,
      items: [],
      invoiceDate: "2024-04-01",
      status: "確認待ち",
    });

    render(<InvoiceManagementPage />);

    // 「支払済み」フィルターをクリック（結果0件になるはず）
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "支払済み" })).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "支払済み" }));

    // フィルター適用時の空状態が表示される
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "「支払済み」の請求書がありません" })).toBeDefined();
    });

    // 「フィルターを解除」ボタンが表示される
    expect(screen.getByRole("button", { name: "フィルターを解除" })).toBeDefined();
  });

  it("フィルター解除ボタンを押すと全件表示に戻る", async () => {
    addInvoice({
      projectId: "proj-1",
      vendorName: "テスト業者",
      amount: 50000,
      tax: 5000,
      total: 55000,
      items: [],
      invoiceDate: "2024-04-01",
      status: "確認待ち",
    });

    render(<InvoiceManagementPage />);

    // 「支払済み」フィルターを適用して0件にする
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "支払済み" })).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "支払済み" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "フィルターを解除" })).toBeDefined();
    });

    // フィルター解除
    fireEvent.click(screen.getByRole("button", { name: "フィルターを解除" }));

    // 全件表示に戻り、請求書が表示される
    await waitFor(() => {
      expect(screen.getByText("テスト業者")).toBeDefined();
    });
  });
});
