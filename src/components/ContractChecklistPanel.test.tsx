import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContractChecklistPanel, DEFAULT_CONTRACT_ITEMS } from "./ContractChecklistPanel.js";
import type { ContractChecklistItem } from "../domain/types.js";

// ── モック ────────────────────────────────────────────────────
const mockFindAll = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

vi.mock("../infra/create-app-repository.js", () => ({
  createAppRepository: () => ({
    findAll: (...args: unknown[]) => mockFindAll(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  }),
}));

// ── ヘルパー ────────────────────────────────────────────────────
function makeItem(overrides: Partial<ContractChecklistItem> = {}): ContractChecklistItem {
  return {
    id: "item-1",
    projectId: "proj-1",
    itemKey: DEFAULT_CONTRACT_ITEMS[0]!.key,
    checked: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ContractChecklistPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-new") });
    mockFindAll.mockResolvedValue([]);
    mockCreate.mockResolvedValue(undefined);
    mockUpdate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("全項目が表示される", async () => {
    render(<ContractChecklistPanel projectId="proj-1" />);

    for (const item of DEFAULT_CONTRACT_ITEMS) {
      expect(await screen.findByLabelText(item.label)).toBeDefined();
    }
  });

  it("初期状態は 0/9 完了と表示される", async () => {
    render(<ContractChecklistPanel projectId="proj-1" />);

    expect(await screen.findByText(`0/${DEFAULT_CONTRACT_ITEMS.length} 完了`)).toBeDefined();
  });

  it("保存済みのチェック済み項目が checked として表示される", async () => {
    const checkedItem = makeItem({ checked: true });
    mockFindAll.mockResolvedValue([checkedItem]);

    render(<ContractChecklistPanel projectId="proj-1" />);

    const checkbox = await screen.findByLabelText(DEFAULT_CONTRACT_ITEMS[0]!.label);
    expect((checkbox as HTMLInputElement).checked).toBe(true);
  });

  it("未保存の項目をクリックすると create が呼ばれる", async () => {
    const user = userEvent.setup();
    render(<ContractChecklistPanel projectId="proj-1" />);

    await screen.findByText(`0/${DEFAULT_CONTRACT_ITEMS.length} 完了`);
    const firstLabel = DEFAULT_CONTRACT_ITEMS[0]!.label;
    await user.click(screen.getByLabelText(firstLabel));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "proj-1",
          itemKey: DEFAULT_CONTRACT_ITEMS[0]!.key,
          checked: true,
        }),
      );
    });
  });

  it("既存レコードをクリックすると update が呼ばれる", async () => {
    const user = userEvent.setup();
    const existing = makeItem({ checked: false });
    mockFindAll.mockResolvedValue([existing]);

    render(<ContractChecklistPanel projectId="proj-1" />);

    await screen.findByLabelText(DEFAULT_CONTRACT_ITEMS[0]!.label);
    await user.click(screen.getByLabelText(DEFAULT_CONTRACT_ITEMS[0]!.label));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith("item-1", { checked: true });
    });
  });

  it("全チェック済みのとき「完了」バッジが表示される", async () => {
    const allChecked = DEFAULT_CONTRACT_ITEMS.map((item, i) =>
      makeItem({ id: `item-${i}`, itemKey: item.key, checked: true }),
    );
    mockFindAll.mockResolvedValue(allChecked);

    render(<ContractChecklistPanel projectId="proj-1" />);

    expect(await screen.findByText("完了")).toBeDefined();
    expect(screen.getByText(`${DEFAULT_CONTRACT_ITEMS.length}/${DEFAULT_CONTRACT_ITEMS.length} 完了`)).toBeDefined();
  });
});
