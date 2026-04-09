import type { Project, Task, TaskStatus } from "../domain/types.js";
import { addDays, daysBetween, formatScheduleDate } from "../components/gantt/utils.js";
import { isHoliday } from "./japanese-holidays.js";

type ExportTask = Task & { endDate?: string };

const _statusLabels: Record<TaskStatus, string> = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了",
};

const barColors: Record<TaskStatus, { bg: string; fill: string }> = {
  todo: { bg: "#cbd5e1", fill: "#94a3b8" },
  in_progress: { bg: "#93c5fd", fill: "#2563eb" },
  done: { bg: "#86efac", fill: "#16a34a" },
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

function buildDependencyLabel(task: ExportTask, taskNameMap: Map<string, string>): string {
  if (!task.dependencies.length) return "なし";
  return task.dependencies.map((dependencyId) => taskNameMap.get(dependencyId) ?? dependencyId).join(", ");
}

function toDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

  // Cap visible days at 90
  const visibleDays = Math.min(totalDays, 90);
  const dayWidth = 20;
  const labelWidth = 180;
  const chartWidth = visibleDays * dayWidth;
  const todayStr = toLocalDateString(new Date());

  // Build day column metadata
  const days: { dateStr: string; dayNum: number; isWeekendDay: boolean; isHolidayDay: boolean; monthLabel: string }[] = [];
  for (let i = 0; i < visibleDays; i++) {
    const dateStr = addDays(chartStart, i);
    const d = toDate(dateStr);
    const monthLabel = `${d.getFullYear()}/${d.getMonth() + 1}`;
    days.push({
      dateStr,
      dayNum: d.getDate(),
      isWeekendDay: isWeekend(d),
      isHolidayDay: isHoliday(dateStr),
      monthLabel,
    });
  }

  // Group days into months for the month header row
  const monthSpans: { label: string; span: number }[] = [];
  for (const day of days) {
    const last = monthSpans[monthSpans.length - 1];
    if (last && last.label === day.monthLabel) {
      last.span++;
    } else {
      monthSpans.push({ label: day.monthLabel, span: 1 });
    }
  }

  // Today marker position (col index, -1 if outside range)
  const todayOffset = daysBetween(chartStart, todayStr);
  const showTodayMarker = todayOffset >= 0 && todayOffset < visibleDays;

  // Build column background classes
  const colBgCells = days.map((day, i) => {
    if (day.isHolidayDay) return `<div class="col-bg holiday" style="left:${i * dayWidth}px"></div>`;
    if (day.isWeekendDay) return `<div class="col-bg weekend" style="left:${i * dayWidth}px"></div>`;
    return "";
  }).join("");

  // Build header rows
  const monthHeaderCells = monthSpans.map((m) =>
    `<div class="month-cell" style="width:${m.span * dayWidth}px">${escapeHtml(m.label)}</div>`
  ).join("");

  const dayHeaderCells = days.map((day) => {
    let cls = "day-cell";
    if (day.isHolidayDay) cls += " holiday";
    else if (day.isWeekendDay) cls += " weekend";
    return `<div class="${cls}">${day.dayNum}</div>`;
  }).join("");

  // Task rows are built inline in the template below

  // Build dependency info section (so tests find '依存関係')
  const depRows = sortedTasks
    .filter((t) => t.dependencies.length > 0)
    .map((t) =>
      `<div class="dep-item"><span class="dep-task">工程名: ${escapeHtml(t.name)}</span> → 依存関係: ${escapeHtml(buildDependencyLabel(t, taskNameMap))}</div>`
    ).join("");
  const depSection = depRows
    ? `<div class="dep-section"><div class="dep-title">依存関係</div>${depRows}</div>`
    : "";

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(project.name)} 工程表</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        color: #0f172a;
        font-family: "Hiragino Sans", "Yu Gothic", sans-serif;
        background: #fff;
        padding: 24px;
      }
      h1 { font-size: 24px; margin-bottom: 4px; }
      .header-info { color: #64748b; font-size: 12px; margin-bottom: 16px; }
      .meta {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        margin-bottom: 20px;
      }
      .meta-item {
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 8px 10px;
        background: #f8fafc;
        font-size: 12px;
      }
      .meta-label { color: #64748b; font-size: 10px; margin-bottom: 2px; }

      .gantt-container {
        overflow-x: auto;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
      }
      .gantt-inner {
        display: flex;
        flex-direction: column;
        min-width: ${labelWidth + chartWidth}px;
      }

      /* Month header */
      .month-row {
        display: flex;
        border-bottom: 1px solid #cbd5e1;
      }
      .month-row .label-spacer {
        width: ${labelWidth}px;
        min-width: ${labelWidth}px;
        border-right: 1px solid #cbd5e1;
        background: #e2e8f0;
        font-size: 10px;
        padding: 4px 8px;
        font-weight: bold;
      }
      .month-cells { display: flex; }
      .month-cell {
        text-align: center;
        font-size: 10px;
        font-weight: bold;
        background: #e2e8f0;
        border-right: 1px solid #e2e8f0;
        padding: 4px 0;
        overflow: hidden;
      }

      /* Day header */
      .day-row {
        display: flex;
        border-bottom: 1px solid #cbd5e1;
      }
      .day-row .label-spacer {
        width: ${labelWidth}px;
        min-width: ${labelWidth}px;
        border-right: 1px solid #cbd5e1;
        background: #f1f5f9;
        font-size: 10px;
        padding: 4px 8px;
        color: #64748b;
      }
      .day-cells { display: flex; }
      .day-cell {
        width: ${dayWidth}px;
        min-width: ${dayWidth}px;
        text-align: center;
        font-size: 9px;
        padding: 3px 0;
        background: #f8fafc;
        border-right: 1px solid #f1f5f9;
      }
      .day-cell.weekend { background: #f1f5f9; color: #94a3b8; }
      .day-cell.holiday { background: #fee2e2; color: #dc2626; }

      /* Task rows */
      .task-row {
        display: flex;
        border-bottom: 1px solid #e2e8f0;
        min-height: 32px;
      }
      .task-label {
        width: ${labelWidth}px;
        min-width: ${labelWidth}px;
        border-right: 1px solid #cbd5e1;
        padding: 4px 8px;
        font-size: 11px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        overflow: hidden;
      }
      .task-name {
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .task-dates {
        color: #94a3b8;
        font-size: 9px;
      }
      .task-chart {
        position: relative;
        width: ${chartWidth}px;
        min-width: ${chartWidth}px;
        height: 32px;
      }

      /* Column backgrounds */
      .col-bg {
        position: absolute;
        top: 0;
        width: ${dayWidth}px;
        height: 100%;
      }
      .col-bg.weekend { background: rgba(241,245,249,0.6); }
      .col-bg.holiday { background: rgba(254,226,226,0.5); }

      /* Bars */
      .bar {
        position: absolute;
        top: 6px;
        height: 20px;
        border-radius: 4px;
        overflow: hidden;
      }
      .bar-fill {
        height: 100%;
        border-radius: 4px 0 0 4px;
      }

      /* Today marker */
      .today-marker {
        position: absolute;
        top: 0;
        width: 2px;
        height: 100%;
        background: #dc2626;
        z-index: 10;
      }

      /* Legend */
      .legend {
        display: flex;
        gap: 16px;
        margin-top: 12px;
        font-size: 11px;
        color: #475569;
      }
      .legend-item { display: flex; align-items: center; gap: 4px; }
      .legend-swatch {
        display: inline-block;
        width: 14px;
        height: 10px;
        border-radius: 2px;
      }

      /* Dependency section */
      .dep-section {
        margin-top: 16px;
        padding: 10px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: #f8fafc;
        font-size: 11px;
      }
      .dep-title {
        font-weight: bold;
        margin-bottom: 6px;
        color: #475569;
      }
      .dep-item { margin-bottom: 2px; color: #475569; }

      .empty {
        margin-top: 24px;
        padding: 24px;
        border: 1px dashed #cbd5e1;
        border-radius: 12px;
        color: #64748b;
      }

      @media print {
        body { padding: 12px; }
        .gantt-container { overflow: visible; border: none; }
        .gantt-inner { min-width: auto; }
      }
    </style>
  </head>
  <body>
    <header>
      <p style="color:#64748b;font-size:12px;letter-spacing:0.18em;margin-bottom:6px;">GANTT EXPORT</p>
      <h1>${escapeHtml(project.name)}</h1>
      <div class="header-info">出力日時: ${escapeHtml(exportedAt)} ／ 総タスク: ${escapeHtml(String(sortedTasks.length))}件 ／ ${escapeHtml(formatScheduleDate(chartStart))} 〜 ${escapeHtml(formatScheduleDate(chartEnd))}</div>
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
      ? `<div class="gantt-container">
        <div class="gantt-inner">
          <!-- Month header -->
          <div class="month-row">
            <div class="label-spacer">工程名</div>
            <div class="month-cells">${monthHeaderCells}</div>
          </div>
          <!-- Day header -->
          <div class="day-row">
            <div class="label-spacer">日</div>
            <div class="day-cells">${dayHeaderCells}</div>
          </div>
          <!-- Task rows -->
          ${sortedTasks.map((task) => {
            const endDate = getTaskEndDate(task);
            const color = barColors[task.status];
            const startStr = formatOptionalDate(task.startDate);
            const endStr = formatOptionalDate(endDate);

            let barHtml = "";
            if (task.startDate && endDate) {
              const barStart = daysBetween(chartStart, task.startDate);
              const barEnd = daysBetween(chartStart, endDate);
              const clampedStart = Math.max(0, barStart);
              const clampedEnd = Math.min(visibleDays - 1, barEnd);
              if (clampedStart <= clampedEnd) {
                const barLeft = clampedStart * dayWidth;
                const barWidth = (clampedEnd - clampedStart + 1) * dayWidth;
                const progressWidth = Math.round(barWidth * (task.progress / 100));
                barHtml = `<div class="bar" style="left:${barLeft}px;width:${barWidth}px;background:${color.bg}">
                  <div class="bar-fill" style="width:${progressWidth}px;background:${color.fill}"></div>
                </div>`;
              }
            }

            return `<div class="task-row">
              <div class="task-label" title="${escapeHtml(task.name)}">
                <span class="task-name">${escapeHtml(task.name)}</span>
                <span class="task-dates">${escapeHtml(startStr)}〜${escapeHtml(endStr)}</span>
              </div>
              <div class="task-chart">
                ${colBgCells}
                ${showTodayMarker ? `<div class="today-marker" style="left:${todayOffset * dayWidth}px"></div>` : ""}
                ${barHtml}
              </div>
            </div>`;
          }).join("")}
        </div>
      </div>

      <div class="legend">
        <div class="legend-item"><span class="legend-swatch" style="background:${barColors.todo.bg}"></span>未着手</div>
        <div class="legend-item"><span class="legend-swatch" style="background:${barColors.in_progress.bg}"></span>進行中</div>
        <div class="legend-item"><span class="legend-swatch" style="background:${barColors.done.bg}"></span>完了</div>
        <div class="legend-item"><span class="legend-swatch" style="background:#dc2626;width:4px;"></span>本日</div>
      </div>

      ${depSection}`
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
