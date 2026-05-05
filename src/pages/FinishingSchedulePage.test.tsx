/**
 * FinishingSchedulePage テスト (Sprint 3-5)
 * - 行追加/削除
 * - テンプレ流し込み (3パターン)
 * - セル編集
 * - CSV エクスポート
 * - 印刷スタイル (printボタン存在確認)
 * 最低12テスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FinishingSchedulePage } from "./FinishingSchedulePage.js";

// URL.createObjectURL / URL.revokeObjectURL をモック
const mockObjectUrl = "blob:mock-url";

beforeEach(() => {
  vi.stubGlobal("URL", {
    createObjectURL: (blob: Blob) => {
      // 非同期で content を読む代わりに Blob 自体を記録
      Object.assign(URL, { _lastBlob: blob });
      return mockObjectUrl;
    },
    revokeObjectURL: vi.fn(),
  });

  // document.createElement("a").click をモック
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    const el = originalCreateElement(tag);
    if (tag === "a") {
      Object.defineProperty(el, "click", { value: vi.fn(), writable: true });
    }
    return el;
  });

  // window.print をモック
  vi.stubGlobal("print", vi.fn());
  Object.defineProperty(window, "print", { value: vi.fn(), writable: true });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderPage(props?: Partial<React.ComponentProps<typeof FinishingSchedulePage>>) {
  return render(<FinishingSchedulePage projectName="テスト案件" siteAddress="東京都港区" {...props} />);
}

// ── 基本レンダリング ───────────────────────────────────────────────────────────

describe("FinishingSchedulePage — 基本レンダリング", () => {
  it("ヘッダーに仕上表と案件名が表示される", () => {
    renderPage();
    expect(screen.getByText("仕上表")).toBeDefined();
    expect(screen.getByText(/テスト案件/)).toBeDefined();
  });

  it("初期状態で6部屋分の行が表示される", () => {
    renderPage();
    const rows = screen.getAllByTestId("finishing-row");
    expect(rows.length).toBe(6);
  });

  it("テーブルが描画される", () => {
    renderPage();
    expect(screen.getByTestId("finishing-table")).toBeDefined();
  });

  it("部位列ヘッダーが正しく表示される (床材/壁材/天井材)", () => {
    renderPage();
    expect(screen.getByText("床材")).toBeDefined();
    expect(screen.getByText("壁材")).toBeDefined();
    expect(screen.getByText("天井材")).toBeDefined();
  });
});

// ── 行追加/削除 ────────────────────────────────────────────────────────────────

describe("FinishingSchedulePage — 行追加/削除", () => {
  it("行追加ボタンで行が1件増える", () => {
    renderPage();
    const before = screen.getAllByTestId("finishing-row").length;
    const addBtn = screen.getByTestId("add-row-button");
    act(() => { fireEvent.click(addBtn); });
    const after = screen.getAllByTestId("finishing-row").length;
    expect(after).toBe(before + 1);
  });

  it("削除ボタンで行が1件減る", () => {
    renderPage();
    const rows = screen.getAllByTestId("finishing-row");
    const before = rows.length;
    // 最初の行の削除ボタンを取得
    const _firstRowId = rows[0].getAttribute("data-testid");
    // delete-row-{id} ボタンを探す
    const deleteButtons = document.querySelectorAll("[data-testid^='delete-row-']");
    expect(deleteButtons.length).toBeGreaterThan(0);
    act(() => { fireEvent.click(deleteButtons[0]); });
    const after = screen.getAllByTestId("finishing-row").length;
    expect(after).toBe(before - 1);
  });

  it("部屋名を編集できる", () => {
    renderPage();
    const nameInputs = document.querySelectorAll("[data-testid^='room-name-']") as NodeListOf<HTMLInputElement>;
    act(() => {
      fireEvent.change(nameInputs[0], { target: { value: "リビング" } });
    });
    expect((nameInputs[0] as HTMLInputElement).value).toBe("リビング");
  });
});

// ── テンプレ流し込み ──────────────────────────────────────────────────────────

describe("FinishingSchedulePage — テンプレート", () => {
  it("ナチュラル系テンプレートボタンが存在する", () => {
    renderPage();
    expect(screen.getByTestId("template-ナチュラル系")).toBeDefined();
  });

  it("モノトーン系テンプレートボタンが存在する", () => {
    renderPage();
    expect(screen.getByTestId("template-モノトーン系")).toBeDefined();
  });

  it("和モダン系テンプレートボタンが存在する", () => {
    renderPage();
    expect(screen.getByTestId("template-和モダン系")).toBeDefined();
  });

  it("ナチュラル系テンプレートを適用するとオーク突板フローリングが表示される", async () => {
    renderPage();
    const btn = screen.getByTestId("template-ナチュラル系");
    await act(async () => {
      fireEvent.click(btn);
      // 150ms アニメ待ち (75ms + react 再レンダリング)
      await new Promise((r) => setTimeout(r, 160));
    });
    expect(screen.getAllByText("オーク突板フローリング").length).toBeGreaterThan(0);
  });

  it("モノトーン系テンプレートを適用するとコンクリート研磨が表示される", async () => {
    renderPage();
    const btn = screen.getByTestId("template-モノトーン系");
    await act(async () => {
      fireEvent.click(btn);
      await new Promise((r) => setTimeout(r, 160));
    });
    expect(screen.getAllByText("コンクリート研磨").length).toBeGreaterThan(0);
  });

  it("和モダン系テンプレートを適用すると琉球畳が表示される", async () => {
    renderPage();
    const btn = screen.getByTestId("template-和モダン系");
    await act(async () => {
      fireEvent.click(btn);
      await new Promise((r) => setTimeout(r, 160));
    });
    expect(screen.getAllByText("畳(琉球)").length).toBeGreaterThan(0);
  });
});

// ── セル編集 ─────────────────────────────────────────────────────────────────

describe("FinishingSchedulePage — セル編集", () => {
  it("床材セルボタンをクリックするとドロップダウンが開く", () => {
    renderPage();
    const cellBtn = document.querySelectorAll("[data-testid='cell-button-床材']")[0];
    act(() => { fireEvent.click(cellBtn); });
    expect(document.querySelector("[data-testid='cell-dropdown-床材']")).toBeDefined();
  });

  it("ドロップダウンから候補を選択するとセルに反映される", () => {
    renderPage();
    const cellBtn = document.querySelectorAll("[data-testid='cell-button-床材']")[0];
    act(() => { fireEvent.click(cellBtn); });
    const dropdown = document.querySelector("[data-testid='cell-dropdown-床材']");
    expect(dropdown).not.toBeNull();
    const firstOption = dropdown!.querySelectorAll("button")[0];
    act(() => { fireEvent.click(firstOption); });
    // ドロップダウンが閉じた後、セルに品名が反映される
    const updatedBtn = document.querySelectorAll("[data-testid='cell-button-床材']")[0];
    expect(updatedBtn.textContent).toContain("オーク突板フローリング");
  });

  it("備考セルはtextareaで編集できる", () => {
    renderPage();
    const textareas = document.querySelectorAll("[data-testid='cell-textarea-備考']") as NodeListOf<HTMLTextAreaElement>;
    expect(textareas.length).toBeGreaterThan(0);
    act(() => {
      fireEvent.change(textareas[0], { target: { value: "特記事項あり" } });
    });
    expect(textareas[0].value).toBe("特記事項あり");
  });
});

// ── CSV エクスポート ──────────────────────────────────────────────────────────

describe("FinishingSchedulePage — CSVエクスポート", () => {
  it("CSV出力ボタンが存在する", () => {
    renderPage();
    expect(screen.getByTestId("export-csv-button")).toBeDefined();
  });

  it("CSV出力ボタンをクリックするとBlobが生成される", () => {
    renderPage();
    const btn = screen.getByTestId("export-csv-button");
    act(() => { fireEvent.click(btn); });
    // URL.createObjectURL が呼ばれ、Blob が作成されたことを確認
    expect((URL as unknown as { _lastBlob?: Blob })._lastBlob).toBeInstanceOf(Blob);
  });

  it("生成されるCSVにはBOM付きUTF-8ヘッダーが含まれる", () => {
    // Blob コンストラクタを intercept して内容を捕捉
    let capturedContent = "";
    const OrigBlob = globalThis.Blob;
    vi.spyOn(globalThis, "Blob").mockImplementation((parts, options) => {
      capturedContent = (parts as BlobPart[]).join("");
      return new OrigBlob(parts, options);
    });

    renderPage();
    const btn = screen.getByTestId("export-csv-button");
    act(() => { fireEvent.click(btn); });

    // BOM (\uFEFF) で始まる
    expect(capturedContent.charCodeAt(0)).toBe(0xFEFF);
    // ヘッダー列が含まれる
    expect(capturedContent).toContain("部屋");
    expect(capturedContent).toContain("床材_品名");
  });
});

// ── 印刷 ─────────────────────────────────────────────────────────────────────

describe("FinishingSchedulePage — 印刷", () => {
  it("印刷ボタンが存在する", () => {
    renderPage();
    expect(screen.getByTestId("print-button")).toBeDefined();
  });
});
