import type { DailyReport, Project, Task, Contractor } from "../domain/types.js";
import { escapeHtml } from "./utils/escape-html";

export type DailyReportInput = {
  project: Project;
  date: string;
  weather?: string;
  tasks: Task[];
  contractors: Contractor[];
  materialsUsed?: string[];
  issues?: string[];
  photoUrls?: string[];
  notes?: string;
};

export type DailyReportData = {
  projectName: string;
  date: string;
  weather: string;
  workersPresent: string[];
  workCompleted: { taskName: string; progress: number; status: string }[];
  materialsUsed: string[];
  issues: string[];
  photoUrls: string[];
  notes: string;
};


/**
 * Gather data for a daily construction report.
 */
export function gatherReportData(input: DailyReportInput): DailyReportData {
  const { project, date, weather, tasks, contractors, materialsUsed, issues, photoUrls, notes } = input;

  const activeTasks = tasks.filter((task) => {
    if (!task.startDate) return task.status === "in_progress";
    const endDate = task.dueDate ?? task.startDate;
    return task.startDate <= date && endDate >= date;
  });

  const activeContractorIds = new Set(
    activeTasks
      .filter((t) => t.contractorId)
      .map((t) => t.contractorId!),
  );

  const contractorMap = new Map(contractors.map((c) => [c.id, c]));
  const workersPresent = Array.from(activeContractorIds)
    .map((id) => contractorMap.get(id)?.name ?? id)
    .sort();

  const workCompleted = activeTasks.map((task) => ({
    taskName: task.name,
    progress: task.progress,
    status: task.status,
  }));

  const allMaterials = [
    ...(materialsUsed ?? []),
    ...activeTasks.flatMap((t) => t.materials ?? []),
  ];
  const uniqueMaterials = Array.from(new Set(allMaterials));

  return {
    projectName: project.name,
    date,
    weather: weather ?? "未記入",
    workersPresent,
    workCompleted,
    materialsUsed: uniqueMaterials,
    issues: issues ?? [],
    photoUrls: photoUrls ?? [],
    notes: notes ?? "",
  };
}

/**
 * Generate a daily construction report as an HTML string for printing.
 */
export function generateDailyReport(input: DailyReportInput): string {
  const data = gatherReportData(input);

  const workRows = data.workCompleted
    .map(
      (w) =>
        `<tr><td>${escapeHtml(w.taskName)}</td><td>${w.progress}%</td><td>${escapeHtml(w.status)}</td></tr>`,
    )
    .join("\n        ");

  const materialsList = data.materialsUsed.length > 0
    ? data.materialsUsed.map((m) => `<li>${escapeHtml(m)}</li>`).join("\n        ")
    : "<li>なし</li>";

  const issuesList = data.issues.length > 0
    ? data.issues.map((i) => `<li>${escapeHtml(i)}</li>`).join("\n        ")
    : "<li>なし</li>";

  const photoSection = data.photoUrls.length > 0
    ? data.photoUrls
        .map((url) => `<img src="${escapeHtml(url)}" alt="現場写真" style="max-width:300px;margin:4px;" />`)
        .join("\n        ")
    : "<p>写真なし</p>";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>日報 - ${escapeHtml(data.projectName)} - ${data.date}</title>
  <style>
    body { font-family: "Hiragino Sans", "Yu Gothic", sans-serif; margin: 20px; color: #333; }
    h1 { font-size: 1.4em; border-bottom: 2px solid #333; padding-bottom: 4px; }
    h2 { font-size: 1.1em; margin-top: 1.2em; border-left: 4px solid #2563eb; padding-left: 8px; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; }
    th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
    th { background: #f3f4f6; }
    ul { margin: 4px 0; padding-left: 20px; }
    .meta { display: flex; gap: 2em; margin: 8px 0; }
    .meta span { font-weight: bold; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>作業日報</h1>
  <div class="meta">
    <div>現場名: <span>${escapeHtml(data.projectName)}</span></div>
    <div>日付: <span>${data.date}</span></div>
    <div>天候: <span>${escapeHtml(data.weather)}</span></div>
  </div>

  <h2>作業員</h2>
  <ul>
    ${data.workersPresent.length > 0
      ? data.workersPresent.map((w) => `<li>${escapeHtml(w)}</li>`).join("\n    ")
      : "<li>なし</li>"}
  </ul>

  <h2>作業内容</h2>
  <table>
    <thead><tr><th>作業名</th><th>進捗</th><th>ステータス</th></tr></thead>
    <tbody>
      ${workRows || "<tr><td colspan=\"3\">作業なし</td></tr>"}
    </tbody>
  </table>

  <h2>使用資材</h2>
  <ul>
    ${materialsList}
  </ul>

  <h2>問題・遅延</h2>
  <ul>
    ${issuesList}
  </ul>

  <h2>現場写真</h2>
  <div>
    ${photoSection}
  </div>

  ${data.notes ? `<h2>備考</h2><p>${escapeHtml(data.notes)}</p>` : ""}
</body>
</html>`;
}

/**
 * Convert a DailyReportData into a DailyReport domain object.
 */
export function toDailyReportEntity(
  data: DailyReportData,
  projectId: string,
  authorId?: string,
): DailyReport {
  const now = new Date().toISOString();
  return {
    id: `report-${projectId}-${data.date}`,
    projectId,
    reportDate: data.date,
    weather: data.weather,
    content: [
      `作業員: ${data.workersPresent.join(", ") || "なし"}`,
      `作業: ${data.workCompleted.map((w) => `${w.taskName}(${w.progress}%)`).join(", ") || "なし"}`,
      `資材: ${data.materialsUsed.join(", ") || "なし"}`,
      `問題: ${data.issues.join(", ") || "なし"}`,
      data.notes ? `備考: ${data.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    photoUrls: data.photoUrls,
    authorId,
    createdAt: now,
    updatedAt: now,
  };
}
