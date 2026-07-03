import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  generateEstimate: vi.fn(),
  generateEstimatePdf: vi.fn(),
  projectFindAll: vi.fn(),
}));

vi.mock("../estimate/estimate-generator.js", async () => {
  const actual = await vi.importActual<typeof import("../estimate/estimate-generator.js")>(
    "../estimate/estimate-generator.js",
  );

  mocks.generateEstimate.mockImplementation(actual.generateEstimate);

  return {
    ...actual,
    generateEstimate: mocks.generateEstimate,
  };
});

vi.mock("../estimate/pdf-estimate.js", () => ({
  generateEstimatePdf: mocks.generateEstimatePdf,
}));

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => ({ findAll: mocks.projectFindAll }),
}));

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

async function renderEstimatePage() {
  const { EstimatePage } = await import("../pages/EstimatePage.js");
  render(<EstimatePage />);
  await screen.findByText("品目カタログ");
}

function getSelectedSection() {
  const heading = screen.getByText(/選択済み品目/);
  const section = heading.parentElement;
  if (!section) {
    throw new Error("選択済み品目セクションが見つかりません");
  }
  return section;
}

function getSelectedRow(itemName: string) {
  const row = within(getSelectedSection()).getByText(itemName).closest("li");
  if (!row) {
    throw new Error(`選択済み品目 ${itemName} の行が見つかりません`);
  }
  return row as HTMLElement;
}

