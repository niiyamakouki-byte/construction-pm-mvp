import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvoicePage } from "./InvoicePage.js";

const mockProjectFindAll = vi.fn();
const mockAddInvoice = vi.fn();

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

// p94s2: OCR結果は請求書ハブ(invoice-store)の「確認待ち」レコードへ合流する
vi.mock("../lib/invoice-store.js", () => ({
  addInvoice: (...args: unknown[]) => mockAddInvoice(...args),
}));

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => ({
    findAll: mockProjectFindAll,
  }),
}));

vi.mock("../lib/invoice-vision.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/invoice-vision.js")>()),
  extractInvoiceFromFile: vi.fn().mockResolvedValue({
    vendor: "テスト工務店",
    total: 12000,
    issue_date: "2026-07-12",
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockProjectFindAll.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe("InvoicePage", () => {
  it("shows invalid file errors as dismissible alerts", async () => {
    const { container } = render(<InvoicePage />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: {
        files: [new File(["plain text"], "invoice.txt", { type: "text/plain" })],
      },
    });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("画像ファイル（JPG/PNG）またはPDFを選択してください");

    fireEvent.click(screen.getByRole("button", { name: "エラーを閉じる" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("案件が1件も無いとき登録で日本語の案内を出す", async () => {
    mockProjectFindAll.mockResolvedValue([]);
    const { container } = render(<InvoicePage />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(["pdf"], "invoice.pdf", { type: "application/pdf" })] },
    });

    const saveButton = await screen.findByRole("button", { name: "請求書として登録" });
    fireEvent.click(saveButton);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("請求書の保存先となる案件がありません");
    expect(mockAddInvoice).not.toHaveBeenCalled();
  });

  it("案件があるとき OCR結果を請求書ハブの確認待ちレコードとして登録する", async () => {
    mockProjectFindAll.mockResolvedValue([{ id: "proj-1", name: "テスト案件" }]);
    const { container } = render(<InvoicePage />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(["pdf"], "invoice.pdf", { type: "application/pdf" })] },
    });

    const saveButton = await screen.findByRole("button", { name: "請求書として登録" });
    fireEvent.click(saveButton);

    await screen.findByText("請求書管理の「確認待ち」に登録しました");
    expect(mockAddInvoice).toHaveBeenCalledTimes(1);
    expect(mockAddInvoice.mock.calls[0][0]).toMatchObject({
      projectId: "proj-1",
      vendorName: "テスト工務店",
      total: 12000,
      status: "確認待ち",
    });
  });
});
