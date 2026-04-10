import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  generateEstimate: vi.fn(),
  generateEstimatePdf: vi.fn(),
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

  it("削除ボタンで選択済み品目を取り除ける", async () => {
    const user = userEvent.setup();
    await renderEstimatePage();

    await user.click(screen.getByRole("button", { name: /解体・撤去/ }));
    await user.click(screen.getByRole("button", { name: /内装解体（木造）/ }));

    const row = getSelectedRow("内装解体（木造）");
    const removeButton = within(row).getAllByRole("button")[2];
    await user.click(removeButton);

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
    expect(screen.getByText("¥8,894")).toBeDefined();
    expect(screen.getByRole("button", { name: "PDF出力" })).toBeDefined();
    expect(mocks.generateEstimatePdf).not.toHaveBeenCalled();
  });
});
