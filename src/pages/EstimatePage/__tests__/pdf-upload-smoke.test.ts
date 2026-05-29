import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractDrawingModel } from "../../../lib/pdf-vector-extractor/index.js";
import { classifyInteriorElements } from "../../../lib/pdf-to-estimate/interior-semantic.js";
import { takeoffFromInterior } from "../../../lib/pdf-to-estimate/quantity-takeoff-from-pdf.js";
import { composeEstimate } from "../../../lib/pdf-to-estimate/estimate-composer.js";
import type { CostMasterItem } from "../../../lib/pdf-to-estimate/types.js";
import costMasterRaw from "../../../estimate/cost-master.json";

const COST_MASTER: CostMasterItem[] = (
  costMasterRaw as { categories: { items: CostMasterItem[] }[] }
).categories.flatMap((cat) => cat.items);

// Exercises the exact pipeline PDFDraftTab.handleFile runs on a real PDF upload.
describe("PDF upload golden path (real PDF → estimate draft)", () => {
  it("extracts a DrawingModel and composes a sane estimate", async () => {
    const pdfPath = resolve("src/pages/EstimatePage/__tests__/fixtures/floorplan-1-50.pdf");
    const buf = readFileSync(pdfPath);
    const bytes = new Uint8Array(buf);

    // extractDrawingModel accepts File | ArrayBuffer; loader also handles Uint8Array.
    const model = await extractDrawingModel(bytes as unknown as ArrayBuffer);
    expect(Array.isArray(model.lines)).toBe(true);
    expect(Array.isArray(model.texts)).toBe(true);
    expect(typeof model.page_index).toBe("number");
    console.log("[smoke] lines=", model.lines.length, "texts=", model.texts.length, "scale_mm_per_pt=", model.scale_mm_per_pt);

    const elements = classifyInteriorElements(model);
    console.log("[smoke] elements=", elements.length);
    expect(elements.length).toBeGreaterThan(0);

    const takeoff = takeoffFromInterior(elements);
    const draft = composeEstimate(takeoff, COST_MASTER, model, {
      wallTypeInferenceHints: { texts: model.texts.map((t) => t.text) },
    });

    console.log("[smoke] estimate lines=", draft.lines.length, "total(excl tax)=", draft.totalExcludingTax);
    expect(draft.lines.length).toBeGreaterThan(0);
    expect(draft.totalExcludingTax).toBeGreaterThan(0);
    for (const l of draft.lines) {
      console.log(`  - ${l.code} ${l.name} qty=${l.quantity} unit=${l.unitPrice} amt=${l.amount}`);
      expect(l.amount).toBeGreaterThanOrEqual(0);
    }
  });
});
