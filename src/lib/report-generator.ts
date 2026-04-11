/**
 * Report Generator — 日報・週報・プロジェクト報告書 PDF Blob 生成
 *
 * 既存モジュールからデータを取得し、HTML を構築したうえで
 * jsPDF で PDF Blob に変換して返す。
 */

import type { Project, Task, Expense } from "../domain/types.js";
import type { SiteEntryRecord } from "./site-entry-log.js";
import { getEntryLog } from "./site-entry-log.js";
import {
  generateForecastReport,
  type ForecastReport,
} from "./cost-forecaster.js";
import {
  assessProjectHealth,
  type HealthScore,
  type HealthAssessmentInput,
} from "./project-health.js";
import {
  calculateEarnedValue,
  schedulePerformanceIndex,
  costPerformanceIndex,
  estimateAtCompletion,
  type ProgressTask,
} from "./earned-value.js";

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Validate that a URL is safe to use in an img src attribute.
 * Allows http, https, and data:image schemes only.
 * Returns the original URL if valid, or an empty string if rejected.
 */
function sanitizePhotoUrl(url: string): string {
  try {
    const trimmed = url.trim();
    // Allow data:image/* URIs
    if (/^data:image\//i.test(trimmed)) return trimmed;
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return trimmed;
  } catch {
    // Invalid URL — reject
  }
  return "";
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrency(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

const BASE_STYLES = `
  body { font-family: "Hiragino Sans", "Yu Gothic", sans-serif; margin: 20px; color: #333; font-size: 13px; }
  h1 { font-size: 1.4em; border-bottom: 2px solid #1e293b; padding-bottom: 6px; margin-bottom: 12px; }
  h2 { font-size: 1.1em; margin-top: 1.4em; border-left: 4px solid #2563eb; padding-left: 8px; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 10px; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; }
  .meta { display: flex; flex-wrap: wrap; gap: 1.5em; margin: 8px 0 14px; }
  .meta-item { display: flex; gap: 4px; }
  .meta-item .label { color: #64748b; }
  .meta-item .value { font-weight: 600; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.8em; font-weight: 600; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-yellow { background: #fef9c3; color: #854d0e; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  @media print { body { margin: 0; } }
`;

function htmlDoc(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
${body}
</body>
</html>`;
}

// ── PDF conversion ─────────────────────────────────────────────────────────

/**
 * Convert an HTML string to a PDF Blob via jsPDF html().
 * This is async because jsPDF's html() uses html2canvas internally.
 */
export async function htmlToBlob(html: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  return new Promise<Blob>((resolve, reject) => {
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.innerHTML = html;
    document.body.appendChild(container);

    const cleanup = () => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };

    // Safety timeout
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("htmlToBlob timed out"));
    }, 30_000);

    try {
      doc.html(container, {
        callback(pdf) {
          clearTimeout(timeoutId);
          cleanup();
          try {
            const blob = pdf.output("blob");
            resolve(blob);
          } catch (err) {
            reject(err);
          }
        },
        x: 20,
        y: 20,
        width: 555,
        windowWidth: 794,
        autoPaging: "text",
      });
    } catch (err) {
      clearTimeout(timeoutId);
      cleanup();
      reject(err);
    }
  });
}

// ── Input types ────────────────────────────────────────────────────────────

export type DailyReportInput = {
  project: Project;
  date: string; // "YYYY-MM-DD"
  weather?: string;
  tasks?: Task[];
  entryRecords?: SiteEntryRecord[];
  workContent?: string;
  photoUrls?: string[];
  safetyNotes?: string;
  issues?: string[];
};

export type WeeklyReportInput = {
  project: Project;
  startDate: string; // "YYYY-MM-DD" (Monday)
  tasks?: ProgressTask[];
  expenses?: Expense[];
};

export type ProjectReportInput = {
  project: Project;
  tasks?: ProgressTask[];
  expenses?: Expense[];
  costRows?: HealthAssessmentInput["costRows"];
  inspectionPassRate?: number;
};

// ── HTML builders ─────────────────────────────────────────────────────────

export function buildDailyReportHtml(input: DailyReportInput): string {
  const { project, date, weather, tasks = [], workContent, photoUrls = [], safetyNotes, issues = [] } = input;
  const entryRecords: SiteEntryRecord[] = input.entryRecords ?? getEntryLog(project.id, date);

  const entriesHtml = entryRecords.length > 0
    ? entryRecords
        .map(
          (r) =>
            `<tr><td>${escapeHtml(r.workerName)}</td><td>${escapeHtml(r.company)}</td>` +
            `<td>${escapeHtml(r.entryTime.slice(11, 16))}</td>` +
            `<td>${r.exitTime ? escapeHtml(r.exitTime.slice(11, 16)) : "在場"}</td></tr>`,
        )
        .join("\n")
    : `<tr><td colspan="4">記録なし</td></tr>`;

  const taskRows = tasks.length > 0
    ? tasks
        .map(
          (t) =>
            `<tr><td>${escapeHtml(t.name)}</td><td>${t.progress ?? 0}%</td><td>${escapeHtml(t.status)}</td></tr>`,
        )
        .join("\n")
    : `<tr><td colspan="3">作業なし</td></tr>`;

  const photoSection = photoUrls.length > 0
    ? photoUrls
        .map((url) => {
          const safe = sanitizePhotoUrl(url);
          if (!safe) return "";
          return `<img src="${escapeHtml(safe)}" alt="現場写真" style="max-width:280px;margin:4px;border:1px solid #e2e8f0;" />`;
        })
        .filter(Boolean)
        .join("\n") || "<p>写真なし</p>"
    : "<p>写真なし</p>";

  const issuesList = issues.length > 0
    ? `<ul>${issues.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`
    : "<p>特記事項なし</p>";

  const body = `
  <h1>作業日報</h1>
  <div class="meta">
    <div class="meta-item"><span class="label">現場名:</span><span class="value">${escapeHtml(project.name)}</span></div>
    <div class="meta-item"><span class="label">日付:</span><span class="value">${escapeHtml(date)}</span></div>
    <div class="meta-item"><span class="label">天候:</span><span class="value">${escapeHtml(weather ?? "未記入")}</span></div>
  </div>

  <h2>入退場記録</h2>
  <table>
    <thead><tr><th>氏名</th><th>会社</th><th>入場</th><th>退場</th></tr></thead>
    <tbody>${entriesHtml}</tbody>
  </table>

  <h2>作業内容</h2>
  ${workContent ? `<p>${escapeHtml(workContent)}</p>` : ""}
  <table>
    <thead><tr><th>タスク名</th><th>進捗</th><th>ステータス</th></tr></thead>
    <tbody>${taskRows}</tbody>
  </table>

  <h2>現場写真</h2>
  ${photoSection}

  <h2>安全記録</h2>
  <p>${safetyNotes ? escapeHtml(safetyNotes) : "特記事項なし"}</p>

  <h2>問題・遅延</h2>
  ${issuesList}
`;

  return htmlDoc(`日報 - ${project.name} - ${date}`, body);
}

export function buildWeeklyReportHtml(input: WeeklyReportInput): string {
  const { project, startDate, tasks = [], expenses = [] } = input;

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  const endDateStr = endDate.toISOString().slice(0, 10);

  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length;
  const avgProgress = tasks.length > 0
    ? Math.round(tasks.reduce((s, t) => s + (t.progress ?? 0), 0) / tasks.length)
    : 0;

  const budget = project.budget ?? 0;
  const totalSpent = expenses
    .filter((e) => e.approvalStatus === "approved" || e.approvalStatus === "pending")
    .reduce((s, e) => s + e.amount, 0);
  const costRate = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;

  // Man-hours per company this week
  const weekEntries: SiteEntryRecord[] = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayStr = d.toISOString().slice(0, 10);
    weekEntries.push(...getEntryLog(project.id, dayStr));
  }
  const companyCounts = weekEntries.reduce<Record<string, number>>((acc, r) => {
    acc[r.company] = (acc[r.company] ?? 0) + 1;
    return acc;
  }, {});
  const manDayRows = Object.entries(companyCounts)
    .map(([company, count]) => `<tr><td>${escapeHtml(company)}</td><td>${count}</td></tr>`)
    .join("\n");

  const riskBadge = (label: string) => {
    const cls = label === "low" ? "badge-green" : label === "medium" ? "badge-yellow" : "badge-red";
    return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
  };

  let forecastHtml = "";
  if (tasks.length > 0) {
    const report: ForecastReport = generateForecastReport(project, tasks, expenses);
    forecastHtml = `
  <h2>コスト予測</h2>
  <table>
    <thead><tr><th>項目</th><th>金額</th></tr></thead>
    <tbody>
      <tr><td>総予算</td><td>${escapeHtml(formatCurrency(report.totalBudget))}</td></tr>
      <tr><td>実績消化</td><td>${escapeHtml(formatCurrency(report.spentToDate))}</td></tr>
      <tr><td>最終コスト予測</td><td>${escapeHtml(formatCurrency(report.predictedFinalCost))}</td></tr>
      <tr><td>予算過不足</td><td>${escapeHtml(formatCurrency(report.overUnder))}</td></tr>
      <tr><td>リスクレベル</td><td>${riskBadge(report.riskLevel)}</td></tr>
    </tbody>
  </table>
    `;
  }

  const body = `
  <h1>週報</h1>
  <div class="meta">
    <div class="meta-item"><span class="label">現場名:</span><span class="value">${escapeHtml(project.name)}</span></div>
    <div class="meta-item"><span class="label">期間:</span><span class="value">${escapeHtml(startDate)} 〜 ${escapeHtml(endDateStr)}</span></div>
  </div>

  <h2>週間サマリー</h2>
  <table>
    <thead><tr><th>指標</th><th>値</th></tr></thead>
    <tbody>
      <tr><td>平均進捗率</td><td>${formatPercent(avgProgress)}</td></tr>
      <tr><td>完了タスク</td><td>${completedTasks} / ${tasks.length}</td></tr>
      <tr><td>進行中タスク</td><td>${inProgressTasks}</td></tr>
      <tr><td>コスト消化率</td><td>${formatPercent(costRate)}</td></tr>
    </tbody>
  </table>

  <h2>人工集計（週）</h2>
  <table>
    <thead><tr><th>会社名</th><th>入場回数</th></tr></thead>
    <tbody>${manDayRows || "<tr><td colspan=\"2\">記録なし</td></tr>"}</tbody>
  </table>

  ${forecastHtml}
`;

  return htmlDoc(`週報 - ${project.name} - ${startDate}`, body);
}

export function buildProjectReportHtml(input: ProjectReportInput): string {
  const { project, tasks = [], expenses = [], costRows = [], inspectionPassRate } = input;

  const budget = project.budget ?? 0;
  const asOfDate = new Date().toISOString().slice(0, 10);

  // EVM
  const metrics = calculateEarnedValue(tasks, budget, asOfDate);
  const spi = schedulePerformanceIndex(tasks, budget, asOfDate);
  const cpi = costPerformanceIndex(tasks, undefined, budget, asOfDate);
  const eac = estimateAtCompletion(metrics.bac, cpi);

  // Health
  const health: HealthScore = assessProjectHealth({ project, tasks, costRows, inspectionPassRate, asOfDate });

  const gradeColor: Record<string, string> = {
    A: "#22c55e", B: "#84cc16", C: "#eab308", D: "#f97316", F: "#ef4444",
  };

  // Forecast
  const forecast = generateForecastReport(project, tasks, expenses);

  const catRows = health.categories
    .map((c) => `<tr><td>${escapeHtml(c.category)}</td><td>${c.score}</td><td>${escapeHtml(c.label)}</td><td>${escapeHtml(c.detail)}</td></tr>`)
    .join("\n");

  const recItems = [...health.recommendations, ...forecast.recommendations]
    .filter(Boolean)
    .map((r) => `<li>${escapeHtml(r)}</li>`)
    .join("\n");

  const body = `
  <h1>プロジェクト報告書</h1>
  <div class="meta">
    <div class="meta-item"><span class="label">現場名:</span><span class="value">${escapeHtml(project.name)}</span></div>
    <div class="meta-item"><span class="label">ステータス:</span><span class="value">${escapeHtml(project.status)}</span></div>
    <div class="meta-item"><span class="label">作成日:</span><span class="value">${escapeHtml(asOfDate)}</span></div>
  </div>

  <h2>健全性スコア</h2>
  <div style="display:flex;align-items:center;gap:16px;margin:8px 0;">
    <div style="font-size:3em;font-weight:700;color:${gradeColor[health.grade] ?? "#333"}">${health.grade}</div>
    <div style="font-size:1.8em;font-weight:700;">${health.overall} / 100</div>
  </div>
  <table>
    <thead><tr><th>カテゴリ</th><th>スコア</th><th>評価</th><th>詳細</th></tr></thead>
    <tbody>${catRows}</tbody>
  </table>

  <h2>EVM指標</h2>
  <table>
    <thead><tr><th>指標</th><th>値</th></tr></thead>
    <tbody>
      <tr><td>EV (出来高)</td><td>${formatCurrency(metrics.ev)}</td></tr>
      <tr><td>PV (計画値)</td><td>${formatCurrency(metrics.pv)}</td></tr>
      <tr><td>BAC (予算)</td><td>${formatCurrency(metrics.bac)}</td></tr>
      <tr><td>EAC (完成時予測)</td><td>${formatCurrency(eac)}</td></tr>
      <tr><td>SPI (工程効率)</td><td>${spi.toFixed(2)}</td></tr>
      <tr><td>CPI (コスト効率)</td><td>${cpi.toFixed(2)}</td></tr>
      <tr><td>進捗率</td><td>${formatPercent(metrics.percentComplete)}</td></tr>
    </tbody>
  </table>

  <h2>コスト概要</h2>
  <table>
    <thead><tr><th>項目</th><th>金額</th></tr></thead>
    <tbody>
      <tr><td>総予算</td><td>${formatCurrency(forecast.totalBudget)}</td></tr>
      <tr><td>実績消化</td><td>${formatCurrency(forecast.spentToDate)}</td></tr>
      <tr><td>残予算</td><td>${formatCurrency(forecast.remainingBudget)}</td></tr>
      <tr><td>最終コスト予測</td><td>${formatCurrency(forecast.predictedFinalCost)}</td></tr>
    </tbody>
  </table>

  <h2>リスク評価</h2>
  <p>リスクレベル: <strong>${escapeHtml(forecast.riskLevel)}</strong></p>

  <h2>推奨アクション</h2>
  <ul>${recItems || "<li>なし</li>"}</ul>
`;

  return htmlDoc(`プロジェクト報告書 - ${project.name}`, body);
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Generate a daily report PDF Blob.
 */
export async function generateDailyReport(
  projectId: string,
  date: string,
  opts: Omit<DailyReportInput, "project" | "date"> & { project: Project },
): Promise<Blob> {
  const html = buildDailyReportHtml({ ...opts, project: opts.project, date });
  return htmlToBlob(html);
}

/**
 * Generate a weekly report PDF Blob.
 */
export async function generateWeeklyReport(
  projectId: string,
  startDate: string,
  opts: Omit<WeeklyReportInput, "project" | "startDate"> & { project: Project },
): Promise<Blob> {
  const html = buildWeeklyReportHtml({ ...opts, project: opts.project, startDate });
  return htmlToBlob(html);
}

/**
 * Generate a full project report PDF Blob.
 */
export async function generateProjectReport(
  projectId: string,
  opts: Omit<ProjectReportInput, "project"> & { project: Project },
): Promise<Blob> {
  const html = buildProjectReportHtml({ ...opts, project: opts.project });
  return htmlToBlob(html);
}

// ── Monthly Report ────────────────────────────────────────────────────────

export type MonthlyReportData = {
  /** 工事概要 */
  overview?: string;
  /** 月初進捗率 (0-100) */
  progressStart?: number;
  /** 月末進捗率 (0-100) */
  progressEnd?: number;
  /** 完了タスク数 */
  completedTasks?: number;
  /** 写真枚数 */
  photoCount?: number;
  /** 是正件数 */
  correctiveCount?: number;
  /** 安全記録メモ */
  safetyNotes?: string;
  /** 出勤日数合計 */
  workDays?: number;
  /** 主要イベント */
  majorEvents?: string[];
  /** 翌月の予定 */
  nextMonthPlan?: string[];
};

const MONTHLY_PRINT_STYLES = `
  @page { size: A4 portrait; margin: 20mm; }
  @media print {
    body { margin: 0; font-size: 11px; }
    .page-break { page-break-before: always; }
  }
`;

export function buildMonthlyReportHtml(
  projectId: string,
  year: number,
  month: number,
  project: { name: string; budget?: number },
  data: MonthlyReportData,
): string {
  const {
    overview = "",
    progressStart = 0,
    progressEnd = 0,
    completedTasks = 0,
    photoCount = 0,
    correctiveCount = 0,
    safetyNotes = "",
    workDays = 0,
    majorEvents = [],
    nextMonthPlan = [],
  } = data;

  const monthLabel = `${year}年${month}月`;
  const progressDelta = progressEnd - progressStart;

  const eventItems =
    majorEvents.length > 0
      ? majorEvents.map((e) => `<li>${escapeHtml(e)}</li>`).join("")
      : "<li>特記事項なし</li>";

  const planItems =
    nextMonthPlan.length > 0
      ? nextMonthPlan.map((p) => `<li>${escapeHtml(p)}</li>`).join("")
      : "<li>未定</li>";

  const body = `
  <h1>月報</h1>
  <div class="meta">
    <div class="meta-item"><span class="label">現場名:</span><span class="value">${escapeHtml(project.name)}</span></div>
    <div class="meta-item"><span class="label">対象月:</span><span class="value">${escapeHtml(monthLabel)}</span></div>
    <div class="meta-item"><span class="label">プロジェクトID:</span><span class="value">${escapeHtml(projectId)}</span></div>
  </div>

  <h2>工事概要</h2>
  <p>${overview ? escapeHtml(overview) : "記載なし"}</p>

  <h2>月間サマリー</h2>
  <table>
    <thead><tr><th>指標</th><th>値</th></tr></thead>
    <tbody>
      <tr><td>月初進捗率</td><td>${formatPercent(progressStart)}</td></tr>
      <tr><td>月末進捗率</td><td>${formatPercent(progressEnd)}</td></tr>
      <tr><td>月間進捗増加</td><td>${progressDelta >= 0 ? "+" : ""}${formatPercent(progressDelta)}</td></tr>
      <tr><td>完了タスク数</td><td>${completedTasks} 件</td></tr>
      <tr><td>写真枚数</td><td>${photoCount} 枚</td></tr>
      <tr><td>是正件数</td><td>${correctiveCount} 件</td></tr>
      <tr><td>出勤日数</td><td>${workDays} 日</td></tr>
    </tbody>
  </table>

  <h2>安全記録</h2>
  <p>${safetyNotes ? escapeHtml(safetyNotes) : "特記事項なし"}</p>

  <h2>主要イベント</h2>
  <ul>${eventItems}</ul>

  <h2>翌月の予定</h2>
  <ul>${planItems}</ul>
`;

  const styles = BASE_STYLES + MONTHLY_PRINT_STYLES;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(`月報 - ${project.name} - ${monthLabel}`)}</title>
  <style>${styles}</style>
</head>
<body>
${body}
</body>
</html>`;
}

// ── Inspection Report ────────────────────────────────────────────────────

import type { InspectionChecklist } from "./safety-inspection.js";
import {
  evaluateChecklist,
  generateInspectionReport as buildInspectionHtml,
} from "./safety-inspection.js";

export type InspectionReportInput = {
  checklist: InspectionChecklist;
  photoUrls?: string[];
  correctiveActions?: string[];
};

/**
 * Build HTML string for an inspection report (with photos and corrective actions).
 */
export function buildInspectionReportHtml(input: InspectionReportInput): string {
  const { checklist, photoUrls = [], correctiveActions = [] } = input;
  const evaluation = evaluateChecklist(checklist);
  const baseHtml = buildInspectionHtml(checklist);

  // Inject photos and corrective action sections before closing </body>
  let extras = "";

  if (correctiveActions.length > 0) {
    const items = correctiveActions
      .map((a, i) => `<li style="padding:4px 0;">${escapeHtml(`${i + 1}. ${a}`)}</li>`)
      .join("");
    extras += `
<h2 style="font-size:1.1em;margin-top:1.4em;border-left:4px solid #ef4444;padding-left:8px;">是正項目</h2>
<ul style="padding-left:1.2em;margin:8px 0;">${items}</ul>`;
  }

  if (photoUrls.length > 0) {
    const imgs = photoUrls
      .map((url) => {
        const safe = sanitizePhotoUrl(url);
        if (!safe) return "";
        return `<img src="${escapeHtml(safe)}" style="max-width:200px;max-height:150px;object-fit:cover;border-radius:4px;border:1px solid #d1d5db;" alt="検査写真" />`;
      })
      .filter(Boolean)
      .join("\n");
    extras += `
<h2 style="font-size:1.1em;margin-top:1.4em;border-left:4px solid #2563eb;padding-left:8px;">添付写真</h2>
<div style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;">${imgs}</div>`;
  }

  if (!extras) return baseHtml;
  return baseHtml.replace("</body>", `${extras}\n</body>`);
}

/**
 * Generate an inspection report PDF Blob (検査報告書).
 */
export async function generateInspectionReport(
  input: InspectionReportInput,
): Promise<Blob> {
  const html = buildInspectionReportHtml(input);
  return htmlToBlob(html);
}
