/**
 * 型定義・バリデーションユーティリティのテスト
 */
import { describe, it, expect } from "vitest";
import {
  DEFECT_KINDS,
  DEFECT_KIND_LABELS,
  DEFECT_SEVERITY_WEIGHT,
  HIGH_SEVERITY_THRESHOLD,
  isValidBBox,
  isValidDefect,
  isValidInspectionPhoto,
  emptyDefectsByKind,
  type DefectKind,
  type Defect,
  type InspectionPhoto,
  type BoundingBox,
} from "../lib/photo-inspection/types.js";

// ── フィクスチャ ───────────────────────────────────────────────────────────────

function makeBBox(overrides: Partial<BoundingBox> = {}): BoundingBox {
  return { x: 0.1, y: 0.1, w: 0.2, h: 0.2, ...overrides };
}

function makeDefect(overrides: Partial<Defect> = {}): Defect {
  return {
    id: "def-001",
    kind: "scratch",
    bbox: makeBBox(),
    confidence: 0.8,
    ...overrides,
  };
}

function makePhoto(overrides: Partial<InspectionPhoto> = {}): InspectionPhoto {
  return {
    id: "photo-001",
    projectId: "proj-001",
    capturedAt: "2026-05-09T10:00:00Z",
    imageUrl: "data:image/png;base64,abc",
    fileName: "photo.jpg",
    defects: [],
    status: "pending",
    ...overrides,
  };
}

// ── DefectKind 一覧 ────────────────────────────────────────────────────────────

describe("DEFECT_KINDS", () => {
  it("8種類定義されている", () => {
    expect(DEFECT_KINDS).toHaveLength(8);
  });

  it("全種別にラベルが定義されている", () => {
    for (const kind of DEFECT_KINDS) {
      expect(DEFECT_KIND_LABELS[kind]).toBeTruthy();
    }
  });

  it("全種別に重みが定義されている", () => {
    for (const kind of DEFECT_KINDS) {
      expect(typeof DEFECT_SEVERITY_WEIGHT[kind]).toBe("number");
      expect(DEFECT_SEVERITY_WEIGHT[kind]).toBeGreaterThan(0);
    }
  });

  it("crack/water_damage は高リスク (weight >= HIGH_SEVERITY_THRESHOLD)", () => {
    expect(DEFECT_SEVERITY_WEIGHT["crack"]).toBeGreaterThanOrEqual(HIGH_SEVERITY_THRESHOLD);
    expect(DEFECT_SEVERITY_WEIGHT["water_damage"]).toBeGreaterThanOrEqual(HIGH_SEVERITY_THRESHOLD);
  });

  it("scratch/stain/discoloration は低リスク (weight < HIGH_SEVERITY_THRESHOLD)", () => {
    expect(DEFECT_SEVERITY_WEIGHT["scratch"]).toBeLessThan(HIGH_SEVERITY_THRESHOLD);
    expect(DEFECT_SEVERITY_WEIGHT["stain"]).toBeLessThan(HIGH_SEVERITY_THRESHOLD);
    expect(DEFECT_SEVERITY_WEIGHT["discoloration"]).toBeLessThan(HIGH_SEVERITY_THRESHOLD);
  });

  it("missing_part/misalignment/peeling は高リスク", () => {
    expect(DEFECT_SEVERITY_WEIGHT["missing_part"]).toBeGreaterThanOrEqual(HIGH_SEVERITY_THRESHOLD);
    expect(DEFECT_SEVERITY_WEIGHT["misalignment"]).toBeGreaterThanOrEqual(HIGH_SEVERITY_THRESHOLD);
    expect(DEFECT_SEVERITY_WEIGHT["peeling"]).toBeGreaterThanOrEqual(HIGH_SEVERITY_THRESHOLD);
  });
});

// ── isValidBBox ────────────────────────────────────────────────────────────────

