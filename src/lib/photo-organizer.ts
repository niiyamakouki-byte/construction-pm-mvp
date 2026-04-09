/**
 * Photo organization and photo report generation for construction projects.
 */

export type PhotoMetadata = {
  id: string;
  url: string;
  capturedAt: string; // ISO date or datetime
  projectId: string;
  description: string;
  tags: string[];
};

export type PhotoGroup<K extends string = string> = {
  key: K;
  photos: PhotoMetadata[];
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toDateKey(capturedAt: string): string {
  return capturedAt.slice(0, 10); // "YYYY-MM-DD"
}

/**
 * Group photos by capture date (YYYY-MM-DD).
 * Returns groups sorted by date ascending; photos within each group
 * are sorted by capturedAt ascending.
 */
export function organizeByDate(photos: PhotoMetadata[]): PhotoGroup[] {
  const map = new Map<string, PhotoMetadata[]>();
  for (const photo of photos) {
    const key = toDateKey(photo.capturedAt);
    const group = map.get(key) ?? [];
    group.push(photo);
    map.set(key, group);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, groupPhotos]) => ({
      key,
      photos: groupPhotos.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)),
    }));
}

/**
 * Group photos by project/location (projectId).
 * Returns groups sorted by projectId; photos within each group
 * are sorted by capturedAt ascending.
 */
export function organizeByLocation(photos: PhotoMetadata[]): PhotoGroup[] {
  const map = new Map<string, PhotoMetadata[]>();
  for (const photo of photos) {
    const key = photo.projectId;
    const group = map.get(key) ?? [];
    group.push(photo);
    map.set(key, group);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, groupPhotos]) => ({
      key,
      photos: groupPhotos.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)),
    }));
}

/**
 * Generate a printable HTML photo report for a project on a given date.
 * Photos are displayed in a grid with captions (description + tags).
 */
export function generatePhotoReport(
  project: { id: string; name: string },
  date: string,
  photos: PhotoMetadata[],
): string {
  const filtered = photos
    .filter((p) => p.projectId === project.id && toDateKey(p.capturedAt) === date)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));

  const photoCards = filtered.length > 0
    ? filtered
        .map(
          (p) => `
      <div class="photo-card">
        <img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.description)}" />
        <div class="caption">
          <p>${escapeHtml(p.description)}</p>
          ${p.tags.length > 0 ? `<p class="tags">${p.tags.map((t) => escapeHtml(t)).join(", ")}</p>` : ""}
        </div>
      </div>`,
        )
        .join("\n")
    : '<p class="empty">写真なし</p>';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>写真報告書 - ${escapeHtml(project.name)} - ${date}</title>
  <style>
    body { font-family: "Hiragino Sans", "Yu Gothic", sans-serif; margin: 20px; color: #333; }
    h1 { font-size: 1.4em; border-bottom: 2px solid #333; padding-bottom: 4px; }
    .meta { display: flex; gap: 2em; margin: 8px 0; }
    .meta span { font-weight: bold; }
    .photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-top: 16px; }
    .photo-card { border: 1px solid #ccc; border-radius: 4px; overflow: hidden; }
    .photo-card img { width: 100%; height: 200px; object-fit: cover; }
    .caption { padding: 8px; }
    .caption p { margin: 4px 0; }
    .tags { color: #6b7280; font-size: 0.9em; }
    .summary { margin-top: 12px; color: #6b7280; }
    .empty { color: #9ca3af; }
    @media print { body { margin: 0; } .photo-card { break-inside: avoid; } }
  </style>
</head>
<body>
  <h1>写真報告書</h1>
  <div class="meta">
    <div>現場名: <span>${escapeHtml(project.name)}</span></div>
    <div>日付: <span>${date}</span></div>
    <div>枚数: <span>${filtered.length}</span></div>
  </div>

  <div class="photo-grid">
    ${photoCards}
  </div>

  <p class="summary">全${filtered.length}枚</p>
</body>
</html>`;
}
