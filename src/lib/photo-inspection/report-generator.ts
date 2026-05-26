/**
 * 検査報告書ジェネレーター
 *
 * InspectionPhoto[] と projectId から InspectionReport を生成する。
 * severity 重みに基づいて highSeverityCount を集計する。
 */

import type { InspectionPhoto, InspectionReport, InspectionSummary, DefectKind } from "./types.js";
import { emptyDefectsByKind, DEFECT_SEVERITY_WEIGHT, HIGH_SEVERITY_THRESHOLD } from "./types.js";

// ── ID生成 ────────────────────────────────────────────────────────────────────

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── サマリ集計 ────────────────────────────────────────────────────────────────

/**
 * 写真リストから InspectionSummary を計算する
 */
export function computeSummary(photos: InspectionPhoto[]): InspectionSummary {
  const defectsByKind = emptyDefectsByKind();
  let totalDefects = 0;
  let highSeverityCount = 0;

  for (const photo of photos) {
    for (const defect of photo.defects) {
      totalDefects++;
      const kind = defect.kind as DefectKind;
      defectsByKind[kind] = (defectsByKind[kind] ?? 0) + 1;

      const weight = DEFECT_SEVERITY_WEIGHT[kind] ?? 1;
      if (weight >= HIGH_SEVERITY_THRESHOLD) {
        highSeverityCount++;
      }
    }
  }

  return {
    totalPhotos: photos.length,
    totalDefects,
    defectsByKind,
    highSeverityCount,
  };
}

// ── 報告書生成 ────────────────────────────────────────────────────────────────

/**
 * 写真群から InspectionReport を生成する
 *
 * @param projectId - 案件ID
 * @param photos - 検査済み写真リスト
 * @param reviewer - レビュアー名 (任意)
 */
export function generateReport(
  projectId: string,
  photos: InspectionPhoto[],
  reviewer?: string,
): InspectionReport {
  const summary = computeSummary(photos);

  return {
    id: genId(),
    projectId,
    generatedAt: new Date().toISOString(),
    photos: [...photos],
    summary,
    ...(reviewer !== undefined ? { reviewer } : {}),
  };
}