describe("isValidBBox", () => {
  it("正常な bbox → true", () => {
    expect(isValidBBox({ x: 0, y: 0, w: 0.5, h: 0.5 })).toBe(true);
  });

  it("x+w が 1 を超える → false", () => {
    expect(isValidBBox({ x: 0.8, y: 0, w: 0.5, h: 0.3 })).toBe(false);
  });

  it("y+h が 1 を超える → false", () => {
    expect(isValidBBox({ x: 0, y: 0.8, w: 0.3, h: 0.5 })).toBe(false);
  });

  it("w=0 → false", () => {
    expect(isValidBBox({ x: 0, y: 0, w: 0, h: 0.5 })).toBe(false);
  });

  it("h=0 → false", () => {
    expect(isValidBBox({ x: 0, y: 0, w: 0.5, h: 0 })).toBe(false);
  });

  it("負の x → false", () => {
    expect(isValidBBox({ x: -0.1, y: 0, w: 0.5, h: 0.5 })).toBe(false);
  });

  it("境界値: x=0,y=0,w=1,h=1 → true", () => {
    expect(isValidBBox({ x: 0, y: 0, w: 1, h: 1 })).toBe(true);
  });
});

// ── isValidDefect ──────────────────────────────────────────────────────────────

describe("isValidDefect", () => {
  it("正常な defect → true", () => {
    expect(isValidDefect(makeDefect())).toBe(true);
  });

  it("id が空文字 → false", () => {
    expect(isValidDefect(makeDefect({ id: "" }))).toBe(false);
  });

  it("不正な kind → false", () => {
    expect(isValidDefect(makeDefect({ kind: "unknown" as DefectKind }))).toBe(false);
  });

  it("confidence > 1 → false", () => {
    expect(isValidDefect(makeDefect({ confidence: 1.1 }))).toBe(false);
  });

  it("confidence < 0 → false", () => {
    expect(isValidDefect(makeDefect({ confidence: -0.1 }))).toBe(false);
  });

  it("不正な bbox → false", () => {
    expect(isValidDefect(makeDefect({ bbox: { x: 0.9, y: 0, w: 0.5, h: 0.5 } }))).toBe(false);
  });

  it("全 DefectKind が valid", () => {
    for (const kind of DEFECT_KINDS) {
      expect(isValidDefect(makeDefect({ kind }))).toBe(true);
    }
  });
});

// ── isValidInspectionPhoto ────────────────────────────────────────────────────

describe("isValidInspectionPhoto", () => {
  it("正常な photo → true", () => {
    expect(isValidInspectionPhoto(makePhoto())).toBe(true);
  });

  it("defects に invalid defect → false", () => {
    const photo = makePhoto({ defects: [makeDefect({ confidence: 2 })] });
    expect(isValidInspectionPhoto(photo)).toBe(false);
  });

  it("status が不正な値 → false", () => {
    const photo = makePhoto({ status: "unknown" as InspectionPhoto["status"] });
    expect(isValidInspectionPhoto(photo)).toBe(false);
  });

  it("全ステータス値が valid", () => {
    const statuses: InspectionPhoto["status"][] = ["pending", "inspected", "approved", "rework"];
    for (const status of statuses) {
      expect(isValidInspectionPhoto(makePhoto({ status }))).toBe(true);
    }
  });

  it("projectId が空 → false", () => {
    expect(isValidInspectionPhoto(makePhoto({ projectId: "" }))).toBe(false);
  });
});

// ── emptyDefectsByKind ────────────────────────────────────────────────────────

describe("emptyDefectsByKind", () => {
  it("全8種のキーが 0 で初期化される", () => {
    const empty = emptyDefectsByKind();
    for (const kind of DEFECT_KINDS) {
      expect(empty[kind]).toBe(0);
    }
  });

  it("返り値は毎回新しいオブジェクト", () => {
    const a = emptyDefectsByKind();
    const b = emptyDefectsByKind();
    a.scratch = 99;
    expect(b.scratch).toBe(0);
  });
});