describe("EstimatePage", () => {
  beforeEach(() => {
    cleanup();
    vi.resetModules();
    mocks.generateEstimate.mockClear();
    mocks.generateEstimatePdf.mockReset();
    mocks.projectFindAll.mockReset();
    mocks.projectFindAll.mockResolvedValue([]);
    vi.doUnmock("react");
  });

  it("初期表示で見積作成フォームと品目カタログが表示される", async () => {
    await renderEstimatePage();

    expect(screen.getByLabelText(/物件名/)).toBeDefined();
    expect(screen.getByLabelText(/お客様名/)).toBeDefined();
    expect(screen.getByText("品目カタログ")).toBeDefined();
    expect(screen.queryByText(/選択済み品目/)).toBeNull();
  });

  it("カテゴリを開閉すると品目一覧の表示が切り替わる", async () => {
    const user = userEvent.setup();
    await renderEstimatePage();

    const categoryButton = screen.getByRole("button", { name: /解体・撤去/ });
    expect(screen.queryByText("内装解体（木造）")).toBeNull();

    await user.click(categoryButton);
    expect(screen.getByText("内装解体（木造）")).toBeDefined();

    await user.click(categoryButton);
    expect(screen.queryByText("内装解体（木造）")).toBeNull();
  });

  it("品目を追加すると選択済み一覧に表示され、同じ品目の再追加で数量が増える", async () => {
    const user = userEvent.setup();
    await renderEstimatePage();

    await user.click(screen.getByRole("button", { name: /解体・撤去/ }));
    const itemButton = screen.getByRole("button", { name: /内装解体（木造）/ });

    await user.click(itemButton);
    await waitFor(() => expect(screen.getByText("選択済み品目 (1件)")).toBeDefined());

    const quantityInput = within(getSelectedRow("内装解体（木造）")).getByRole("spinbutton");
    expect((quantityInput as HTMLInputElement).value).toBe("1");

    await user.click(itemButton);
    expect((within(getSelectedRow("内装解体（木造）")).getByRole("spinbutton") as HTMLInputElement).value).toBe("2");
  });

  it("数量変更ボタンと入力欄で数量を更新できる", async () => {
    const user = userEvent.setup();
    await renderEstimatePage();

    await user.click(screen.getByRole("button", { name: /解体・撤去/ }));
    await user.click(screen.getByRole("button", { name: /内装解体（木造）/ }));

    const row = getSelectedRow("内装解体（木造）");
    const buttons = within(row).getAllByRole("button");
    const minusButton = buttons[0];
    const plusButton = buttons[1];
    const quantityInput = within(row).getByRole("spinbutton") as HTMLInputElement;

    await user.click(plusButton);
    expect(quantityInput.value).toBe("2");

    fireEvent.change(quantityInput, { target: { value: "5" } });
    expect(quantityInput.value).toBe("5");

    await user.click(minusButton);
    expect(quantityInput.value).toBe("4");
  });

  it("削除確認で選択済み品目の削除キャンセルと承諾を分岐する", async () => {
    const user = userEvent.setup();
    await renderEstimatePage();

    await user.click(screen.getByRole("button", { name: /解体・撤去/ }));
    await user.click(screen.getByRole("button", { name: /内装解体（木造）/ }));

    const row = getSelectedRow("内装解体（木造）");
    const removeButton = within(row).getByRole("button", { name: "内装解体（木造）を削除" });
    await user.click(removeButton);

    expect(screen.getByRole("alertdialog", { name: "見積品目を削除" })).toBeDefined();
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.getByText("選択済み品目 (1件)")).toBeDefined();

    await user.click(within(getSelectedRow("内装解体（木造）")).getByRole("button", { name: "内装解体（木造）を削除" }));
    await user.click(screen.getByRole("button", { name: "削除する" }));
    await waitFor(() => expect(screen.queryByText(/選択済み品目/)).toBeNull());
  });

  it("物件名が空のまま生成するとバリデーションエラーが表示される", async () => {
    const user = userEvent.setup();
    await renderEstimatePage();

    await user.click(screen.getByRole("button", { name: /解体・撤去/ }));
    await user.click(screen.getByRole("button", { name: /内装解体（木造）/ }));
    await user.click(screen.getByRole("button", { name: "見積書を生成" }));

    await waitFor(() =>
      expect(screen.getByText("物件名を入力してください")).toBeDefined(),
    );
    expect(mocks.generateEstimate).not.toHaveBeenCalled();
  });

  it("選択品目が空の状態で生成するとバリデーションエラーが表示される", async () => {
    vi.resetModules();

    let hasSelectedItems = true;
    const actualReact = await vi.importActual<typeof import("react")>("react");

    vi.doMock("react", () => ({
      ...actualReact,
      useState<T>(initial: T) {
        if (Array.isArray(initial)) {
          const selectedItems = new Proxy([] as unknown[], {
            get(target, property, receiver) {
              if (property === "length") {
                return hasSelectedItems ? 1 : 0;
              }
              return Reflect.get(target, property, receiver);
            },
          });
          return [selectedItems as T, vi.fn()] as [T, (value: T) => void];
        }

        return actualReact.useState(initial);
      },
    }));

    const { EstimatePage } = await import("../pages/EstimatePage.js");
    const user = userEvent.setup();

    render(<EstimatePage />);
    await screen.findByText("品目カタログ");

    await user.type(screen.getByLabelText(/物件名/), "テスト物件");
    hasSelectedItems = false;
    await user.click(screen.getByRole("button", { name: "見積書を生成" }));

    await waitFor(() =>
      expect(screen.getByText("品目を1つ以上追加してください")).toBeDefined(),
    );
  });

  it("見積作成タブのファーストビューにPDF CTAヒーローが表示される", async () => {
    await renderEstimatePage();

    const hero = screen.getByTestId("pdf-cta-hero");
    expect(hero).toBeDefined();
    expect(hero.textContent).toContain("図面 PDF をドロップするだけで概算見積を自動作成");

    const ctaButton = screen.getByTestId("pdf-cta-button");
    expect(ctaButton).toBeDefined();
    expect(ctaButton.textContent).toContain("PDF で見積作成");
  });

  it("入力内容から見積を生成して結果画面を表示する", async () => {
    const user = userEvent.setup();
    await renderEstimatePage();

    await user.type(screen.getByLabelText(/物件名/), "  渋谷オフィス改修工事  ");
    await user.type(screen.getByLabelText(/お客様名/), "  株式会社テスト  ");

    await user.click(screen.getByRole("button", { name: /解体・撤去/ }));
    const itemButton = screen.getByRole("button", { name: /内装解体（木造）/ });
    await user.click(itemButton);
    await user.click(itemButton);

    await user.click(screen.getByRole("button", { name: "見積書を生成" }));

    await waitFor(() =>
      expect(mocks.generateEstimate).toHaveBeenCalledWith({
        propertyName: "渋谷オフィス改修工事",
        clientName: "株式会社テスト",
        items: [{ code: "DM-001", quantity: 2 }],
      }),
    );

    await waitFor(() => expect(screen.getByText("御見積書")).toBeDefined());
    expect(screen.getByText("渋谷オフィス改修工事")).toBeDefined();
    expect(screen.getByText(/株式会社テスト 様/)).toBeDefined();
    expect(screen.getByText("解体・撤去")).toBeDefined();
    expect(screen.getByText("内装解体（木造）")).toBeDefined();
    expect(screen.getByText("¥10,164")).toBeDefined();
    expect(screen.getByRole("button", { name: "PDF出力" })).toBeDefined();
    expect(mocks.generateEstimatePdf).not.toHaveBeenCalled();

    // 概算注記が表示される
    const disclaimer = screen.getByTestId("estimate-disclaimer");
    expect(disclaimer).toBeDefined();
    expect(disclaimer.textContent).toContain("±20%");
  });

  it("案件を選ぶセレクトで案件を選択すると物件名が自動入力される", async () => {
    mocks.projectFindAll.mockResolvedValue([
      {
        id: "proj-1",
        name: "渋谷ワインバー",
        description: "",
        status: "active",
        startDate: "2026-01-01",
        includeWeekends: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const user = userEvent.setup();
    await renderEstimatePage();

    const select = await screen.findByLabelText(/案件を選ぶ/);
    await user.selectOptions(select, "proj-1");

    const propertyInput = screen.getByLabelText(/物件名/) as HTMLInputElement;
    await waitFor(() => expect(propertyInput.value).toBe("渋谷ワインバー"));
  });

  it("案件を選んで見積生成すると結果画面ヘッダーに案件名が表示される", async () => {
    mocks.projectFindAll.mockResolvedValue([
      {
        id: "proj-2",
        name: "南青山リノベ案件",
        description: "",
        status: "active",
        startDate: "2026-01-01",
        includeWeekends: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const user = userEvent.setup();
    await renderEstimatePage();

    const select = await screen.findByLabelText(/案件を選ぶ/);
    await user.selectOptions(select, "proj-2");

    await user.click(screen.getByRole("button", { name: /解体・撤去/ }));
    await user.click(screen.getByRole("button", { name: /内装解体（木造）/ }));

    await user.click(screen.getByRole("button", { name: "見積書を生成" }));

    await waitFor(() => expect(screen.getByText("御見積書")).toBeDefined());
    const linked = screen.getByTestId("estimate-linked-project");
    expect(linked.textContent).toContain("案件: 南青山リノベ案件");
  });

  it("案件が0件のときは案件選択セレクトを表示しない", async () => {
    mocks.projectFindAll.mockResolvedValue([]);
    await renderEstimatePage();
    expect(screen.queryByLabelText(/案件を選ぶ/)).toBeNull();
  });
});
