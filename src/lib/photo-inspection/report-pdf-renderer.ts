/**
 * 検査報告書 HTML レンダラー
 *
 * jsPDF 等は使わず、印刷可能な HTML/CSS テンプレートを返す純関数。
 * defect ごとに bbox オーバーレイの SVG マークを埋め込む。
 */

import type { InspectionReport, InspectionPhoto, Defect } from "./types.js";
import { DEFECT_KIND_LABELS, DEFECT_SEVERITY_WEIGHT, HIGH_SEVERITY_THRESHOLD } from "./types.js";
import { escapeHtml } from "../utils/escape-html.js";

// ── カラー定数 ────────────────────────────────────────────────────────────────

const COLOR_DANGER = "#C53030";
const COLOR_SAFE = "#6B8E5A";
const COLOR_NEUTRAL = "#64748b";

function sanitizeImageSrc(src: string): string {
  const trimmed = src.trim();

  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" || url.protocol === "http:") {
      return trimmed;
    }
  } catch {
    // Reject invalid and relative URLs in printable report HTML.
  }

  return "";
}

// ── SVG bbox オーバーレイ ─────────────────────────────────────────────────────

/**
 * ImageData の上に defect bbox を SVG rect でオーバーレイする要素を生成
 * 写真は imgSrc (data URI or URL) を img タグに、bbox を SVG で重ねる
 */
function renderPhotoWithOverlay(photo: InspectionPhoto): string {
  const imageSrc = sanitizeImageSrc(photo.imageUrl);

  if (photo.defects.length === 0) {
    return `<img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(photo.fileName)}"
      style="width:100%;max-width:320px;display:block;border-radius:6px;border:1px solid #e2e8f0;" />`;
  }

  const bboxRects = photo.defects.map((d) => renderBBoxRect(d)).join("\n");

  return `<div style="position:relative;display:inline-block;max-width:320px;width:100%;">
  <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(photo.fileName)}"
    style="width:100%;display:block;border-radius:6px;border:1px solid #e2e8f0;" />
  <svg viewBox="0 0 1 1" preserveAspectRatio="none"
    style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;">
    ${bboxRects}
  </svg>
</div>`;
}

function renderBBoxRect(defect: Defect): string {
  const { x, y, w, h } = defect.bbox;
  const isHigh = (DEFECT_SEVERITY_WEIGHT[defect.kind] ?? 1) >= HIGH_SEVERITY_THRESHOLD;
  const color = isHigh ? COLOR_DANGER : COLOR_SAFE;
  const label = DEFECT_KIND_LABELS[defect.kind] ?? defect.kind;
  const confidencePct = Math.round(defect.confidence * 100);

  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}"
      fill="none" stroke="${color}" stroke-width="0.008" stroke-dasharray="0.015 0.01" />
    <text x="${x + 0.005}" y="${y + 0.045}" font-size="0.04" fill="${color}" font-family="sans-serif">
      ${escapeHtml(label)} ${confidencePct}%
    </text>
  </g>`;
}

// ── 写真セクション ────────────────────────────────────────────────────────────

function renderPhotoSection(photo: InspectionPhoto, index: number): string {
  const statusColors: Record<string, string> = {
    pending: COLOR_NEUTRAL,
    inspected: "#2563eb",
    approved: COLOR_SAFE,
    rework: COLOR_DANGER,
  };
  const statusLabels: Record<string, string> = {
    pending: "未検査",
    inspected: "検査済",
    approved: "合格",
    rework: "要手直し",
  };

  const defectRows =
    photo.defects.length > 0
      ? photo.defects
          .map(
            (d) =>
              `<tr>
                <td>${escapeHtml(DEFECT_KIND_LABELS[d.kind] ?? d.kind)}</td>
                <td>${Math.round(d.confidence * 100)}%</td>
                <td>${escapeHtml(d.notes ?? "—")}</td>
              </tr>`,
          )
          .join("\n")
      : `<tr><td colspan="3" style="text-align:center;color:${COLOR_NEUTRAL}">欠陥なし</td></tr>`;

  const statusColor = statusColors[photo.status] ?? COLOR_NEUTRAL;
  const statusLabel = statusLabels[photo.status] ?? photo.status;

  return `<section style="margin-bottom:28px;page-break-inside:avoid;">
  <h3 style="font-size:1em;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px;">
    #${index + 1} ${escapeHtml(photo.fileName)}
    <span style="margin-left:12px;font-size:0.85em;font-weight:700;color:${statusColor}">${statusLabel}</span>
  </h3>
  <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;">
    <div style="flex:0 0 auto;">
      ${renderPhotoWithOverlay(photo)}
    </div>
    <div style="flex:1;min-width:200px;">
      ${photo.inspectorNotes ? `<p style="font-size:0.85em;color:${COLOR_NEUTRAL};margin-bottom:8px;">備考: ${escapeHtml(photo.inspectorNotes)}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;font-size:0.82em;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:4px 6px;text-align:left;border:1px solid #e2e8f0;">種別</th>
            <th style="padding:4px 6px;text-align:center;border:1px solid #e2e8f0;">信頼度</th>
            <th style="padding:4px 6px;text-align:left;border:1px solid #e2e8f0;">メモ</th>
          </tr>
        </thead>
        <tbody>
          ${defectRows}
        </tbody>
      </table>
    </div>
  </div>
</section>`;
}

