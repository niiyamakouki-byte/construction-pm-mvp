/**
 * ContractorsPage の UI テスト
 * 業者一覧表示・追加フォーム・削除・検索フィルターを検証する
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContractorsPage } from "../pages/ContractorsPage.js";
import type { Contractor } from "../domain/types.js";

// Mock window.confirm
vi.stubGlobal("confirm", vi.fn(() => true));

// Shared contractor store mock state
let mockContractors: Contractor[] = [];
const mockCreate = vi.fn(async (contractor: Contractor) => {
  mockContractors.push(contractor);
});
const mockFindAll = vi.fn(async () => [...mockContractors]);
const mockDelete = vi.fn(async (id: string) => {
  mockContractors = mockContractors.filter((c) => c.id !== id);
});

vi.mock("../stores/contractor-store.js", () => ({
  createContractorRepository: () => ({
    create: mockCreate,
    findAll: mockFindAll,
    delete: mockDelete,
  }),
}));

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

function makeContractor(overrides: Partial<Contractor> = {}): Contractor {
  const now = new Date().toISOString();
  return {
    id: `c-${Date.now()}-${Math.random()}`,
    name: "田中工務店",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("ContractorsPage", () => {
  beforeEach(() => {
    cleanup();
    mockContractors = [];
    mockCreate.mockClear();
    mockFindAll.mockClear();
    mockDelete.mockClear();
    vi.mocked(confirm).mockReturnValue(true);
  });

  it("ページタイトル「業者管理」が表示される", async () => {
    render(<ContractorsPage />);
    await waitFor(() => expect(screen.getByText("業者管理")).toBeDefined());
  });

  it("「業者を追加」ボタンが存在する", async () => {
    render(<ContractorsPage />);
    await waitFor(() => expect(screen.getByText("業者を追加")).toBeDefined());
  });

  it("業者がいない場合は空状態メッセージが表示される", async () => {
    render(<ContractorsPage />);
    await waitFor(() =>
      expect(screen.getByText("業者が登録されていません")).toBeDefined(),
    );
  });

  it("「業者を追加」クリックでフォームが表示される", async () => {
    const user = userEvent.setup();
    render(<ContractorsPage />);
    await waitFor(() => screen.getByText("業者を追加"));
    await user.click(screen.getByText("業者を追加"));
    expect(screen.getByText("新規業者登録")).toBeDefined();
  });

  it("フォームを再度クリックで閉じられる", async () => {
    const user = userEvent.setup();
    render(<ContractorsPage />);
    await waitFor(() => screen.getByText("業者を追加"));
    await user.click(screen.getByText("業者を追加"));
    expect(screen.getByText("新規業者登録")).toBeDefined();
    await user.click(screen.getByText("業者を追加"));
    expect(screen.queryByText("新規業者登録")).toBeNull();
  });

  it("業者名なしで送信するとエラーなし（required属性で制御）", async () => {
    const user = userEvent.setup();
    render(<ContractorsPage />);
    await waitFor(() => screen.getByText("業者を追加"));
    await user.click(screen.getByText("業者を追加"));
    // required フィールドなので空送信はブラウザで阻止されるため create は呼ばれない
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("業者名を入力して追加すると一覧に表示される", async () => {
    const user = userEvent.setup();
    render(<ContractorsPage />);
    await waitFor(() => screen.getByText("業者を追加"));
    await user.click(screen.getByText("業者を追加"));

    await user.type(
      screen.getByPlaceholderText("会社名・業者名 *"),
      "山田建設",
    );
    await user.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() => expect(screen.getByText("山田建設")).toBeDefined());
  });

  it("業者追加後にフォームがリセットされる", async () => {
    const user = userEvent.setup();
    render(<ContractorsPage />);
    await waitFor(() => screen.getByText("業者を追加"));
    await user.click(screen.getByText("業者を追加"));

    await user.type(screen.getByPlaceholderText("会社名・業者名 *"), "鈴木電気");
    await user.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() => expect(screen.getByText("鈴木電気")).toBeDefined());
    // フォームが閉じられる
    expect(screen.queryByText("新規業者登録")).toBeNull();
  });

  it("業者を追加すると空状態メッセージが消える", async () => {
    const user = userEvent.setup();
    render(<ContractorsPage />);
    await waitFor(() => screen.getByText("業者が登録されていません"));
    await user.click(screen.getByText("業者を追加"));
    await user.type(screen.getByPlaceholderText("会社名・業者名 *"), "佐藤塗装");
    await user.click(screen.getByRole("button", { name: "追加" }));
    await waitFor(() =>
      expect(screen.queryByText("業者が登録されていません")).toBeNull(),
    );
  });

  it("既存業者がいる場合はロード後に一覧表示される", async () => {
    mockContractors = [makeContractor({ id: "c-1", name: "田中工務店" })];
    render(<ContractorsPage />);
    await waitFor(() => expect(screen.getByText("田中工務店")).toBeDefined());
  });

  it("複数業者がリストに表示される", async () => {
    mockContractors = [
      makeContractor({ id: "c-1", name: "田中工務店" }),
      makeContractor({ id: "c-2", name: "山田建設" }),
      makeContractor({ id: "c-3", name: "鈴木電気工事" }),
    ];
    render(<ContractorsPage />);
    await waitFor(() => {
      expect(screen.getByText("田中工務店")).toBeDefined();
      expect(screen.getByText("山田建設")).toBeDefined();
      expect(screen.getByText("鈴木電気工事")).toBeDefined();
    });
  });

  it("検索ボックスで業者を絞り込める", async () => {
    mockContractors = [
      makeContractor({ id: "c-1", name: "田中工務店" }),
      makeContractor({ id: "c-2", name: "山田建設" }),
    ];
    const user = userEvent.setup();
    render(<ContractorsPage />);
    await waitFor(() => screen.getByText("田中工務店"));

    await user.type(screen.getByPlaceholderText("業者名・専門工種で検索..."), "田中");
    expect(screen.getByText("田中工務店")).toBeDefined();
    expect(screen.queryByText("山田建設")).toBeNull();
  });

  it("検索クリアで全業者が再表示される", async () => {
    mockContractors = [
      makeContractor({ id: "c-1", name: "田中工務店" }),
      makeContractor({ id: "c-2", name: "山田建設" }),
    ];
    const user = userEvent.setup();
    render(<ContractorsPage />);
    await waitFor(() => screen.getByText("田中工務店"));

    const searchInput = screen.getByPlaceholderText("業者名・専門工種で検索...");
    await user.type(searchInput, "田中");
    expect(screen.queryByText("山田建設")).toBeNull();

    await user.clear(searchInput);
    expect(screen.getByText("山田建設")).toBeDefined();
  });

  it("削除確認で業者が削除される", async () => {
    mockContractors = [makeContractor({ id: "c-del", name: "削除予定業者" })];
    const user = userEvent.setup();
    render(<ContractorsPage />);
    await waitFor(() => screen.getByText("削除予定業者"));

    const deleteButton = screen.getByRole("button", { name: /を削除/ });
    await user.click(deleteButton);

    await waitFor(() =>
      expect(screen.queryByText("削除予定業者")).toBeNull(),
    );
    expect(mockDelete).toHaveBeenCalledWith("c-del");
  });

  it("削除キャンセルでは業者が残る", async () => {
    vi.mocked(confirm).mockReturnValue(false);
    mockContractors = [makeContractor({ id: "c-keep", name: "残す業者" })];
    const user = userEvent.setup();
    render(<ContractorsPage />);
    await waitFor(() => screen.getByText("残す業者"));

    const deleteButton = screen.getByRole("button", { name: /を削除/ });
    await user.click(deleteButton);

    expect(screen.getByText("残す業者")).toBeDefined();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("createが失敗した場合にエラーメッセージが表示される", async () => {
    mockCreate.mockRejectedValueOnce(new Error("登録に失敗しました"));
    const user = userEvent.setup();
    render(<ContractorsPage />);
    await waitFor(() => screen.getByText("業者を追加"));
    await user.click(screen.getByText("業者を追加"));
    await user.type(screen.getByPlaceholderText("会社名・業者名 *"), "エラー業者");
    await user.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("登録に失敗しました");
    });
  });
});
