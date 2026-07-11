/**
 * ScheduleFromEstimatePage テスト (Sprint 3-7)
 * - 基本レンダリング
 * - タスク行表示
 * - ステータス切替
 * - 開始日変更 → 日付再計算
 * - 土日スキップ toggle
 * - 空見積行
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ScheduleFromEstimatePage } from "./ScheduleFromEstimatePage.js";
import type { EstimateLine } from "../estimate/types.js";

afterEach(cleanup);

function line(overrides: Partial<EstimateLine> & { name: string }): EstimateLine {
  return {
    code: "X-001",
    unit: "式",
    quantity: 1,
    unitPrice: 10000,
    amount: 10000,
    note: "",
    ...overrides,
  };
}

const LINES: EstimateLine[] = [
  line({ name: "解体撤去工事", code: "DIS-001" }),
  line({ name: "クロス張り工事", code: "CL-001" }),
];

function renderPage(props?: Partial<React.ComponentProps<typeof ScheduleFromEstimatePage>>) {
  return render(
    <ScheduleFromEstimatePage
      projectName="テスト案件"
      projectStartDate="2026-05-01"
      initialLines={LINES}
      {...props}
    />,
  );
}

// ── 基本レンダリング ──────────────────────────────────────────────────────────

describe("ScheduleFromEstimatePage — 基本レンダリング", () => {
  it("ヘッダーに「工程表」と案件名が表示される", () => {
    renderPage();
    expect(screen.getByText("工程表")).toBeDefined();
    expect(screen.getByText(/テスト案件/)).toBeDefined();
  });

  it("全工程数が表示される", () => {
    renderPage();
    expect(screen.getByText(/全2工程/)).toBeDefined();
  });

  it("完了カウントが初期0を表示する", () => {
    renderPage();
    expect(screen.getByText(/0\/2完了/)).toBeDefined();
  });

  it("開始日入力が表示される", () => {
    renderPage();
    const input = screen.getByTestId("start-date-input") as HTMLInputElement;
    expect(input.value).toBe("2026-05-01");
  });

  it("土日スキップcheckboxが表示される", () => {
    renderPage();
    const cb = screen.getByTestId("skip-weekends-checkbox") as HTMLInputElement;
    expect(cb).toBeDefined();
    expect(cb.checked).toBe(true);
  });
});

// ── タスク行 ──────────────────────────────────────────────────────────────────

describe("ScheduleFromEstimatePage — タスク行", () => {
  it("各見積行のタスク行が表示される", () => {
    renderPage();
    const rows = screen.getAllByTestId("task-row");
    expect(rows).toHaveLength(2);
  });

  it("工事名が行内に表示される", () => {
    renderPage();
    expect(screen.getAllByText("解体撤去工事")[0]).toBeDefined();
    // モバイルカード+デスクトップ行の両方に描画されるため getAllByText を使用
    expect(screen.getAllByText("クロス張り工事")[0]).toBeDefined();
  });

  it("開始日が行内に表示される（skipWeekends=true でも土日回避）", () => {
    renderPage();
    // 2026-05-01 = Friday — skipWeekends default true
    // モバイルカード+デスクトップ行の両方に描画されるため getAllByText を使用
    expect(screen.getAllByText("2026-05-01")[0]).toBeDefined();
  });

  it("工期日数が表示される", () => {
    renderPage();
    // モバイルカード+デスクトップ行の両方に描画されるため getAllByText を使用
    expect(screen.getAllByText("3日間")[0]).toBeDefined(); // 解体工事 = 3日
    expect(screen.getAllByText("2日間")[0]).toBeDefined(); // クロス = 2日
  });

  it("初期ステータスは「未着手」", () => {
    renderPage();
    const badges = screen.getAllByText("未着手");
    // モバイルカード+デスクトップ行の両方に描画されるため 2タスク×2=4件
    expect(badges).toHaveLength(4);
  });

  it("noteがある行はnoteが表示される", () => {
    renderPage({
      initialLines: [line({ name: "電気工事", note: "100V配線" })],
    });
    // モバイルカード+デスクトップ行の両方に描画されるため getAllByText を使用
    expect(screen.getAllByText("100V配線")[0]).toBeDefined();
  });
});

// ── ステータス切替 ────────────────────────────────────────────────────────────

describe("ScheduleFromEstimatePage — ステータス切替", () => {
  // 新UI: バッジタップ → ピッカー表示 → ステータス選択
  function openPickerAndSelect(row: HTMLElement, status: "todo" | "in_progress" | "done") {
    const btn = row.querySelector("[data-testid^='status-btn-']") as HTMLButtonElement;
    fireEvent.click(btn); // ピッカーを開く
    const pick = row.querySelector(`[data-testid='status-pick-${status}']`) as HTMLButtonElement;
    fireEvent.click(pick); // ステータスを選択
    return btn;
  }

  it("ピッカーから「進行中」を選ぶと状態が変わる", () => {
    renderPage({ initialLines: [line({ name: "解体工事", code: "DIS-001" })] });
    const rows = screen.getAllByTestId("task-row");
    const btn = openPickerAndSelect(rows[0], "in_progress");
    expect(btn.textContent).toBe("進行中");
  });

  it("ピッカーから「完了」を選ぶと状態が変わる", () => {
    renderPage({ initialLines: [line({ name: "解体工事", code: "DIS-001" })] });
    const rows = screen.getAllByTestId("task-row");
    openPickerAndSelect(rows[0], "in_progress");
    const btn = openPickerAndSelect(rows[0], "done");
    expect(btn.textContent).toBe("完了");
  });

  it("ピッカーから「未着手」を選ぶと状態が戻る", () => {
    renderPage({ initialLines: [line({ name: "解体工事", code: "DIS-001" })] });
    const rows = screen.getAllByTestId("task-row");
    openPickerAndSelect(rows[0], "done");
    const btn = openPickerAndSelect(rows[0], "todo");
    expect(btn.textContent).toBe("未着手");
  });

  it("1件完了にすると完了カウントが更新される", () => {
    renderPage();
    const rows = screen.getAllByTestId("task-row");
    openPickerAndSelect(rows[0], "done");
    expect(screen.getByText(/1\/2完了/)).toBeDefined();
  });

  it("ステータス変更後にUndoトーストが表示される", () => {
    renderPage({ initialLines: [line({ name: "解体工事", code: "DIS-001" })] });
    const rows = screen.getAllByTestId("task-row");
    openPickerAndSelect(rows[0], "in_progress");
    expect(screen.getByTestId("undo-toast")).toBeDefined();
  });

  it("Undoボタンを押すと変更が元に戻る", () => {
    renderPage({ initialLines: [line({ name: "解体工事", code: "DIS-001" })] });
    const rows = screen.getAllByTestId("task-row");
    const btn = openPickerAndSelect(rows[0], "in_progress");
    fireEvent.click(screen.getByTestId("undo-btn"));
    expect(btn.textContent).toBe("未着手");
  });
});

// ── 開始日変更 ────────────────────────────────────────────────────────────────

describe("ScheduleFromEstimatePage — 開始日変更", () => {
  it("開始日を変更するとタスクの日付が再計算される", () => {
    renderPage({ initialLines: [line({ name: "解体工事" })] });
    const input = screen.getByTestId("start-date-input");
    fireEvent.change(input, { target: { value: "2026-06-01" } });
    // モバイルカード+デスクトップ行の両方に描画されるため getAllByText を使用
    expect(screen.getAllByText("2026-06-01")[0]).toBeDefined();
  });
});

// ── 土日スキップ toggle ───────────────────────────────────────────────────────

describe("ScheduleFromEstimatePage — 土日スキップ", () => {
  it("チェックを外すと土日が含まれた終了日になる", () => {
    // 2026-05-01 = Fri, 解体 3日 skipWeekends=false → 05-03 (Sun)
    renderPage({ initialLines: [line({ name: "解体工事", code: "DIS" })] });
    const cb = screen.getByTestId("skip-weekends-checkbox");
    fireEvent.click(cb); // uncheck
    // モバイルカード+デスクトップ行の両方に描画されるため getAllByText を使用
    expect(screen.getAllByText("2026-05-03")[0]).toBeDefined(); // 終了日 = Sun
  });
});

// ── 空見積 ────────────────────────────────────────────────────────────────────

describe("ScheduleFromEstimatePage — 空見積", () => {
  it("空lines配列でも「見積行がありません」が表示される", () => {
    renderPage({ initialLines: [] });
    expect(screen.getByText("見積行がありません")).toBeDefined();
  });

  it("amount=0の行のみの場合もタスクは0件", () => {
    renderPage({ initialLines: [line({ name: "備考行", amount: 0 })] });
    expect(screen.queryAllByTestId("task-row")).toHaveLength(0);
  });
});

// ── カテゴリ別グルーピング ────────────────────────────────────────────────────

describe("ScheduleFromEstimatePage — カテゴリグルーピング", () => {
  it("解体とクロスが別カテゴリヘッダーで表示される", () => {
    renderPage();
    expect(screen.getByText("解体工事")).toBeDefined();
    expect(screen.getByText("内装仕上")).toBeDefined();
  });
});

// ── モバイルカード表示 ────────────────────────────────────────────────────────

describe("ScheduleFromEstimatePage — モバイルカード", () => {
  it("task-rowごとにモバイルカード内にも工事名が描画される", () => {
    renderPage({ initialLines: [line({ name: "LGS工事", code: "LGS-001" })] });
    // モバイルカード+デスクトップ行の両方で同一テキストが2件あること
    expect(screen.getAllByText("LGS工事")).toHaveLength(2);
  });

  it("task-rowごとにモバイルカード内にもステータスボタンが描画される", () => {
    renderPage({ initialLines: [line({ name: "LGS工事", code: "LGS-001" })] });
    // モバイル+デスクトップ両方に status-btn があること (1タスク×2=2件)
    const btns = screen.queryAllByTestId(/^status-btn-/);
    expect(btns).toHaveLength(2);
  });
});
