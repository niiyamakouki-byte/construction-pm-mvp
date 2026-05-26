/**
 * proposal-renderer — ProposalDocument → Markdown / HTML / PDF data
 */

import type { ProposalDocument, ProposalSection } from "./types.js";
import { formatManYen } from "./price-builder.js";

// ── Markdown ───────────────────────────────────────────────────────────────

function sectionToMarkdown(section: ProposalSection): string {
  const heading = `## ${section.titleJa}`;
  const body = section.bodyJa;

  if (section.callouts && section.callouts.length > 0) {
    const calloutBlock = section.callouts.map((c) => `> - ${c}`).join("\n");
    return `${heading}\n\n${body}\n\n${calloutBlock}`;
  }

  return `${heading}\n\n${body}`;
}

export function renderMarkdown(doc: ProposalDocument): string {
  const header = [
    `# ${doc.sections.find((s) => s.kind === "cover")?.titleJa ?? "ご提案書"}`,
    "",
    `**顧客名:** ${doc.customerName}`,
    `**作成日:** ${new Date(doc.generatedAt).toLocaleDateString("ja-JP")}`,
    `**有効期限:** ${doc.validUntil}`,
    `**概算工事費:** ${formatManYen(doc.totalPriceJpyLower)} 〜 ${formatManYen(doc.totalPriceJpyUpper)}`,
    `**標準工期:** ${doc.durationDays}日間`,
    "",
    "---",
    "",
  ].join("\n");

  // Skip cover section in body (already in header)
  const bodySections = doc.sections.filter((s) => s.kind !== "cover");
  const body = bodySections.map(sectionToMarkdown).join("\n\n---\n\n");

  return header + body;
}

// ── HTML ───────────────────────────────────────────────────────────────────

const CSS_A4 = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif;
    font-size: 11pt;
    line-height: 1.7;
    color: #2d2d2d;
    background: #fff;
  }
  .page {
    max-width: 210mm;
    margin: 0 auto;
    padding: 20mm 18mm;
  }
  .cover {
    text-align: center;
    padding: 40mm 0 30mm;
    border-bottom: 3px solid #6B8E5A;
    margin-bottom: 16pt;
  }
  .cover h1 {
    font-size: 24pt;
    color: #6B8E5A;
    margin-bottom: 8pt;
    letter-spacing: 0.08em;
  }
  .cover .meta {
    font-size: 10pt;
    color: #666;
    margin-top: 12pt;
  }
  .section {
    margin-bottom: 20pt;
    page-break-inside: avoid;
  }
  .section h2 {
    font-size: 13pt;
    color: #6B8E5A;
    border-left: 4px solid #6B8E5A;
    padding-left: 8pt;
    margin-bottom: 8pt;
  }
  .section p {
    white-space: pre-wrap;
    margin-bottom: 6pt;
  }
  .callout-box {
    background: #f0f5ed;
    border-left: 3px solid #6B8E5A;
    padding: 8pt 12pt;
    margin: 8pt 0;
    border-radius: 0 4px 4px 0;
  }
  .callout-box ul {
    list-style: none;
    padding: 0;
  }
  .callout-box li::before {
    content: "✓ ";
    color: #6B8E5A;
    font-weight: bold;
  }
  .footer {
    margin-top: 24pt;
    padding-top: 12pt;
    border-top: 1px solid #ccc;
    font-size: 9pt;
    color: #888;
    text-align: center;
  }
  hr { border: none; border-top: 1px solid #e0e0e0; margin: 16pt 0; }
  @media print {
    body { font-size: 10pt; }
    .page { padding: 15mm 12mm; }
    .section { page-break-inside: avoid; }
  }
`.trim();

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bodyToHtml(body: string): string {
  // Bold **text** → <strong>text</strong>
  const withBold = escapeHtml(body).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Preserve newlines
  return withBold.replace(/\n/g, "<br>");
}

function sectionToHtml(section: ProposalSection): string {
  if (section.kind === "cover") return "";

  const calloutsHtml =
    section.callouts && section.callouts.length > 0
      ? `<div class="callout-box"><ul>${section.callouts
          .map((c) => `<li>${escapeHtml(c)}</li>`)
          .join("")}</ul></div>`
      : "";

  return `<div class="section">
  <h2>${escapeHtml(section.titleJa)}</h2>
  <p>${bodyToHtml(section.bodyJa)}</p>
  ${calloutsHtml}
</div>`;
}

export function renderHtml(doc: ProposalDocument): string {
  const coverSection = doc.sections.find((s) => s.kind === "cover");
  const coverBody = coverSection ? bodyToHtml(coverSection.bodyJa) : "";

  const coverHtml = `<div class="cover">
  <h1>ご提案書</h1>
  <p>${coverBody}</p>
  <div class="meta">
    <p>作成日: ${new Date(doc.generatedAt).toLocaleDateString("ja-JP")} | 有効期限: ${doc.validUntil}</p>
    <p>概算工事費: ${formatManYen(doc.totalPriceJpyLower)} 〜 ${formatManYen(doc.totalPriceJpyUpper)} | 標準工期: ${doc.durationDays}日間</p>
  </div>
</div>`;

  const sectionsHtml = doc.sections
    .filter((s) => s.kind !== "cover")
    .map(sectionToHtml)
    .join("\n<hr>\n");

  const footerHtml = `<div class="footer">
  <p>株式会社ラポルタ | 本提案書の有効期限: ${doc.validUntil} | 現地調査前の概算です</p>
</div>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ご提案書 - ${escapeHtml(doc.customerName)} 様</title>
<style>${CSS_A4}</style>
</head>
<body>
<div class="page">
${coverHtml}
${sectionsHtml}
${footerHtml}
</div>
</body>
</html>`;
}

// ── PDF data (ブラウザ印刷ダイアログ経由) ────────────────────────────────

export type PdfData = {
  html: string;
  cssA4: string;
};

export function renderPdfData(doc: ProposalDocument): PdfData {
  return {
    html: renderHtml(doc),
    cssA4: CSS_A4,
  };
}
