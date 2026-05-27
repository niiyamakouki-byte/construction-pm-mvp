import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvoiceManagementPage } from "./InvoiceManagementPage.js";
import { clearInvoices } from "../lib/invoice-store.js";

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

    fireEvent.click(screen.getByRole("button", { name: "請求書を登録" }));

    expect(screen.getByRole("heading", { name: "請求書登録" })).toBeDefined();
  });
});
