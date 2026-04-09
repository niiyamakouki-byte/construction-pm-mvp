import type { Project, Task, TaskStatus } from "../domain/types.js";
import { addDays, daysBetween, formatScheduleDate } from "../components/gantt/utils.js";

type ExportTask = Task & { endDate?: string };

const statusLabels: Record<TaskStatus, string> = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了",
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatOptionalDate(value: string | undefined): string {
  return value ? formatScheduleDate(value) : "未設定";
}

function getTaskEndDate(task: ExportTask): string | undefined {
  return task.dueDate ?? task.endDate;
}

function getTaskDuration(task: ExportTask): string {
  const startDate = task.startDate;
  const endDate = getTaskEndDate(task);
  if (!startDate || !endDate) return "未設定";
  return `${Math.max(1, daysBetween(startDate, endDate))}日`;
}

function buildDependencyLabel(task: ExportTask, taskNameMap: Map<string, string>): string {
  if (!task.dependencies.length) return "なし";
  return task.dependencies.map((dependencyId) => taskNameMap.get(dependencyId) ?? dependencyId).join(", ");
}

export function buildGanttPdfHtml(
  project: Project,
  tasks: ExportTask[],
  chartStart: string,
  totalDays: number,
): string {
  const sortedTasks = [...tasks].sort((left, right) => {
    const leftDate = left.startDate ?? getTaskEndDate(left) ?? "";
    const rightDate = right.startDate ?? getTaskEndDate(right) ?? "";
    return leftDate.localeCompare(rightDate) || left.name.localeCompare(right.name, "ja");
  });
  const taskNameMap = new Map(sortedTasks.map((task) => [task.id, task.name]));
  const chartEnd = addDays(chartStart, totalDays);
  const exportedAt = new Date().toLocaleString("ja-JP", { hour12: false });

  const rows = sortedTasks.map((task) => {
    const endDate = getTaskEndDate(task);
    return `<tr>
      <td>${escapeHtml(task.name)}</td>
      <td>${escapeHtml(formatOptionalDate(task.startDate))}</td>
      <td>${escapeHtml(formatOptionalDate(endDate))}</td>
      <td>${escapeHtml(getTaskDuration(task))}</td>
      <td>${escapeHtml(statusLabels[task.status])}</td>
      <td>${escapeHtml(buildDependencyLabel(task, taskNameMap))}</td>
    </tr>`;
  }).join("");

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(project.name)} 工程表</title>
    <style>
      body {
        margin: 0;
        padding: 32px;
        color: #0f172a;
        font-family: "Hiragino Sans", "Yu Gothic", sans-serif;
        background: #fff;
      }
      h1 {
        margin: 0;
        font-size: 28px;
      }
      .meta {
        margin-top: 18px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .meta-item {
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        padding: 12px 14px;
        background: #f8fafc;
      }
      .meta-label {
        margin-bottom: 6px;
        color: #64748b;
        font-size: 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 24px;
        font-size: 12px;
      }
      th, td {
        border: 1px solid #cbd5e1;
        padding: 10px 12px;
        text-align: left;
        vertical-align: top;
      }
      th {
        background: #e2e8f0;
        font-size: 11px;
        letter-spacing: 0.04em;
      }
      .empty {
        margin-top: 24px;
        padding: 24px;
        border: 1px dashed #cbd5e1;
        border-radius: 12px;
        color: #64748b;
      }
      @media print {
        body {
          padding: 20px;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <p style="margin:0 0 8px;color:#64748b;font-size:12px;letter-spacing:0.18em;">GANTT EXPORT</p>
      <h1>${escapeHtml(project.name)}</h1>
      <div class="meta">
        <div class="meta-item">
          <div class="meta-label">出力日時</div>
          <div>${escapeHtml(exportedAt)}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">総タスク数</div>
          <div>${escapeHtml(String(sortedTasks.length))}件</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">表示開始</div>
          <div>${escapeHtml(formatScheduleDate(chartStart))}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">表示終了</div>
          <div>${escapeHtml(formatScheduleDate(chartEnd))}</div>
        </div>
      </div>
    </header>

    ${sortedTasks.length > 0
      ? `<table>
        <thead>
          <tr>
            <th>工程名</th>
            <th>開始日</th>
            <th>終了日</th>
            <th>期間</th>
            <th>状態</th>
            <th>依存関係</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`
      : '<div class="empty">出力対象のタスクはありません。</div>'}

    <script>
      window.addEventListener("load", function () {
        window.print();
      });
    </script>
  </body>
</html>`;
}

export function exportGanttToPdf(
  project: Project,
  tasks: ExportTask[],
  chartStart: string,
  totalDays: number,
): void {
  const html = buildGanttPdfHtml(project, tasks, chartStart, totalDays);

  // Try window.open first, fall back to Blob download for iOS popup blocker
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus?.();
    return;
  }

  // Fallback: download as HTML file (works on iOS)
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.name}_工程表.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