// ── メインレンダラー ──────────────────────────────────────────────────────────

/**
 * InspectionReport から印刷可能な HTML 文字列を返す純関数
 *
 * @param report - InspectionReport
 * @param projectName - 表示用案件名
 */
export function renderReportHTML(report: InspectionReport, projectName: string = report.projectId): string {
  const { summary } = report;
  const generatedDate = new Date(report.generatedAt).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const defectSummaryRows = Object.entries(summary.defectsByKind)
    .filter(([, count]) => count > 0)
    .map(
      ([kind, count]) =>
        `<tr>
          <td style="padding:3px 8px;border:1px solid #e2e8f0;">${escapeHtml(DEFECT_KIND_LABELS[kind as keyof typeof DEFECT_KIND_LABELS] ?? kind)}</td>
          <td style="padding:3px 8px;text-align:center;border:1px solid #e2e8f0;">${count}</td>
        </tr>`,
    )
    .join("\n");

  const photoSections = report.photos.map((p, i) => renderPhotoSection(p, i)).join("\n");

  const highSeverityBadge =
    summary.highSeverityCount > 0
      ? `<span style="color:${COLOR_DANGER};font-weight:700;margin-left:8px;">⚠ 高リスク ${summary.highSeverityCount}件</span>`
      : `<span style="color:${COLOR_SAFE};font-weight:700;margin-left:8px;">問題なし</span>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>検査報告書 — ${escapeHtml(projectName)}</title>
  <style>
    body { font-family: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", sans-serif;
           color: #1e293b; margin: 0; padding: 24px; background: #fff; }
    h1 { font-size: 1.4em; margin-bottom: 4px; }
    @media print {
      body { padding: 0; }
      section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header style="border-bottom:2px solid #e2e8f0;padding-bottom:12px;margin-bottom:20px;">
    <h1>AI現場写真検査報告書</h1>
    <p style="margin:0;font-size:0.9em;color:${COLOR_NEUTRAL};">
      案件: <strong>${escapeHtml(projectName)}</strong> &nbsp;|&nbsp;
      生成日時: ${generatedDate}
      ${report.reviewer ? `&nbsp;|&nbsp; レビュアー: ${escapeHtml(report.reviewer)}` : ""}
    </p>
  </header>

  <section style="margin-bottom:24px;">
    <h2 style="font-size:1.1em;margin-bottom:8px;">サマリ ${highSeverityBadge}</h2>
    <ul style="list-style:none;padding:0;margin:0 0 12px;font-size:0.9em;display:flex;gap:24px;flex-wrap:wrap;">
      <li>写真数: <strong>${summary.totalPhotos}</strong></li>
      <li>欠陥総数: <strong>${summary.totalDefects}</strong></li>
      <li>高リスク欠陥: <strong style="color:${summary.highSeverityCount > 0 ? COLOR_DANGER : "inherit"}">${summary.highSeverityCount}</strong></li>
    </ul>
    ${
      defectSummaryRows
        ? `<table style="border-collapse:collapse;font-size:0.85em;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:3px 8px;text-align:left;border:1px solid #e2e8f0;">欠陥種別</th>
            <th style="padding:3px 8px;text-align:center;border:1px solid #e2e8f0;">件数</th>
          </tr>
        </thead>
        <tbody>${defectSummaryRows}</tbody>
      </table>`
        : `<p style="font-size:0.85em;color:${COLOR_NEUTRAL};">欠陥は検出されませんでした。</p>`
    }
  </section>

  <section>
    <h2 style="font-size:1.1em;margin-bottom:12px;">写真詳細 (${report.photos.length}枚)</h2>
    ${photoSections || `<p style="color:${COLOR_NEUTRAL};">写真なし</p>`}
  </section>
</body>
</html>`;
}
