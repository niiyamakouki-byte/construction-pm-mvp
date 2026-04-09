import type { GanttTask } from "../components/gantt/types.js";
import type { Project } from "../domain/types.js";

/**
 * Export Gantt chart schedule as a printable HTML page.
 * Opens a new window with a formatted table that can be printed to PDF.
 */
export function exportGanttToPdf(
  project: Project,
  tasks: GanttTask[],
  _chartStart: string,
  _totalDays: number,
): void {
  const timestamp = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const sorted = [...tasks].sort((a, b) => a.startDate.localeCompare(b.startDate));

  const statusLabel: Record<string, string> = {
    todo: "未着手",
    in_progress: "進行中",
    done: "完了",
    blocked: "ブロック",
  };

  const rows = sorted
    .map(
      (t) =>
        `<tr>
          <td>${t.name}</td>
          <td>${t.startDate}</td>
          <td>${t.endDate}</td>
          <td>${statusLabel[t.status] ?? t.status}</td>
          <td>${t.progress}%</td>
          <td>${(t.dependencies ?? []).length > 0 ? "あり" : "-"}</td>
        </tr>`,
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8"/>
<title>${project.name} 工程表</title>
<style>
  body { font-family: sans-serif; padding: 20px; }
  h1 { font-size: 18px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>${project.name} — 工程表</h1>
<p class="meta">出力日時: ${timestamp} / タスク数: ${sorted.length}</p>
<table>
<thead><tr><th>タスク名</th><th>開始</th><th>終了</th><th>ステータス</th><th>進捗</th><th>依存</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
