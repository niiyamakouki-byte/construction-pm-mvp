/**
 * AI写真検査モジュール — 型定義
 * 現場写真の欠陥検知・報告書生成に使用する共通型
 */

// ── 欠陥種別 ──────────────────────────────────────────────────────────────────

export type DefectKind =
  | "scratch"
  | "stain"
  | "crack"
  | "peeling"
  | "misalignment"
  | "missing_part"
  | "water_damage"
  | "discoloration";

export const DEFECT_KINDS: DefectKind[] = [
  "scratch",
  "stain",
  "crack",
  "peeling",
  "misalignment",
  "missing_part",
  "water_damage",
  "discoloration",
];

export const DEFECT_KIND_LABELS: Record<DefectKind, string> = {
  scratch: "傷",
  stain: "汚れ",
  crack: "ひび割れ",
  peeling: "剥がれ",
  misalignment: "施工ズレ",
  missing_part: "部品欠損",
  water_damage: "水濡れ・雨漏り",
  discoloration: "変色",
};

// ── 欠陥重みマップ (severity計算用) ──────────────────────────────────────────

export const DEFECT_SEVERITY_WEIGHT: Record<DefectKind, number> = {
  crack: 3,
  water_damage: 3,
  missing_part: 2,
  misalignment: 2,
  peeling: 2,
  scratch: 1,
  stain: 1,
  discoloration: 1,
};

/** HIGH_SEVERITY_THRESHOLD 以上の weight を持つ欠陥は高重症度とみなす */
export const HIGH_SEVERITY_THRESHOLD = 2;

// ── 欠陥インターフェース ──────────────────────────────────────────────────────

/** 正規化済み bbox (0-1 の範囲) */
export type BoundingBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Defect = {
  id: string;
  kind: DefectKind;
  bbox: BoundingBox;
  confidence: number; // 0-1
  notes?: string;
};

// ── 写真ステータス ────────────────────────────────────────────────────────────

export type PhotoStatus = "pending" | "inspected" | "approved" | "rework";

// ── 検査写真 ──────────────────────────────────────────────────────────────────

export type InspectionPhoto = {
  id: string;
  projectId: string;
  locationId?: string;
  capturedAt: string;        // ISO 8601
  imageUrl: string;          // data URI or remote URL
  fileName: string;
  defects: Defect[];
  inspectorNotes?: string;
  status: PhotoStatus;
};

// ── 報告書サマリ ──────────────────────────────────────────────────────────────

export type InspectionSummary = {
  totalPhotos: number;
  totalDefects: number;
  defectsByKind: Record<DefectKind, number>;
  highSeverityCount: number;
};

// ── 検査報告書 ────────────────────────────────────────────────────────────────

export type InspectionReport = {
  id: string;
  projectId: string;
  generatedAt: string;       // ISO 8601
  photos: InspectionPhoto[];
  summary: InspectionSummary;
  reviewer?: string;
};

// ── バリデーションユーティリティ ──────────────────────────────────────────────

/** BoundingBox が 0-1 の正規化範囲内か検証 */
export function isValidBBox(bbox: BoundingBox): boolean {
  return (
    bbox.x >= 0 && bbox.x <= 1 &&
    bbox.y >= 0 && bbox.y <= 1 &&
    bbox.w > 0 && bbox.w <= 1 &&
    bbox.h > 0 && bbox.h <= 1 &&
    bbox.x + bbox.w <= 1 &&
    bbox.y + bbox.h <= 1
  );
}

/** Defect の基本バリデーション */
export function isValidDefect(d: Defect): boolean {
  return (
    typeof d.id === "string" && d.id.length > 0 &&
    DEFECT_KINDS.includes(d.kind) &&
    isValidBBox(d.bbox) &&
    d.confidence >= 0 && d.confidence <= 1
  );
}

/** InspectionPhoto の基本バリデーション */
export function isValidInspectionPhoto(p: InspectionPhoto): boolean {
  const VALID_STATUSES: PhotoStatus[] = ["pending", "inspected", "approved", "rework"];
  return (
    typeof p.id === "string" && p.id.length > 0 &&
    typeof p.projectId === "string" && p.projectId.length > 0 &&
    typeof p.fileName === "string" && p.fileName.length > 0 &&
    VALID_STATUSES.includes(p.status) &&
    Array.isArray(p.defects) &&
    p.defects.every(isValidDefect)
  );
}

/** InspectionSummary の defectsByKind が全種含むよう初期化 */
export function emptyDefectsByKind(): Record<DefectKind, number> {
  return {
    scratch: 0,
    stain: 0,
    crack: 0,
    peeling: 0,
    misalignment: 0,
    missing_part: 0,
    water_damage: 0,
    discoloration: 0,
  };
}
