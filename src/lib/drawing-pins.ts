/**
 * Drawing pin data management for construction drawing viewer.
 */
import { escapeHtml } from "./utils/escape-html";

export type PinStatus = "未着手" | "対応中" | "完了";

export type DrawingPin = {
  id: string;
  /** x position as ratio of image width (0-1) */
  x: number;
  /** y position as ratio of image height (0-1) */
  y: number;
  comment: string;
  assignee: string;
  dueDate: string; // YYYY-MM-DD or ""
  status: PinStatus;
  createdAt: string; // ISO datetime
};

export const PIN_STATUSES: PinStatus[] = ["未着手", "対応中", "完了"];

export const PIN_STATUS_COLORS: Record<PinStatus, string> = {
  未着手: "#ef4444",
  対応中: "#f59e0b",
  完了: "#22c55e",
};

export function createPin(partial: Omit<DrawingPin, "id" | "createdAt">): DrawingPin {
  return {
    ...partial,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
}

export function updatePin(pins: DrawingPin[], id: string, updates: Partial<Omit<DrawingPin, "id" | "createdAt">>): DrawingPin[] {
  return pins.map((p) => (p.id === id ? { ...p, ...updates } : p));
}

export function deletePin(pins: DrawingPin[], id: string): DrawingPin[] {
  return pins.filter((p) => p.id !== id);
}

const STORAGE_KEY_PREFIX = "drawing_pins_";

export function loadPins(drawingId: string): DrawingPin[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + drawingId);
    if (!raw) return [];
    return JSON.parse(raw) as DrawingPin[];
  } catch {
    return [];
  }
}

export function savePins(drawingId: string, pins: DrawingPin[]): void {
  localStorage.setItem(STORAGE_KEY_PREFIX + drawingId, JSON.stringify(pins));
}

// ── Report generation ────────────────────────────────────────────────────────


export type PinReportOptions = {
  /** When true, only output pins that are not "完了" */
  incompleteOnly?: boolean;
};

/**
 * Generate an HTML string listing drawing pins as an issue report table.
 * Compatible with report-generator.ts htmlToBlob() for PDF download.
 */
export function generatePinReport(
  pins: DrawingPin[],
  projectName: string,
  drawingName: string,
  options: PinReportOptions = {},
): string {
  const { incompleteOnly = false } = options;
  const filtered = incompleteOnly ? pins.filter((p) => p.status !== "完了") : pins;

  const STATUS_COLORS: Record<PinStatus, string> = {
    未着手: "#ef4444",
    対応中: "#f59e0b",
    完了: "#22c55e",
  };

  const rowsHtml = filtered.length > 0
    ? filtered
        .map(
          (pin, idx) =>
            `<tr>
              <td style="text-align:center">${idx + 1}</td>
              <td>(${(pin.x * 100).toFixed(1)}%, ${(pin.y * 100).toFixed(1)}%)</td>
              <td>${escapeHtml(pin.comment || "—")}</td>
              <td>${escapeHtml(pin.assignee || "—")}</td>
              <td>${escapeHtml(pin.dueDate || "—")}</td>
              <td><span style="font-weight:700;color:${STATUS_COLORS[pin.status]}">${escapeHtml(pin.status)}</span></td>
            </tr>`,
        )
        .join("\n")
    : `<tr><td colspan="6" style="text-align:center;color:#94a3b8">指摘事項なし</td></tr>`;

  const generatedAt = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const filterLabel = incompleteOnly ? "（未完了のみ）" : "（全件）";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>指摘事項一覧 - ${escapeHtml(drawingName)}</title>
  <style>
    body { font-family: "Hiragino Sans", "Yu Gothic", sans-serif; margin: 20px; color: #333; font-size: 13px; }
    h1 { font-size: 1.4em; border-bottom: 2px solid #1e293b; padding-bottom: 6px; margin-bottom: 12px; }
    .meta { display: flex; flex-wrap: wrap; gap: 1.5em; margin: 8px 0 14px; font-size: 0.9em; }
    .meta-item .label { color: #64748b; }
    .meta-item .value { font-weight: 600; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 10px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    tr:nth-child(even) { background: #f8fafc; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>指摘事項一覧${filterLabel}</h1>
  <div class="meta">
    <div class="meta-item"><span class="label">現場名: </span><span class="value">${escapeHtml(projectName)}</span></div>
    <div class="meta-item"><span class="label">図面名: </span><span class="value">${escapeHtml(drawingName)}</span></div>
    <div class="meta-item"><span class="label">件数: </span><span class="value">${filtered.length}件</span></div>
    <div class="meta-item"><span class="label">出力日: </span><span class="value">${generatedAt}</span></div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:40px">No.</th>
        <th style="width:120px">位置</th>
        <th>コメント</th>
        <th style="width:80px">担当者</th>
        <th style="width:90px">期日</th>
        <th style="width:70px">ステータス</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</body>
</html>`;
}
