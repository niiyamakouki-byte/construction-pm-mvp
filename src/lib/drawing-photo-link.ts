/**
 * Drawing photo link management — ties photos to drawing pins (SPIDERPLUS-style).
 */

export type DrawingPhotoLink = {
  id: string;
  pinId: string;
  photoId: string;
  drawingId: string;
  capturedAt: string; // ISO datetime
  note: string;
};

const STORAGE_KEY_PREFIX = "drawing_photo_links_";

// ── Internal helpers ────────────────────────────────────────────────────────

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function loadLinks(drawingId: string): DrawingPhotoLink[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + drawingId);
    if (!raw) return [];
    return JSON.parse(raw) as DrawingPhotoLink[];
  } catch {
    return [];
  }
}

function saveLinks(drawingId: string, links: DrawingPhotoLink[]): void {
  localStorage.setItem(STORAGE_KEY_PREFIX + drawingId, JSON.stringify(links));
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Link a photo to a drawing pin. Returns the created link.
 */
export function linkPhotoToPin(
  pinId: string,
  photoId: string,
  drawingId: string,
  note: string = "",
): DrawingPhotoLink {
  const link: DrawingPhotoLink = {
    id: crypto.randomUUID(),
    pinId,
    photoId,
    drawingId,
    capturedAt: new Date().toISOString(),
    note,
  };
  const existing = loadLinks(drawingId);
  saveLinks(drawingId, [...existing, link]);
  return link;
}

/**
 * Return all photos linked to a specific pin.
 */
export function getPhotosForPin(pinId: string, drawingId: string): DrawingPhotoLink[] {
  return loadLinks(drawingId).filter((l) => l.pinId === pinId);
}

/**
 * Return all links for the drawing where the pin has at least one photo.
 * De-duplicated by pinId.
 */
export function getPinsWithPhotos(drawingId: string): string[] {
  const links = loadLinks(drawingId);
  return [...new Set(links.map((l) => l.pinId))];
}

/**
 * Return pin IDs from allPinIds that have no linked photo in the drawing.
 * Used to detect photography omissions.
 */
export function getPinsWithoutPhotos(drawingId: string, allPinIds: string[]): string[] {
  const withPhotos = new Set(getPinsWithPhotos(drawingId));
  return allPinIds.filter((id) => !withPhotos.has(id));
}

/**
 * Calculate the photo completion rate (0–1) for a drawing.
 * Returns 0 when allPinIds is empty.
 */
export function getPhotoCompletionRate(drawingId: string, allPinIds: string[]): number {
  if (allPinIds.length === 0) return 0;
  const withPhotos = getPinsWithPhotos(drawingId);
  const covered = allPinIds.filter((id) => withPhotos.includes(id)).length;
  return covered / allPinIds.length;
}

/**
 * Remove a photo link by its id. Returns true if a link was removed.
 */
export function unlinkPhoto(drawingId: string, linkId: string): boolean {
  const before = loadLinks(drawingId);
  const after = before.filter((l) => l.id !== linkId);
  if (after.length === before.length) return false;
  saveLinks(drawingId, after);
  return true;
}

/**
 * Generate an HTML report of photo linkage status for a drawing.
 * Compatible with report-generator.ts htmlToBlob() for PDF download.
 */
export function buildPhotoLinkReportHtml(
  drawingId: string,
  drawingName: string,
  allPinIds: string[],
): string {
  const links = loadLinks(drawingId);
  const withPhotos = new Set(links.map((l) => l.pinId));
  const total = allPinIds.length;
  const covered = allPinIds.filter((id) => withPhotos.has(id)).length;
  const rate = total > 0 ? Math.round((covered / total) * 100) : 0;

  const generatedAt = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const rowsHtml =
    allPinIds.length > 0
      ? allPinIds
          .map((pinId, idx) => {
            const pinLinks = links.filter((l) => l.pinId === pinId);
            const hasPhoto = pinLinks.length > 0;
            const statusLabel = hasPhoto ? "撮影済" : "未撮影";
            const statusColor = hasPhoto ? "#22c55e" : "#ef4444";
            const photoCount = pinLinks.length;
            return `<tr>
              <td style="text-align:center">${idx + 1}</td>
              <td>${escapeHtml(pinId)}</td>
              <td style="text-align:center"><span style="font-weight:700;color:${statusColor}">${statusLabel}</span></td>
              <td style="text-align:center">${photoCount}</td>
            </tr>`;
          })
          .join("\n")
      : `<tr><td colspan="4" style="text-align:center;color:#94a3b8">ピンなし</td></tr>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>写真紐付けレポート - ${escapeHtml(drawingName)}</title>
  <style>
    body { font-family: "Hiragino Sans", "Yu Gothic", sans-serif; margin: 20px; color: #333; font-size: 13px; }
    h1 { font-size: 1.4em; border-bottom: 2px solid #1e293b; padding-bottom: 6px; margin-bottom: 12px; }
    .meta { display: flex; flex-wrap: wrap; gap: 1.5em; margin: 8px 0 14px; font-size: 0.9em; }
    .meta-item .label { color: #64748b; }
    .meta-item .value { font-weight: 600; }
    .rate { font-size: 1.1em; font-weight: 700; color: #1e293b; margin: 10px 0; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 10px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    tr:nth-child(even) { background: #f8fafc; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>写真紐付けレポート</h1>
  <div class="meta">
    <div class="meta-item"><span class="label">図面名: </span><span class="value">${escapeHtml(drawingName)}</span></div>
    <div class="meta-item"><span class="label">ピン総数: </span><span class="value">${total}件</span></div>
    <div class="meta-item"><span class="label">撮影済: </span><span class="value">${covered}件</span></div>
    <div class="meta-item"><span class="label">出力日: </span><span class="value">${generatedAt}</span></div>
  </div>
  <div class="rate">撮影完了率: ${rate}%</div>
  <table>
    <thead>
      <tr>
        <th style="width:40px">No.</th>
        <th>ピンID</th>
        <th style="width:80px">撮影状況</th>
        <th style="width:60px">枚数</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</body>
</html>`;
}
