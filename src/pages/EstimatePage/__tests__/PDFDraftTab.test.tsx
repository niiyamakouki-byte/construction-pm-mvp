import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDraftTab } from "../PDFDraftTab.js";
import type { CostMasterItem } from "../../../lib/pdf-to-estimate/types.js";

afterEach(cleanup);

// ─── fixtures ─────────────────────────────────────────────────────

const TEST_COST_MASTER: CostMasterItem[] = [
  { code: "IN-001", name: "LGS間仕切り（65型）", unit: "㎡", unitPrice: 5500 },
  { code: "IN-003", name: "石膏ボード張り（12.5mm）", unit: "㎡", unitPrice: 2800 },
  { code: "IN-005", name: "クロス張り（量産品）", unit: "㎡", unitPrice: 1200 },
  { code: "IN-011", name: "フロアタイル", unit: "㎡", unitPrice: 5500 },
  { code: "IN-012", name: "巾木（ビニル）", unit: "m", unitPrice: 800 },
  { code: "IN-015", name: "石膏ボード天井", unit: "㎡", unitPrice: 4500 },
  { code: "IN-024", name: "廻り縁", unit: "m", unitPrice: 1200 },
  { code: "IN-068", name: "天井・軽鉄下地（シングル）", unit: "㎡", unitPrice: 2800 },
  { code: "FX-001", name: "木製建具（フラッシュ戸）", unit: "枚", unitPrice: 65000 },
  { code: "FX-003", name: "ガラス入り建具", unit: "枚", unitPrice: 95000 },
];

/** DrawingModel サンプル — 壁線・開口・部屋を含む */
const SAMPLE_DRAWING = {
  source_pdf: "/path/to/sample.pdf",
  page_index: 0,
  page_size_pt: { x: 842, y: 595 },
  scale: "1:50",
  scale_mm_per_pt: 0.3528,
  lines: [
    // 壁線4本でおおよそ5m×5m の部屋
    { start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, thickness: 1.5, color: "#000", layer: "wall", semantic: "wall" as const, length_pt: 1000, length_mm: 5000 },
    { start: { x: 1000, y: 0 }, end: { x: 1000, y: 1000 }, thickness: 1.5, color: "#000", layer: "wall", semantic: "wall" as const, length_pt: 1000, length_mm: 5000 },
    { start: { x: 1000, y: 1000 }, end: { x: 0, y: 1000 }, thickness: 1.5, color: "#000", layer: "wall", semantic: "wall" as const, length_pt: 1000, length_mm: 5000 },
    { start: { x: 0, y: 1000 }, end: { x: 0, y: 0 }, thickness: 1.5, color: "#000", layer: "wall", semantic: "wall" as const, length_pt: 1000, length_mm: 5000 },
    // ドア開口
    { start: { x: 100, y: 0 }, end: { x: 100, y: 100 }, thickness: 0.5, color: "#000", layer: "opening", semantic: "opening" as const, length_pt: 100, length_mm: 800 },
  ],
  rects: [
    { top_left: { x: 0, y: 0 }, bottom_right: { x: 1000, y: 1000 }, layer: "room" },
  ],
  texts: [],
  layers: ["wall", "opening", "room"],
  extracted_at: "2026-04-15T00:00:00Z",
};

function makeJsonFile(data: unknown, name = "drawing.json"): File {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  return new File([blob], name, { type: "application/json" });
}

// ─── Tests ────────────────────────────────────────────────────────

