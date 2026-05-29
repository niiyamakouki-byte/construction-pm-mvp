import { describe, it, expect } from "vitest";
import { jsPDF } from "jspdf";
import { loadPage } from "../pdf-loader.js";
import { extractTextItems } from "../text-extractor.js";

/** jspdf で 3 文字列を既知座標に配置した PDF を生成する（pt 単位）。 */
function makeTextPdf(): ArrayBuffer {
  // unit: pt, A4。jspdf の text() は左上原点（top-down）。
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(12);
  doc.text("ROOM-A", 100, 100);
  doc.text("1/50", 200, 300);
  doc.text("3640", 400, 500);
  return doc.output("arraybuffer");
}

describe("extractTextItems", () => {
  it("既知の 3 文字列を抽出する", async () => {
    const pdf = makeTextPdf();
    const page = await loadPage(pdf, 0);
    const items = await extractTextItems(page);

    const texts = items.map((i) => i.text);
    expect(texts).toContain("ROOM-A");
    expect(texts).toContain("1/50");
    expect(texts).toContain("3640");
  });

  it("各項目が位置と font_size を持つ", async () => {
    const pdf = makeTextPdf();
    const page = await loadPage(pdf, 0);
    const items = await extractTextItems(page);

    const roomA = items.find((i) => i.text === "ROOM-A");
    expect(roomA).toBeDefined();
    expect(roomA!.position.x).toBeGreaterThan(0);
    expect(roomA!.position.y).toBeGreaterThan(0);
    expect(roomA!.font_size).toBeGreaterThan(0);
  });
});
