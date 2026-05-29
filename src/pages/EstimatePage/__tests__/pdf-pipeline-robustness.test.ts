/**
 * PDF→見積パイプライン ロバストネス監査
 *
 * 合成平面図PDF（fixtures/generate-fixtures.mjs で生成）を本番と同一の経路
 *   extractDrawingModel → classifyInteriorElements → takeoffFromInterior → composeEstimate
 * （PDFDraftTab.handleFile と同一）に通し、図面座標から計算した幾何学的真値と比較する。
 *
 * 正しく動くケースは正確性を assert する。
 * 現状壊れる/劣化するケースは it.skip で観測された欠陥をコメント記録する
 *  （偽の合格 assert は書かない — honesty over green）。
 *
 * 期待面積は generate-fixtures.mjs の描画座標から計算した値（同スクリプトの出力ログと一致）。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractDrawingModel } from "../../../lib/pdf-vector-extractor/index.js";
import { classifyInteriorElements } from "../../../lib/pdf-to-estimate/interior-semantic.js";
import { takeoffFromInterior } from "../../../lib/pdf-to-estimate/quantity-takeoff-from-pdf.js";
import { composeEstimate } from "../../../lib/pdf-to-estimate/estimate-composer.js";
import type { CostMasterItem, EstimateDraft, DrawingModel, InteriorElement } from "../../../lib/pdf-to-estimate/types.js";
import costMasterRaw from "../../../estimate/cost-master.json";

const COST_MASTER: CostMasterItem[] = (
  costMasterRaw as { categories: { items: CostMasterItem[] }[] }
).categories.flatMap((cat) => cat.items);

const FIX_DIR = "src/pages/EstimatePage/__tests__/fixtures";

async function runPipeline(file: string): Promise<{
  model: DrawingModel;
  elements: InteriorElement[];
  draft: EstimateDraft;
  floorM2: number;
}> {
  const buf = readFileSync(resolve(FIX_DIR, file));
  const model = await extractDrawingModel(new Uint8Array(buf) as unknown as ArrayBuffer);
  const elements = classifyInteriorElements(model);
  const floorM2 = elements
    .filter((e) => e.kind === "floor_area")
    .reduce((s, e) => s + (e.geometry as { areaSqM: number }).areaSqM, 0);
  const takeoff = takeoffFromInterior(elements);
  const draft = composeEstimate(takeoff, COST_MASTER, model, {
    wallTypeInferenceHints: { texts: model.texts.map((t) => t.text) },
  });
  return { model, elements, draft, floorM2 };
}

function logDraft(tag: string, model: DrawingModel, elements: InteriorElement[], draft: EstimateDraft, floorM2: number) {
  console.log(`\n=== ${tag} ===`);
  console.log("lines=", model.lines.length, "texts=", model.texts.length, "scale_mm_per_pt=", model.scale_mm_per_pt);
  console.log("elements=", elements.length, "rooms=", elements.filter((e) => e.kind === "room").length, "floorM2=", floorM2.toFixed(3));
  console.log("estimate lines=", draft.lines.length, "total(excl tax)=", draft.totalExcludingTax);
  for (const l of draft.lines) {
    console.log(`  - ${l.code} ${l.name} qty=${l.quantity} unit=${l.unitPrice} amt=${l.amount}`);
  }
}

describe("PDF pipeline robustness audit", () => {
  // ── Fixture 2: L字（非凸）部屋 — PASS ──────────────────────────────
  // traceClosedLoop が6頂点のL形ループを正しく閉じ、Shoelace面積が正確。
  it("L-shaped room: traceClosedLoop closes non-convex loop, area accurate", async () => {
    const { model, elements, draft, floorM2 } = await runPipeline("floorplan-lshaped-1-50.pdf");
    logDraft("L-shaped 1/50", model, elements, draft, floorM2);
    const EXPECTED = 21.001302; // generate-fixtures.mjs draw coords
    expect(model.scale_mm_per_pt).toBeCloseTo(17.6389, 2);
    expect(elements.filter((e) => e.kind === "room").length).toBe(1);
    expect(floorM2).toBeGreaterThan(EXPECTED * 0.95);
    expect(floorM2).toBeLessThan(EXPECTED * 1.05);
    expect(draft.totalExcludingTax).toBeGreaterThan(0);
  });

  // ── Fixture 3: 1/100 縮尺 — PASS ───────────────────────────────────
  // 同じpt寸法の部屋が 1/100 で 1/50 比 4× 面積になる（縮尺2乗）。
  it("1/100 scale: scale_mm_per_pt≈35.28 and area scales 4x vs 1/50 same-pt room", async () => {
    const { model, elements, draft, floorM2 } = await runPipeline("floorplan-single-1-100.pdf");
    logDraft("single 1/100", model, elements, draft, floorM2);
    const EXPECTED = 49.780864; // = 12.445216 (1/50 同寸) × 4
    expect(model.scale_mm_per_pt).toBeCloseTo(35.2778, 2);
    expect(floorM2).toBeGreaterThan(EXPECTED * 0.95);
    expect(floorM2).toBeLessThan(EXPECTED * 1.05);
    // 4× 関係の確認（1/50 単室 = 12.445216 m²）
    expect(floorM2 / 12.445216).toBeCloseTo(4, 1);
  });

  // ── Fixture 4: 30°回転矩形 — PASS ──────────────────────────────────
  // 斜め壁でも端点連結で閉ループを成し、Shoelace面積が真の矩形面積と一致。
  it("rotated 30deg rectangle: walls detected, area within 5% of true rect", async () => {
    const { model, elements, draft, floorM2 } = await runPipeline("floorplan-rotated-1-50.pdf");
    logDraft("rotated 1/50", model, elements, draft, floorM2);
    const EXPECTED = 11.947407; // w*h pt² → m² (回転不変)
    expect(model.lines.length).toBeGreaterThanOrEqual(4);
    expect(elements.filter((e) => e.kind === "wall").length).toBeGreaterThanOrEqual(4);
    expect(floorM2).toBeGreaterThan(EXPECTED * 0.95);
    expect(floorM2).toBeLessThan(EXPECTED * 1.05);
    expect(draft.totalExcludingTax).toBeGreaterThan(0);
  });

  // ── Fixture 1: 隣接2部屋（共有壁） — DEFECT, SKIPPED ───────────────
  //
  // 観測欠陥（revenue-critical）:
  //   detectRooms() は traceClosedLoop() に依存するが、traceClosedLoop は walls[0]
  //   から1つの閉ループを辿って即 return する（interior-semantic.ts:157-203, return @198）。
  //   そのため隣接2部屋の図面では最初の部屋（事務室）の1ループしか検出されず、
  //   2部屋目（会議室）の床/天井が完全に欠落する。
  //     期待: rooms=2, floor合計≈24.890 m²
  //     実測: rooms=1, floor=12.445 m²（約-50%、床+天井で ~¥126,535 の過小計上）
  //   ※壁面積は8本全壁から算出されるため過大気味（共有壁の二重計上も未補正）。
  //
  // 修正は「全ての互いに素な閉ループを列挙」+「共有壁の壁面積二重計上補正」が必要で、
  // detectRooms / traceClosedLoop の構造変更（M/L規模・リスク有）。本監査では実装せず
  // /tmp/pdf-pipeline-robustness-2026-05-29.md に推奨として記録。
  it.skip("multi-room: detects BOTH rooms and sums floor area (DEFECT: only 1 room detected)", async () => {
    const { floorM2, elements } = await runPipeline("floorplan-multiroom-1-50.pdf");
    const EXPECTED_SUM = 24.890432;
    expect(elements.filter((e) => e.kind === "room").length).toBe(2);
    expect(floorM2).toBeGreaterThan(EXPECTED_SUM * 0.95);
  });
});