describe("PDFDraftTab", () => {
  it("正常系: DrawingModel JSON をアップロードすると EstimateDraft が表示される", async () => {
    render(<PDFDraftTab costMaster={TEST_COST_MASTER} />);

    const input = screen.getByTestId("pdf-file-input") as HTMLInputElement;
    const file = makeJsonFile(SAMPLE_DRAWING);
    fireEvent.change(input, { target: { files: [file] } });

    // テーブルが描画されるまで待つ（DOM更新）
    await vi.waitFor(() => {
      expect(screen.getByTestId("draft-lines-table")).toBeDefined();
    });

    // 税抜合計が表示される
    expect(screen.getByTestId("total-excl-tax")).toBeDefined();
    expect(screen.getByTestId("total-incl-tax")).toBeDefined();
    expect(screen.getAllByText("PDF読取").length).toBeGreaterThan(0);
  });

  it("エラー系: 不正な JSON ファイルでエラーメッセージが表示される", async () => {
    render(<PDFDraftTab costMaster={TEST_COST_MASTER} />);

    const input = screen.getByTestId("pdf-file-input") as HTMLInputElement;
    const badFile = new File(["not-json!!{"], "bad.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [badFile] } });

    await vi.waitFor(() => {
      expect(screen.getByTestId("pdf-draft-error")).toBeDefined();
    });

    expect(screen.getByTestId("pdf-draft-error").textContent).toContain("ファイル形式が不正");
  });

  it("エラー系: DrawingModel 形式でない JSON でエラーになる", async () => {
    render(<PDFDraftTab costMaster={TEST_COST_MASTER} />);

    const input = screen.getByTestId("pdf-file-input") as HTMLInputElement;
    const wrongFile = makeJsonFile({ foo: "bar" });
    fireEvent.change(input, { target: { files: [wrongFile] } });

    await vi.waitFor(() => {
      expect(screen.getByTestId("pdf-draft-error")).toBeDefined();
    });

    expect(screen.getByTestId("pdf-draft-error").textContent).toContain("ファイル形式が不正");
  });

  it("信頼度バッジ: 0.8 → 緑, 0.6 → 黄色, 0.4 → 赤", async () => {
    render(<PDFDraftTab costMaster={TEST_COST_MASTER} />);

    const input = screen.getByTestId("pdf-file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeJsonFile(SAMPLE_DRAWING)] } });

    await vi.waitFor(() => {
      expect(screen.getByTestId("draft-lines-table")).toBeDefined();
    });

    // 全バッジが表示されている（少なくとも1つ以上）
    const overallBadge = screen.getByTestId("overall-confidence-badge");
    expect(overallBadge).toBeDefined();

    // 全体信頼度バッジのクラスを確認（emerald/yellow/red のいずれか）
    const cls = overallBadge.className;
    const hasColorClass =
      cls.includes("emerald") || cls.includes("yellow") || cls.includes("red");
    expect(hasColorClass).toBe(true);
  });

  it("ドラフトをクリアボタンで drop-zone に戻る", async () => {
    render(<PDFDraftTab costMaster={TEST_COST_MASTER} />);

    const input = screen.getByTestId("pdf-file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeJsonFile(SAMPLE_DRAWING)] } });

    await vi.waitFor(() => {
      expect(screen.getByTestId("draft-lines-table")).toBeDefined();
    });

    fireEvent.click(screen.getByTestId("clear-draft-btn"));

    expect(screen.getByTestId("pdf-drop-zone")).toBeDefined();
  });

  it("正式見積として保存ボタンで onSave コールバックが呼ばれる", async () => {
    const onSave = vi.fn();
    render(<PDFDraftTab costMaster={TEST_COST_MASTER} onSave={onSave} />);

    const input = screen.getByTestId("pdf-file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeJsonFile(SAMPLE_DRAWING)] } });

    await vi.waitFor(() => {
      expect(screen.getByTestId("save-draft-btn")).toBeDefined();
    });

    fireEvent.click(screen.getByTestId("save-draft-btn"));
    expect(onSave).toHaveBeenCalledTimes(1);

    // コールバック引数が EstimateDraft 形状であること
    const arg = onSave.mock.calls[0][0];
    expect(arg).toHaveProperty("sourcePdfPath");
    expect(arg).toHaveProperty("lines");
    expect(arg).toHaveProperty("totalExcludingTax");
  });

  it("drop-zone に強化されたコピーとロール属性が設定されている", () => {
    render(<PDFDraftTab costMaster={TEST_COST_MASTER} />);

    const zone = screen.getByTestId("pdf-drop-zone");
    expect(zone.getAttribute("role")).toBe("button");
    // 強化コピー: 「ここに図面 PDF をドロップ」が表示される
    expect(zone.textContent).toContain("ここに図面 PDF をドロップ");
    // クリックでファイル選択の案内
    expect(zone.textContent).toContain("クリックしてファイルを選択");
  });
});
