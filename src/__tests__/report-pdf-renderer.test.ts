/**
 * renderReportHTML テスト
 */
import { describe, it, expect } from "vitest";
import { renderReportHTML } from "../lib/photo-inspection/report-pdf-renderer.js";
import { generateReport } from "../lib/photo-inspection/report-generator.js";
import type { InspectionPhoto, Defect } from "../lib/photo-inspection/types.js";

// ── フィクスチャ ───────────────────────────────────────────────────────────────

let _id = 0;
function uid(): string { return `t${++_id}`; }

function makeDefect(kind: Defect["kind"] = "crack"): Defect {
  return { id: uid(), kind, bbox: { x: 0.1, y: 0.1, w: 0.3, h: 0.3 }, confidence: 0.85 };
}

function makePhoto(defects: Defect[] = [], projectId = "proj-test"): InspectionPhoto {
  return {
    id: uid(),
    projectId,
    capturedAt: "2026-05-09T10:00:00Z",
    imageUrl: "data:image/png;base64,TEST",
    fileName: "wall-photo.jpg",
    defects,
    status: "inspected",
  };
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe("renderReportHTML — 基本構造", () => {
  it("HTML 文字列を返す", () => {
    const report = generateReport("proj-001", []);
    const html = renderReportHTML(report, "テスト案件");
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(0);
  });

  it("<!DOCTYPE html> で始まる", () => {
    const report = generateReport("p", []);
    const html = renderReportHTML(report);
    expect(html.trim().startsWith("<!DOCTYPE html>")).toBe(true);
  });

  it("案件名が含まれる", () => {
    const report = generateReport("p", []);
    const html = renderReportHTML(report, "KDX南青山リノベーション");
    expect(html).toContain("KDX南青山リノベーション");
  });

  it("projectId をデフォルト案件名として使用", () => {
    const report = generateReport("proj-fallback", []);
    const html = renderReportHTML(report);
    expect(html).toContain("proj-fallback");
  });

  it("reviewer が含まれる", () => {
    const report = generateReport("p", [], "我妻");
    const html = renderReportHTML(report, "テスト");
    expect(html).toContain("我妻");
  });
});

describe("renderReportHTML — 欠陥情報", () => {
  it("欠陥数が出力 HTML に含まれる", () => {
    const photos = [
      makePhoto([makeDefect("crack"), makeDefect("stain")]),
    ];
    const report = generateReport("p", photos);
    const html = renderReportHTML(report, "案件A");
    // サマリに totalDefects=2
    expect(html).toContain("2");
  });

  it("欠陥種別ラベルが含まれる (ひび割れ)", () => {
    const photos = [makePhoto([makeDefect("crack")])];
    const report = generateReport("p", photos);
    const html = renderReportHTML(report, "案件A");
    expect(html).toContain("ひび割れ");
  });

  it("高リスクバッジが含まれる (highSeverityCount > 0)", () => {
    const photos = [makePhoto([makeDefect("crack")])];
    const report = generateReport("p", photos);
    const html = renderReportHTML(report, "案件A");
    expect(html).toContain("高リスク");
  });

  it("欠陥なしの場合は「欠陥は検出されませんでした」", () => {
    const report = generateReport("p", [makePhoto([])]);
    const html = renderReportHTML(report, "案件A");
    expect(html).toContain("欠陥は検出されませんでした");
  });
});

describe("renderReportHTML — SVG bbox オーバーレイ", () => {
  it("欠陥がある写真には SVG が含まれる", () => {
    const photos = [makePhoto([makeDefect("crack")])];
    const report = generateReport("p", photos);
    const html = renderReportHTML(report, "案件A");
    expect(html).toContain("<svg");
    expect(html).toContain("<rect");
  });

  it("bbox の x/y 値が出力に含まれる", () => {
    const defect = makeDefect("crack");
    defect.bbox = { x: 0.1, y: 0.2, w: 0.3, h: 0.25 };
    const photos = [makePhoto([defect])];
    const report = generateReport("p", photos);
    const html = renderReportHTML(report, "案件A");
    expect(html).toContain("0.1");
    expect(html).toContain("0.2");
  });

  it("欠陥なし写真には SVG オーバーレイが含まれない", () => {
    const photos = [makePhoto([])];
    const report = generateReport("p", photos);
    const html = renderReportHTML(report, "案件A");
    // img は含まれるが SVG rect は含まれない
    expect(html).toContain("<img");
    expect(html).not.toContain("<rect");
  });
});

describe("renderReportHTML — ファイル名と画像", () => {
  it("写真のファイル名が含まれる", () => {
    const photos = [makePhoto([], "p")];
    const report = generateReport("p", photos);
    const html = renderReportHTML(report, "案件A");
    expect(html).toContain("wall-photo.jpg");
  });

  it("imageUrl (data URI) が img src に含まれる", () => {
    const photos = [makePhoto([], "p")];
    const report = generateReport("p", photos);
    const html = renderReportHTML(report, "案件A");
    expect(html).toContain("data:image/png;base64,TEST");
  });
});

describe("renderReportHTML — 写真なし", () => {
  it("写真なしでもエラーにならない", () => {
    const report = generateReport("p", []);
    expect(() => renderReportHTML(report, "空案件")).not.toThrow();
  });

  it("「写真なし」テキストが含まれる", () => {
    const report = generateReport("p", []);
    const html = renderReportHTML(report, "空案件");
    expect(html).toContain("写真なし");
  });
});
