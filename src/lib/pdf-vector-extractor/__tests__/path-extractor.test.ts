import { describe, it, expect } from "vitest";
import { jsPDF } from "jspdf";
import { loadPage } from "../pdf-loader.js";
import { extractRawSegments } from "../path-extractor.js";
import type { Point } from "../../pdf-to-estimate/types.js";

/** 既知の位置・サイズの矩形を 1 つ描画した PDF を生成（pt 単位）。 */
function makeRectPdf(): { pdf: ArrayBuffer; pageHeight: number } {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setLineWidth(2);
  // jspdf は左上原点 top-down。x=100,y=100 を左上に 200x150 の矩形。
  doc.rect(100, 100, 200, 150);
  return { pdf: doc.output("arraybuffer"), pageHeight };
}

/** 点 p が候補集合のいずれかと許容内で一致するか。 */
function near(p: Point, targets: Point[], tol = 1.5): boolean {
  return targets.some((t) => Math.hypot(p.x - t.x, p.y - t.y) <= tol);
}

describe("extractRawSegments", () => {
  it("矩形を 4 セグメントとして抽出する", async () => {
    const { pdf, pageHeight } = makeRectPdf();
    const page = await loadPage(pdf, 0);
    const segs = await extractRawSegments(page);

    expect(segs.length).toBe(4);

    // jspdf は top-down、PDF 座標は bottom-up なので y は反転する。
    // 矩形の角（PDF 座標、左下原点）の期待値。
    const yTop = pageHeight - 100; // 上辺
    const yBot = pageHeight - 250; // 下辺 (100 + 150)
    const corners: Point[] = [
      { x: 100, y: yTop },
      { x: 300, y: yTop },
      { x: 300, y: yBot },
      { x: 100, y: yBot },
    ];

    // 全セグメントの端点が矩形の角のいずれかに一致する
    for (const seg of segs) {
      expect(near(seg.start, corners)).toBe(true);
      expect(near(seg.end, corners)).toBe(true);
    }

    // 4 つの角がすべて少なくとも 1 度は端点に現れる
    const endpoints = segs.flatMap((s) => [s.start, s.end]);
    for (const c of corners) {
      expect(endpoints.some((e) => near(e, [c]))).toBe(true);
    }
  });

  it("線幅が CTM スケール適用後の値で記録される", async () => {
    const { pdf } = makeRectPdf();
    const page = await loadPage(pdf, 0);
    const segs = await extractRawSegments(page);
    // setLineWidth(2) → スケール 1 のため概ね 2pt
    expect(segs[0].width).toBeGreaterThan(1);
  });
});
