/**
 * change-order-renderer — Markdown/HTML/PDF で変更指示書+影響レポートを生成。
 *
 * Sprint 17-B: 変更管理ワークフロー
 */

import type { ChangeOrder } from "./types.js";
import {
  CHANGE_ORDER_KIND_LABELS,
  CHANGE_ORDER_STATUS_LABELS,
  APPROVAL_ROLE_LABELS,
} from "./types.js";

export type ChangeOrderRenderTarget = "markdown" | "html" | "pdf_data";

// ── Formatters ─────────────────────────────────────────────────────────────

function formatJpy(jpy: number): string {
  const abs = Math.abs(jpy);
  const sign = jpy < 0 ? "▲" : jpy > 0 ? "+" : "";
  return `${sign}¥${abs.toLocaleString("ja-JP")}`;
}

function formatDateJa(iso: string): string {
  const dt = new Date(iso);
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`;
}

// ── Markdown renderer ──────────────────────────────────────────────────────

export function renderMarkdown(co: ChangeOrder): string {
  const lines: string[] = [];

  lines.push(`# 変更指示書 No.${co.id}`);
  lines.push("");
  lines.push(`**案件ID**: ${co.projectId}`);
  lines.push(`**変更種別**: ${CHANGE_ORDER_KIND_LABELS[co.kind]}`);
  lines.push(`**状態**: ${CHANGE_ORDER_STATUS_LABELS[co.status]}`);
  lines.push(`**要望者**: ${co.requestedBy}`);
  lines.push(`**受付日時**: ${formatDateJa(co.requestedAt)}`);
  if (co.targetWorkItem) lines.push(`**対象工事箇所**: ${co.targetWorkItem}`);
  lines.push("");
  lines.push("## 変更内容");
  lines.push(co.descriptionJa);
  lines.push("");

  if (co.impactAnalysis) {
    const ia = co.impactAnalysis;
    lines.push("## 影響分析");
    lines.push(`| 項目 | 値 |`);
    lines.push(`|------|-----|`);
    lines.push(`| 金額差分 | ${formatJpy(ia.costDeltaJpy)} |`);
    lines.push(`| 工期差分 | ${ia.scheduleDeltaDays > 0 ? "+" : ""}${ia.scheduleDeltaDays}日 |`);
    lines.push(`| コスト増加率 | ${ia.costIncreaseRatioPct}% ${ia.costIncreaseRatioPct >= 10 ? "⚠️ 危険" : ""} |`);
    lines.push("");

    if (ia.affectedTrades.length > 0) {
      lines.push("### 影響職種");
      for (const t of ia.affectedTrades) {
        lines.push(`- ${t}`);
      }
      lines.push("");
    }

    if (ia.dependencyChain.length > 0) {
      lines.push("### 波及連鎖");
      for (const d of ia.dependencyChain) {
        lines.push(`- ${d}`);
      }
      lines.push("");
    }
  }

  if (co.approvalRecords.length > 0) {
    lines.push("## 承認履歴");
    for (const rec of co.approvalRecords) {
      const decisionJa = rec.decision === "approved" ? "承認" : rec.decision === "rejected" ? "却下" : "エスカレート";
      lines.push(`- **${APPROVAL_ROLE_LABELS[rec.role]}** (${rec.decidedBy}): ${decisionJa} — ${formatDateJa(rec.decidedAt)}`);
      if (rec.comment) lines.push(`  > ${rec.comment}`);
    }
    lines.push("");
  }

  if (co.approvedAt) {
    lines.push(`**承認完了日**: ${formatDateJa(co.approvedAt)}`);
  } else if (co.rejectedAt) {
    lines.push(`**却下日**: ${formatDateJa(co.rejectedAt)}`);
  }

  return lines.join("\n");
}

// ── HTML renderer ──────────────────────────────────────────────────────────

export function renderHtml(co: ChangeOrder): string {
  const md = renderMarkdown(co);

  // Simple markdown → HTML conversion
  const html = md
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
      if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
      if (line.startsWith("- ")) return `<li>${line.slice(2)}</li>`;
      if (line.startsWith("> ")) return `<blockquote>${line.slice(2)}</blockquote>`;
      if (line.startsWith("|")) {
        // Skip separator rows
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
<title>変更指示書 No.${co.id}</title>
<style>
  body { font-family: sans-serif; max-width: 800px; margin: 40px auto; color: #1e293b; }
  h1 { color: #6B8E5A; border-bottom: 2px solid #6B8E5A; padding-bottom: 8px; }
  h2 { color: #374151; margin-top: 24px; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #e2e8f0; padding: 8px 12px; }
  blockquote { border-left: 3px solid #6B8E5A; margin: 0; padding-left: 12px; color: #475569; }
  li { margin: 4px 0; }
</style>
</head>
<body>
${html}
</body>
</html>`;
}

// ── PDF data renderer (jsPDF互換 plain text) ──────────────────────────────

export function renderPdfData(co: ChangeOrder): string {
  // Return markdown as the base data for jsPDF text rendering
  return renderMarkdown(co);
}

// ── Dispatch ──────────────────────────────────────────────────────────────

export function renderChangeOrder(
  co: ChangeOrder,
  target: ChangeOrderRenderTarget,
): string {
  switch (target) {
    case "markdown":
      return renderMarkdown(co);
    case "html":
      return renderHtml(co);
    case "pdf_data":
      return renderPdfData(co);
  }
}
