import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvoicePage } from "./InvoicePage.js";

const mockProjectFindAll = vi.fn();
const mockExpenseCreate = vi.fn();

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

vi.mock("../infra/create-app-repository.js", () => ({
  createAppRepository: () => ({
    create: mockExpenseCreate,
  }),
}));

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => ({
    findAll: mockProjectFindAll,
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
});
