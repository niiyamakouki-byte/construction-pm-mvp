import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { OrderManagementPage } from "./OrderManagementPage.js";
import { OrganizationContext } from "../contexts/OrganizationContext.js";
import type { UserRole } from "../lib/user-roles.js";

const { mockListByProjectAsync, mockSaveAsync, mockDeleteAsync } = vi.hoisted(() => ({
  mockListByProjectAsync: vi.fn().mockResolvedValue([]),
  mockSaveAsync: vi.fn().mockResolvedValue(undefined),
  mockDeleteAsync: vi.fn().mockResolvedValue(undefined),
}));

function renderWithRole(role: UserRole) {
  return render(
    <OrganizationContext.Provider
      value={{ organization: null, organizationId: "org-test", role, loading: false }}
    >
      <OrderManagementPage projectId="p-test" />
    </OrganizationContext.Provider>,
  );
}

vi.mock("../lib/supabase-adapter/OrderRepository.js", () => ({
  orderRepository: {
    listByProjectAsync: mockListByProjectAsync,
    saveAsync: mockSaveAsync,
    deleteAsync: mockDeleteAsync,
  },
}));

vi.mock("../lib/order-management.js", () => ({
  getNextStatuses: vi.fn().mockReturnValue([]),
}));

vi.mock("../stores/task-store.js", () => ({
  createTaskRepository: () => ({ findAll: vi.fn().mockResolvedValue([]) }),
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

describe("OrderManagementPage — summary card colors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListByProjectAsync.mockResolvedValue([]);
  });

  afterEach(cleanup);

  it("ig46g: uses neutral cards with sage reserved for the paid count", async () => {
    render(<OrderManagementPage projectId="p-test" />);

    await screen.findByText("総発注数");

    for (const label of ["総発注数", "進行中", "未払合計"]) {
      const card = screen.getByText(label).parentElement;
      expect(card?.className).toContain("bg-white");
      expect(card?.className).not.toMatch(/bg-(amber|blue)-50/);
    }

    expect(screen.getByText("支払済").parentElement?.className).toContain("bg-brand-50");
  });
});

describe("OrderManagementPage — 納期変更UI", () => {
  const EXISTING_ORDER = {
    id: "o-1",
    projectId: "p-test",
    contractorId: "c-1",
    contractorName: "山田内装工業",
    items: [],
    status: "下書き" as const,
    orderDate: "2026-08-01",
    deliveryDate: "2026-08-10",
    totalAmount: 0,
    taxAmount: 0,
    totalWithTax: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockListByProjectAsync.mockResolvedValue([EXISTING_ORDER]);
  });

  afterEach(() => {
    cleanup();
  });

  it("既存発注の納期を編集して保存すると repository.saveAsync に新しいdeliveryDateが渡る", async () => {
    render(<OrderManagementPage projectId="p-test" />);
    await screen.findByText("山田内装工業");

    fireEvent.click(screen.getByRole("button", { name: /山田内装工業 — 納期を変更/ }));
    await screen.findByText("納期を変更");

    const input = screen.getByLabelText("納期");
    fireEvent.change(input, { target: { value: "2026-09-01" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await vi.waitFor(() => {
      expect(mockSaveAsync).toHaveBeenCalledWith(
        expect.objectContaining({ id: "o-1", deliveryDate: "2026-09-01" }),
      );
    });
  });
});

describe("OrderManagementPage — RBAC", () => {
  const EXISTING_ORDER = {
    id: "o-rbac",
    projectId: "p-test",
    contractorId: "c-1",
    contractorName: "山田内装工業",
    items: [],
    status: "下書き" as const,
    orderDate: "2026-08-01",
    deliveryDate: "2026-08-10",
    totalAmount: 0,
    taxAmount: 0,
    totalWithTax: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockListByProjectAsync.mockResolvedValue([EXISTING_ORDER]);
    const { getNextStatuses } = await import("../lib/order-management.js");
    vi.mocked(getNextStatuses).mockReturnValue(["発注済"]);
  });

  afterEach(cleanup);

  it("viewer権限では発注作成とステータス変更を実行できない", async () => {
    renderWithRole("viewer");
    const createButton = await screen.findByRole("button", { name: "+ 発注書作成" });
    const transitionButton = await screen.findByRole("button", { name: "→ 発注済" });

    expect((createButton as HTMLButtonElement).disabled).toBe(true);
    expect((transitionButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(createButton);
    fireEvent.click(transitionButton);
    expect(screen.queryByText("発注書作成", { selector: "h2" })).toBeNull();
    expect(mockSaveAsync).not.toHaveBeenCalled();
  });

  it("admin権限では発注作成とステータス変更を実行できる", async () => {
    renderWithRole("admin");
    const createButton = await screen.findByRole("button", { name: "+ 発注書作成" });
    const transitionButton = await screen.findByRole("button", { name: "→ 発注済" });

    expect((createButton as HTMLButtonElement).disabled).toBe(false);
    expect((transitionButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(createButton);
    expect(await screen.findByText("発注書作成", { selector: "h2" })).toBeDefined();
    fireEvent.click(transitionButton);
    await vi.waitFor(() => expect(mockSaveAsync).toHaveBeenCalledTimes(1));
  });
});
