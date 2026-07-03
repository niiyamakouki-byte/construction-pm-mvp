import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { OrderManagementPage } from "./OrderManagementPage.js";

const { mockListByProjectAsync, mockSaveAsync, mockDeleteAsync } = vi.hoisted(() => ({
  mockListByProjectAsync: vi.fn().mockResolvedValue([]),
  mockSaveAsync: vi.fn().mockResolvedValue(undefined),
  mockDeleteAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/supabase-adapter/OrderRepository.js", () => ({
  OrderRepository: vi.fn().mockImplementation(() => ({
    listByProjectAsync: mockListByProjectAsync,
    saveAsync: mockSaveAsync,
    deleteAsync: mockDeleteAsync,
  })),
}));

vi.mock("../lib/order-management.js", () => ({
  getNextStatuses: vi.fn().mockReturnValue([]),
}));

vi.mock("../components/common/ConfirmDialog.js", () => ({
  ConfirmDialog: () => null,
}));

describe("OrderManagementPage — ItemRow aria-labels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListByProjectAsync.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  async function openOrderForm() {
    render(<OrderManagementPage projectId="p-test" />);
    // wait for load
    await screen.findByText("+ 発注書作成");
    fireEvent.click(screen.getByText("+ 発注書作成"));
    await screen.findByText("発注書作成");
  }

  it("first ItemRow controls have aria-labels", async () => {
    await openOrderForm();
    // The row starts with empty item.name so label falls back to 品目1
    expect(screen.getByRole("combobox", { name: /品目1.*品目選択/ })).toBeDefined();
    expect(screen.getByRole("spinbutton", { name: /品目1.*数量/ })).toBeDefined();
    expect(screen.getByRole("spinbutton", { name: /品目1.*単価/ })).toBeDefined();
  });

  it("second ItemRow gets distinct aria-labels after adding a row", async () => {
    await openOrderForm();
    fireEvent.click(screen.getByText("+ 品目追加"));
    const quantityInputs = screen.getAllByRole("spinbutton", { name: /数量/ });
    expect(quantityInputs.length).toBe(2);
    // Each should have a unique aria-label
    const labels = quantityInputs.map((el) => el.getAttribute("aria-label"));
    expect(labels[0]).not.toBe(labels[1]);
  });

  it("品目名 textbox has aria-label", async () => {
    await openOrderForm();
    const nameInputs = screen.getAllByRole("textbox", { name: /品目名/ });
    expect(nameInputs.length).toBeGreaterThan(0);
  });
});
