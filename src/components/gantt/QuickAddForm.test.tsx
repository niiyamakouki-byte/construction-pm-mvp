import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { describe, expect, it, vi } from "vitest";
import { QuickAddForm } from "./QuickAddForm.js";
import type { QuickAddState } from "./types.js";

const baseState: QuickAddState = {
  projectId: "p1",
  projectName: "テストプロジェクト",
  projectIncludesWeekends: true,
  name: "",
  startDate: "2025-01-01",
  dueDate: "2025-01-03",
  contractorId: "",
  status: "todo",
  submitting: false,
  selectedCategory: "",
  majorCategory: "",
  middleCategory: "",
  minorCategory: "",
  categorySearch: "",
};

function getMajorSelect(container: HTMLElement) {
  const label = Array.from(container.querySelectorAll("label")).find(
    (l) => l.querySelector("span")?.textContent === "大項目",
  );
  return label?.querySelector("select") as HTMLSelectElement;
}

function getMiddleSelect(container: HTMLElement) {
  const label = Array.from(container.querySelectorAll("label")).find(
    (l) => l.querySelector("span")?.textContent === "中項目",
  );
  return label?.querySelector("select") as HTMLSelectElement;
}

function getMinorSelect(container: HTMLElement) {
  const label = Array.from(container.querySelectorAll("label")).find(
    (l) => l.querySelector("span")?.textContent === "小項目",
  );
  return label?.querySelector("select") as HTMLSelectElement;
}

afterEach(() => cleanup());

describe("QuickAddForm - カテゴリ3階層UI", () => {
  it("大項目プルダウンに13大項目が表示される", () => {
    const { container } = render(
      <QuickAddForm
        quickAdd={baseState}
        contractors={[]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    const select = getMajorSelect(container);
    expect(select).toBeTruthy();
    // 「選択...」を含めて14以上のoption
    expect(select.options.length).toBeGreaterThanOrEqual(14);
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toContain("電気工事");
    expect(optionValues).toContain("仮設工事");
    expect(optionValues).toContain("検査");
  });

  it("大項目未選択時は中項目・小項目がdisabled", () => {
    const { container } = render(
      <QuickAddForm
        quickAdd={baseState}
        contractors={[]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(getMiddleSelect(container).disabled).toBe(true);
    expect(getMinorSelect(container).disabled).toBe(true);
  });

  it("大項目選択でonChangeが呼ばれmajorCategoryが更新される", () => {
    const onChange = vi.fn();
    const { container } = render(
      <QuickAddForm
        quickAdd={baseState}
        contractors={[]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onChange={onChange}
      />,
    );
    const select = getMajorSelect(container);
    fireEvent.change(select, { target: { value: "電気工事" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const updaterFn = onChange.mock.calls[0][0];
    const result = updaterFn(baseState);
    expect(result.majorCategory).toBe("電気工事");
    expect(result.middleCategory).toBe("");
    expect(result.minorCategory).toBe("");
  });

  it("大項目選択済みで中項目プルダウンがactiveになる", () => {
    const { container } = render(
      <QuickAddForm
        quickAdd={{ ...baseState, majorCategory: "電気工事" }}
        contractors={[]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    const middleSelect = getMiddleSelect(container);
    expect(middleSelect.disabled).toBe(false);
    const optionValues = Array.from(middleSelect.options).map((o) => o.value);
    expect(optionValues).toContain("荒配線");
    expect(optionValues).toContain("器具付");
  });

  it("中項目まで選択済みで小項目が表示される（小項目のある中項目）", () => {
    const { container } = render(
      <QuickAddForm
        quickAdd={{ ...baseState, majorCategory: "電気工事", middleCategory: "荒配線" }}
        contractors={[]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    const minorSelect = getMinorSelect(container);
    expect(minorSelect.disabled).toBe(false);
    const optionValues = Array.from(minorSelect.options).map((o) => o.value);
    expect(optionValues).toContain("天井内配線");
    expect(optionValues).toContain("壁内配線");
    expect(optionValues).toContain("床下配線");
  });

  it("小項目のない中項目では小項目selectがdisabled", () => {
    const { container } = render(
      <QuickAddForm
        quickAdd={{ ...baseState, majorCategory: "電気工事", middleCategory: "試運転" }}
        contractors={[]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(getMinorSelect(container).disabled).toBe(true);
  });

  it("カテゴリ検索入力でonChangeが呼ばれる", () => {
    const onChange = vi.fn();
    render(
      <QuickAddForm
        quickAdd={baseState}
        contractors={[]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onChange={onChange}
      />,
    );
    const searchInput = screen.getByRole("textbox", { name: "カテゴリ検索テキスト" });
    fireEvent.change(searchInput, { target: { value: "電気" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    // updaterは呼ばれていることを確認（値の検証はe.target.valueがJSDOMで保持される）
    expect(typeof onChange.mock.calls[0][0]).toBe("function");
  });

  it("カテゴリ検索結果リストが表示される", () => {
    const { container } = render(
      <QuickAddForm
        quickAdd={{ ...baseState, categorySearch: "電気" }}
        contractors={[]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    // 検索結果ul内に電気工事のspanが表示される
    const ul = container.querySelector("ul");
    expect(ul).toBeTruthy();
    const resultText = ul?.textContent ?? "";
    expect(resultText).toContain("電気工事");
  });
});
