/**
 * report-generator テスト
 */
import { describe, it, expect } from "vitest";
import { generateReport, computeSummary } from "../lib/photo-inspection/report-generator.js";
import {
  DEFECT_SEVERITY_WEIGHT,
  HIGH_SEVERITY_THRESHOLD,
  type InspectionPhoto,
  type Defect,
} from "../lib/photo-inspection/types.js";

// ── フィクスチャ ───────────────────────────────────────────────────────────────

let _idCounter = 0;
function genId(): string { return `test-${++_idCounter}`; }

function makeDefect(kind: Defect["kind"]): Defect {
  return {
    id: genId(),
    kind,
    bbox: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
    confidence: 0.75,
  };
}

function makePhoto(
  projectId = "proj-001",
  defects: Defect[] = [],
  status: InspectionPhoto["status"] = "inspected",
): InspectionPhoto {
  return {
    id: genId(),
    projectId,
    capturedAt: "2026-05-09T10:00:00Z",
    imageUrl: "data:image/png;base64,abc",
    fileName: "test.jpg",
    defects,
    status,
  };
}

// ── computeSummary ────────────────────────────────────────────────────────────

describe("computeSummary — 基本", () => {
  it("写真なし → 全ゼロ", () => {
    const summary = computeSummary([]);
    expect(summary.totalPhotos).toBe(0);
    expect(summary.totalDefects).toBe(0);
    expect(summary.highSeverityCount).toBe(0);
    expect(Object.values(summary.defectsByKind).every((v) => v === 0)).toBe(true);
  });

  it("欠陥なし写真 → defects=0", () => {
    const summary = computeSummary([makePhoto("p1", [])]);
    expect(summary.totalPhotos).toBe(1);
    expect(summary.totalDefects).toBe(0);
    expect(summary.highSeverityCount).toBe(0);
  });

  it("totalPhotos は写真枚数と一致", () => {
    const photos = [makePhoto(), makePhoto(), makePhoto()];
    expect(computeSummary(photos).totalPhotos).toBe(3);
  });

  it("totalDefects は全写真の欠陥合計", () => {
    const photos = [
      makePhoto("p", [makeDefect("scratch"), makeDefect("stain")]),
      makePhoto("p", [makeDefect("crack")]),
    ];
    expect(computeSummary(photos).totalDefects).toBe(3);
  });
});

describe("computeSummary — defectsByKind 集計", () => {
  it("scratch 2件 + crack 1件 の集計", () => {
    const photos = [
      makePhoto("p", [makeDefect("scratch"), makeDefect("scratch"), makeDefect("crack")]),
    ];
    const s = computeSummary(photos);
    expect(s.defectsByKind.scratch).toBe(2);
    expect(s.defectsByKind.crack).toBe(1);
    expect(s.defectsByKind.stain).toBe(0);
  });

  it("全8種の欠陥が正しく集計される", () => {
    const all: Defect["kind"][] = [
      "scratch", "stain", "crack", "peeling",
      "misalignment", "missing_part", "water_damage", "discoloration",
    ];
    const photos = [makePhoto("p", all.map(makeDefect))];
    const s = computeSummary(photos);
    for (const kind of all) {
      expect(s.defectsByKind[kind]).toBe(1);
    }
  });
});

describe("computeSummary — highSeverityCount", () => {
  it("高リスク欠陥 (crack, water_damage) のみカウント", () => {
    const photos = [
      makePhoto("p", [makeDefect("crack"), makeDefect("water_damage"), makeDefect("scratch")]),
    ];
    const s = computeSummary(photos);
    expect(s.highSeverityCount).toBe(2);
  });

  it("低リスクのみ → highSeverityCount = 0", () => {
    const photos = [
      makePhoto("p", [makeDefect("scratch"), makeDefect("stain"), makeDefect("discoloration")]),
    ];
    expect(computeSummary(photos).highSeverityCount).toBe(0);
  });

  it("全高リスク種別が正しくカウントされる", () => {
    const highRisk = Object.entries(DEFECT_SEVERITY_WEIGHT)
      .filter(([, w]) => w >= HIGH_SEVERITY_THRESHOLD)
      .map(([k]) => k as Defect["kind"]);
    const photos = [makePhoto("p", highRisk.map(makeDefect))];
    const s = computeSummary(photos);
    expect(s.highSeverityCount).toBe(highRisk.length);
  });

  it("複数写真にまたがる高リスク欠陥を合算", () => {
    const photos = [
      makePhoto("p", [makeDefect("crack")]),
      makePhoto("p", [makeDefect("missing_part"), makeDefect("scratch")]),
    ];
    expect(computeSummary(photos).highSeverityCount).toBe(2);
  });
});

// ── generateReport ────────────────────────────────────────────────────────────

describe("generateReport", () => {
  it("基本的な報告書が生成される", () => {
    const photos = [makePhoto("proj-001", [makeDefect("crack")])];
    const report = generateReport("proj-001", photos);
    expect(report.id).toBeTruthy();
    expect(report.projectId).toBe("proj-001");
    expect(report.generatedAt).toBeTruthy();
    expect(report.photos).toHaveLength(1);
  });

  it("reviewer が設定される", () => {
    const report = generateReport("p", [], "我妻");
    expect(report.reviewer).toBe("我妻");
  });

  it("reviewer 未指定 → undefined", () => {
    const report = generateReport("p", []);
    expect(report.reviewer).toBeUndefined();
  });

  it("photos は元の配列のコピー (参照を共有しない)", () => {
    const photos = [makePhoto()];
    const report = generateReport("p", photos);
    photos.push(makePhoto());
    expect(report.photos).toHaveLength(1);
  });

  it("generatedAt は有効な ISO 8601 日時", () => {
    const report = generateReport("p", []);
    expect(() => new Date(report.generatedAt)).not.toThrow();
    expect(new Date(report.generatedAt).toISOString()).toBe(report.generatedAt);
  });

  it("summary が正しく計算される", () => {
    const photos = [
      makePhoto("p", [makeDefect("crack"), makeDefect("scratch")]),
    ];
    const report = generateReport("p", photos);
    expect(report.summary.totalDefects).toBe(2);
    expect(report.summary.highSeverityCount).toBe(1);
    expect(report.summary.defectsByKind.crack).toBe(1);
    expect(report.summary.defectsByKind.scratch).toBe(1);
  });

  it("写真なし → 空サマリの報告書", () => {
    const report = generateReport("p", []);
    expect(report.summary.totalPhotos).toBe(0);
    expect(report.summary.totalDefects).toBe(0);
  });
});
