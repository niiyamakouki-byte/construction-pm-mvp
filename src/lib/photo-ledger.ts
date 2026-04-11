/**
 * Photo Ledger — 写真台帳自動生成
 *
 * 国交省デジタル写真管理情報基準対応の写真台帳HTMLを生成する。
 * 蔵衛門蒸留: 複数レイアウト対応（1/2/4/6枚/ページ）
 * PDF変換はブラウザ側の window.print() で対応（サーバーレス）
 */

import type { PhotoCategory } from "./photo-classifier.js";
import { escapeHtml } from "./utils/escape-html";

// ── Data types ────────────────────────────────────────────────────────────

export type PhotoLedgerEntry = {
  photoUrl: string;
  blackboardData?: {
    workType: string;
    location: string;
    condition: string;
  };
  shootDate: string; // "YYYY-MM-DD"
  category: PhotoCategory;
  comment?: string;
  fileName?: string;
};

export type PhotoLedgerCoverInfo = {
  projectName: string;         // 工事名
  projectNumber?: string;      // 工事番号
  startDate?: string;          // 着工日 "YYYY-MM-DD"
  endDate?: string;            // 竣工日 "YYYY-MM-DD"
  orderer?: string;            // 発注者
  contractor?: string;         // 施工者
  location?: string;           // 工事場所
  createdAt?: string;          // 作成日 "YYYY-MM-DD"
};

/** 国交省デジタル写真管理情報基準対応メタデータ */
export type PhotoLedgerMetadata = {
  standard: "CALS/EC";
  version: "4.0";
  projectName: string;
  contractorName: string;
  createdAt: string;           // ISO datetime
  photoCount: number;
  categories: PhotoCategory[];
};

export type PhotoLedgerLayout = 1 | 2 | 4 | 6;

export type PhotoLedgerInput = {
  cover: PhotoLedgerCoverInfo;
  entries: PhotoLedgerEntry[];
  layout?: PhotoLedgerLayout;  // default: 4
};

// ── Helpers ────────────────────────────────────────────────────────────────


function formatDateJa(date: string | undefined): string {
  if (!date) return "未記入";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// ── Styles ─────────────────────────────────────────────────────────────────

const LEDGER_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: "Hiragino Sans", "Yu Gothic", "MS Gothic", sans-serif;
    margin: 0;
    padding: 0;
    color: #222;
    font-size: 12px;
    background: #fff;
  }
  .cover-page {
    width: 210mm;
    min-height: 297mm;
    padding: 30mm 25mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    page-break-after: always;
    border: 1px solid #ccc;
  }
  .cover-title {
    font-size: 2em;
    font-weight: 700;
    border-bottom: 3px double #1e293b;
    padding-bottom: 12px;
    margin-bottom: 32px;
    letter-spacing: 0.2em;
    text-align: center;
  }
  .cover-table {
    width: 100%;
    max-width: 140mm;
    border-collapse: collapse;
    margin-bottom: 24px;
  }
  .cover-table th {
    background: #f1f5f9;
    border: 1px solid #94a3b8;
    padding: 8px 12px;
    text-align: left;
    font-weight: 600;
    width: 35%;
    white-space: nowrap;
  }
  .cover-table td {
    border: 1px solid #94a3b8;
    padding: 8px 12px;
  }
  .cover-stamp {
    margin-top: 32px;
    border: 1px solid #94a3b8;
    padding: 12px 24px;
    text-align: center;
    font-size: 0.9em;
    color: #64748b;
  }
  .ledger-page {
    width: 210mm;
    min-height: 297mm;
    padding: 8mm 8mm;
    page-break-after: always;
    border: 1px solid #ccc;
  }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #1e293b;
    padding-bottom: 4px;
    margin-bottom: 8px;
  }
  .page-header-title {
    font-size: 1em;
    font-weight: 700;
  }
  .page-header-meta {
    font-size: 0.85em;
    color: #64748b;
  }
  .photo-grid-1 {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .photo-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .photo-grid-4 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 8px;
  }
  .photo-grid-6 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 6px;
  }
  .photo-cell {
    border: 1px solid #cbd5e1;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
  }
  .photo-cell img {
    width: 100%;
    object-fit: cover;
    display: block;
    background: #e2e8f0;
  }
  .photo-grid-1 .photo-cell img  { height: 180mm; }
  .photo-grid-2 .photo-cell img  { height: 88mm; }
  .photo-grid-4 .photo-cell img  { height: 55mm; }
  .photo-grid-6 .photo-cell img  { height: 48mm; }
  .photo-caption {
    padding: 4px 6px;
    border-top: 1px solid #e2e8f0;
    font-size: 0.8em;
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }
  .caption-row {
    display: flex;
    gap: 4px;
  }
  .caption-label {
    color: #64748b;
    min-width: 3em;
    flex-shrink: 0;
  }
  .caption-value {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .photo-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    font-size: 0.9em;
    background: #f1f5f9;
  }
  .page-footer {
    text-align: center;
    font-size: 0.75em;
    color: #94a3b8;
    margin-top: 6px;
    border-top: 1px solid #e2e8f0;
    padding-top: 4px;
  }
  @media print {
    body { margin: 0; padding: 0; }
    .cover-page, .ledger-page { border: none; page-break-after: always; }
  }
