/**
 * handover-pdf-builder — Markdown/HTML/PDF で引渡しパッケージを生成する。
 *
 * Sprint 17-C: 引渡しパッケージ自動生成
 */

import type { HandoverPackage, HandoverDocument, MaintenanceMilestone } from "./types.js";
import { DOCUMENT_KIND_LABELS, PACKAGE_STATUS_LABELS } from "./types.js";

export type HandoverRenderTarget = "markdown" | "html" | "pdf_data";

// ── Formatters ─────────────────────────────────────────────────────────────

function formatDateJa(iso: string): string {
  const dt = new Date(iso);
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`;
}

function formatMonths(months: number): string {
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem > 0 ? `${years}年${rem}ヶ月` : `${years}年`;
  }
  return `${months}ヶ月`;
}

// ── Markdown renderer ──────────────────────────────────────────────────────

export function renderMarkdown(pkg: HandoverPackage): string {
  const lines: string[] = [];

  // Cover
  lines.push(`# 引渡しパッケージ`);
  lines.push("");
  lines.push(`**案件ID**: ${pkg.projectId}`);
  lines.push(`**施主名**: ${pkg.ownerName}`);
  lines.push(`**工事完成日**: ${formatDateJa(pkg.completedAt)}`);
  lines.push(`**状態**: ${PACKAGE_STATUS_LABELS[pkg.status]}`);
  if (pkg.deliveredAt) {
    lines.push(`**引渡し日**: ${formatDateJa(pkg.deliveredAt)}`);
  }
  lines.push("");

  // Table of contents
  lines.push("## 目次");
  lines.push("");
  lines.push("1. 書類一覧");
  lines.push("2. 各書類詳細");
  lines.push("3. メンテナンスカレンダー");
  lines.push("4. アフターサービス連絡先");
  lines.push("");

  // Documents section
  lines.push("## 1. 書類一覧");
  lines.push("");
  lines.push("| No. | 種別 | タイトル | 保証期限 |");
  lines.push("|-----|------|----------|----------|");
  for (let i = 0; i < pkg.documents.length; i++) {
    const doc = pkg.documents[i];
    const expiry = doc.expiresAt ? formatDateJa(doc.expiresAt) : "—";
    lines.push(`| ${i + 1} | ${DOCUMENT_KIND_LABELS[doc.kind]} | ${doc.titleJa} | ${expiry} |`);
  }
  lines.push("");

  // Document details
  lines.push("## 2. 各書類詳細");
  lines.push("");
  for (const doc of pkg.documents) {
    lines.push(`### ${doc.titleJa}`);
    lines.push(`**種別**: ${DOCUMENT_KIND_LABELS[doc.kind]}`);
    if (doc.expiresAt) {
      lines.push(`**保証期限**: ${formatDateJa(doc.expiresAt)}`);
    }
    if (doc.fileRef) {
      lines.push(`**添付ファイル**: ${doc.fileRef}`);
    }
    if (doc.contentJa) {
      lines.push("");
      lines.push(doc.contentJa);
    }
    lines.push("");
  }

  // Maintenance calendar
  lines.push("## 3. メンテナンスカレンダー");
  lines.push("");
  if (pkg.maintenanceSchedule.length === 0) {
    lines.push("メンテナンススケジュールは未設定です。");
  } else {
    lines.push("| 点検時期 | 予定日 | 内容 |");
    lines.push("|----------|--------|------|");
    for (const milestone of pkg.maintenanceSchedule) {
      lines.push(
        `| ${formatMonths(milestone.intervalMonths)}後 | ${formatDateJa(milestone.scheduledAt)} | ${milestone.descriptionJa} |`,
      );
    }
  }
  lines.push("");

  // Aftercare contact
  const contactDoc = pkg.documents.find((d) => d.kind === "aftercare_contact");
  lines.push("## 4. アフターサービス連絡先");
  lines.push("");
  if (contactDoc?.contentJa) {
    lines.push(contactDoc.contentJa);
  } else {
    lines.push("施工会社にお問い合わせください。");
  }
  lines.push("");

  return lines.join("\n");
}

// ── HTML renderer ──────────────────────────────────────────────────────────

export function renderHtml(pkg: HandoverPackage): string {
  const md = renderMarkdown(pkg);

  const html = md
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
      if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
      if (line.startsWith("- ")) return `<li>${line.slice(2)}</li>`;
      if (line.match(/^\d+\. /)) return `<li>${line.replace(/^\d+\. /, "")}</li>`;
      if (line.startsWith("|")) {
        if (line.includes("---")) return "";
        const cells = line.split("|").filter((c) => c.trim());
        return `<tr>${cells.map((c) => `<td>${c.trim()}</td>`).join("")}</tr>`;
      }
      if (line.trim() === "") return "<br>";
      return `<p>${line}</p>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>引渡しパッケージ — ${pkg.ownerName} 様</title>
<style>
  body { font-family: "Hiragino Sans", "Yu Gothic", sans-serif; max-width: 800px; margin: 40px auto; color: #1e293b; line-height: 1.6; }
  h1 { color: #6B8E5A; border-bottom: 3px solid #6B8E5A; padding-bottom: 10px; font-size: 1.75rem; }
  h2 { color: #374151; margin-top: 32px; border-left: 4px solid #6B8E5A; padding-left: 12px; }
  h3 { color: #4b5563; margin-top: 20px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  td, th { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
  tr:nth-child(even) { background: #f8fafc; }
  li { margin: 4px 0; }
  p { margin: 4px 0; }
  .cover { background: #f0f4ee; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
</style>
</head>
<body>
<div class="cover">
${html}
</div>
</body>
</html>`;
}

// ── PDF data renderer (jsPDF互換 plain text) ──────────────────────────────

export function renderPdfData(pkg: HandoverPackage): string {
  // Return markdown as the base data for jsPDF text rendering
  return renderMarkdown(pkg);
}

// ── Dispatch ──────────────────────────────────────────────────────────────

export function renderHandoverPackage(
  pkg: HandoverPackage,
  target: HandoverRenderTarget,
): string {
  switch (target) {
    case "markdown":
      return renderMarkdown(pkg);
    case "html":
      return renderHtml(pkg);
    case "pdf_data":
      return renderPdfData(pkg);
  }
}

// ── Document checklist ─────────────────────────────────────────────────────

export type DocumentChecklistItem = {
  doc: HandoverDocument;
  checked: boolean;
};

/**
 * ドキュメント一覧をチェックリスト形式で返す。
 * checkedIds: チェック済みのドキュメントID一覧
 */
export function buildDocumentChecklist(
  documents: HandoverDocument[],
  checkedIds: Set<string>,
): DocumentChecklistItem[] {
  return documents.map((doc) => ({
    doc,
    checked: checkedIds.has(doc.id),
  }));
}
