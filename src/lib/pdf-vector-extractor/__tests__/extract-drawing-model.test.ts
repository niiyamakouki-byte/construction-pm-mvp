import { describe, it, expect } from "vitest";
import { jsPDF } from "jspdf";
import { extractDrawingModel } from "../index.js";
import { classifyInteriorElements } from "../../pdf-to-estimate/interior-semantic.js";

/**
 * 4 本の太線で閉じた長方形の部屋を描いた PDF を生成する。
 * 縮尺 "1/50" のテキストも配置（scale_mm_per_pt ≈ 17.64）。
 */
function makeRoomPdf(): ArrayBuffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setLineWidth(2); // 2pt > 0.5pt 壁判定しきい値

  // 矩形の角（pt、jspdf top-down 座標）。1 辺 ~150pt → 実寸 ~2646mm。
  const x0 = 150;
  const y0 = 150;
  const x1 = 320;
  const y1 = 270;
  // 4 辺を個別の線分として描く（端点が共有される）
  doc.line(x0, y0, x1, y0); // 上辺
  doc.line(x1, y0, x1, y1); // 右辺
  doc.line(x1, y1, x0, y1); // 下辺
  doc.line(x0, y1, x0, y0); // 左辺

  doc.setFontSize(10);
  doc.text("1/50", 400, 500);

  return doc.output("arraybuffer");
}

describe("extractDrawingModel (E2E)", () => {
  it("4 壁の部屋 PDF から DrawingModel を生成し縮尺を検出する", async () => {
    const pdf = makeRoomPdf();
    const dm = await extractDrawingModel(pdf, { sourceName: "room.pdf" });

    expect(dm.source_pdf).toBe("room.pdf");
    expect(dm.scale).toBe("1:50");
    expect(dm.scale_mm_per_pt).toBeCloseTo(50 * (25.4 / 72), 4);
    // 4 辺ぶんの線分が含まれる（描画順や分割で >=4）
    expect(dm.lines.length).toBeGreaterThanOrEqual(4);
    // 壁厚 2pt が記録されている
    expect(dm.lines.some((l) => (l.thickness ?? 0) >= 0.5)).toBe(true);
  });

  it("classifyInteriorElements が room/floor_area を導出する", async () => {
    const pdf = makeRoomPdf();
    const dm = await extractDrawingModel(pdf);
    const elements = classifyInteriorElements(dm);

    const walls = elements.filter((e) => e.kind === "wall");
    expect(walls.length).toBeGreaterThanOrEqual(4);

    const rooms = elements.filter((e) => e.kind === "room");
    const floors = elements.filter((e) => e.kind === "floor_area");
    expect(rooms.length).toBeGreaterThanOrEqual(1);
    expect(floors.length).toBeGreaterThanOrEqual(1);
    // 面積が妥当（~150pt 角 * 17.64mm/pt ≈ 2.6m 角 → 6〜8 m² 程度）
    if (rooms[0].kind === "room") {
      expect(rooms[0].geometry.areaSqM).toBeGreaterThan(0.5);
    }
  });
});