`;

// ── Cover page ─────────────────────────────────────────────────────────────

function buildCoverHtml(cover: PhotoLedgerCoverInfo, totalPhotos: number): string {
  const rows: [string, string][] = [
    ["工事名", cover.projectName],
    ["工事番号", cover.projectNumber ?? ""],
    ["工事場所", cover.location ?? ""],
    ["着工日", cover.startDate ? formatDateJa(cover.startDate) : ""],
    ["竣工日", cover.endDate ? formatDateJa(cover.endDate) : ""],
    ["発注者", cover.orderer ?? ""],
    ["施工者", cover.contractor ?? ""],
    ["作成日", cover.createdAt ? formatDateJa(cover.createdAt) : ""],
    ["写真枚数", `${totalPhotos}枚`],
  ];

  const tableRows = rows
    .map(([label, value]) =>
      `    <tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value || "—")}</td></tr>`)
    .join("\n");

  return `<div class="cover-page">
  <div class="cover-title">写 真 台 帳</div>
  <table class="cover-table">
${tableRows}
  </table>
  <div class="cover-stamp">
    国土交通省 デジタル写真管理情報基準 (CALS/EC) 対応
  </div>
</div>`;
}

// ── Photo cell ─────────────────────────────────────────────────────────────

function buildPhotoCellHtml(entry: PhotoLedgerEntry | null, layout: PhotoLedgerLayout): string {
  if (!entry) {
    return `<div class="photo-cell">
  <div class="photo-placeholder photo-grid-${layout}" style="height:${
    layout === 1 ? "180mm" : layout === 2 ? "88mm" : layout === 4 ? "55mm" : "48mm"
  };display:flex;align-items:center;justify-content:center;color:#94a3b8;">
    （空欄）
  </div>
</div>`;
  }

  const caption = [
    ["日付", entry.shootDate],
    ["区分", entry.category],
    entry.blackboardData ? ["工種", entry.blackboardData.workType] : null,
    entry.blackboardData ? ["部位", entry.blackboardData.location] : null,
    entry.blackboardData ? ["状況", entry.blackboardData.condition] : null,
    entry.comment ? ["備考", entry.comment] : null,
  ]
    .filter(Boolean)
    .map(
      (row) =>
        `    <div class="caption-row"><span class="caption-label">${escapeHtml(row![0])}</span>` +
        `<span class="caption-value">${escapeHtml(row![1])}</span></div>`,
    )
    .join("\n");

  return `<div class="photo-cell">
  <img src="${escapeHtml(entry.photoUrl)}" alt="${escapeHtml(entry.category)}写真" loading="lazy" />
  <div class="photo-caption">
${caption}
  </div>
</div>`;
}

// ── Ledger pages ───────────────────────────────────────────────────────────

function buildLedgerPages(
  entries: PhotoLedgerEntry[],
  layout: PhotoLedgerLayout,
  coverInfo: PhotoLedgerCoverInfo,
): string {
  if (entries.length === 0) {
    return `<div class="ledger-page">
  <div class="page-header">
    <div class="page-header-title">${escapeHtml(coverInfo.projectName)} — 写真台帳</div>
    <div class="page-header-meta">写真なし</div>
  </div>
  <p style="color:#94a3b8;text-align:center;padding:20mm 0;">写真が登録されていません</p>
</div>`;
  }

  const pages: string[] = [];
  const perPage = layout;

  for (let i = 0; i < entries.length; i += perPage) {
    const pageEntries = entries.slice(i, i + perPage);
    // Pad to fill grid
    while (pageEntries.length < perPage) pageEntries.push(null as unknown as PhotoLedgerEntry);

    const pageNum = Math.floor(i / perPage) + 1;
    const totalPages = Math.ceil(entries.length / perPage);

    const cells = pageEntries
      .map((e) => buildPhotoCellHtml(e, layout))
      .join("\n");

    pages.push(`<div class="ledger-page">
  <div class="page-header">
    <div class="page-header-title">${escapeHtml(coverInfo.projectName)} — 写真台帳</div>
    <div class="page-header-meta">第 ${pageNum} / ${totalPages} 頁</div>
  </div>
  <div class="photo-grid-${layout}">
${cells}
  </div>
  <div class="page-footer">${escapeHtml(coverInfo.projectName)} 写真台帳 — ${pageNum}/${totalPages}</div>
</div>`);
  }

  return pages.join("\n");
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * buildPhotoLedgerHtml — 写真台帳のHTML文字列を生成する。
 * PDF変換はブラウザ側の window.print() で対応。
 */
export function buildPhotoLedgerHtml(input: PhotoLedgerInput): string {
  const { cover, entries, layout = 4 } = input;

  const coverHtml = buildCoverHtml(cover, entries.length);
  const pagesHtml = buildLedgerPages(entries, layout, cover);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(cover.projectName)} — 写真台帳</title>
  <style>${LEDGER_STYLES}</style>
</head>
<body>
${coverHtml}
${pagesHtml}
</body>
</html>`;
}

/**
 * buildPhotoLedgerMetadata — 国交省 CALS/EC デジタル写真管理情報基準対応メタデータを生成する。
 */
export function buildPhotoLedgerMetadata(
  input: PhotoLedgerInput,
): PhotoLedgerMetadata {
  const { cover, entries } = input;
  const categories = [...new Set(entries.map((e) => e.category))] as PhotoCategory[];

  return {
    standard: "CALS/EC",
    version: "4.0",
    projectName: cover.projectName,
    contractorName: cover.contractor ?? "",
    createdAt: cover.createdAt
      ? new Date(cover.createdAt).toISOString()
      : new Date().toISOString(),
    photoCount: entries.length,
    categories,
  };
}
