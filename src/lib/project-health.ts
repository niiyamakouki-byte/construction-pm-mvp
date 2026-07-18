/**
 * Project Health Assessment module for GenbaHub.
 * Combines schedule (SPI), cost (CPI), quality (inspection pass rate),
 * and risk (overdue tasks + schedule gaps) into a single 0-100 health score.
 */

import type { Project, Task } from "../domain/types.js";
import type { CostRow } from "./cost-management.js";
import { summarizeCostRows } from "./cost-management.js";
import {
  calculateEarnedValue as _calculateEarnedValue,
  schedulePerformanceIndex,
  costPerformanceIndex,
  type ProgressTask,
} from "./earned-value.js";
import { detectGaps, validateSchedule } from "./schedule-validator.js";
import { escapeHtml } from "./utils/escape-html";

export type CategoryRating = {
  category: "schedule" | "cost" | "quality" | "risk";
  score: number;
  label: string;
  detail: string;
};

export type HealthScore = {
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
  categories: CategoryRating[];
  recommendations: string[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function gradeFromScore(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

function labelFromScore(score: number): string {
  if (score >= 90) return "優良";
  if (score >= 75) return "良好";
  if (score >= 60) return "普通";
  if (score >= 40) return "要注意";
  return "危険";
}

/**
 * Score schedule performance based on SPI.
 * SPI=1.0 → 100, SPI=0.8 → 60, SPI<0.5 → 0
 */
function scoreSchedule(
  tasks: ProgressTask[],
  budget: number,
  asOfDate: string,
): CategoryRating {
  if (tasks.length === 0) {
    return { category: "schedule", score: 100, label: "優良", detail: "評価対象タスクなし" };
  }

  const spi = schedulePerformanceIndex(tasks, budget, asOfDate);
  // Map SPI to 0-100: SPI 1.0 = 100, SPI 0.5 = 0, SPI > 1 capped at 100
  const score = clamp(Math.round((spi - 0.5) * 200), 0, 100);

  const detail = `SPI: ${spi.toFixed(2)}`;
  return { category: "schedule", score, label: labelFromScore(score), detail };
}

/**
 * Score cost performance based on CPI.
 * CPI=1.0 → 100, CPI=0.8 → 60, CPI<0.5 → 0
 */
function scoreCost(
  tasks: ProgressTask[],
  costRows: CostRow[],
  budget: number,
  asOfDate: string,
): CategoryRating {
  if (tasks.length === 0 && costRows.length === 0) {
    return { category: "cost", score: 100, label: "優良", detail: "コストデータなし" };
  }

  const totalActual = costRows.length > 0
    ? summarizeCostRows(costRows).total
    : undefined;

  const cpi = costPerformanceIndex(tasks, totalActual, budget, asOfDate);
  const score = clamp(Math.round((cpi - 0.5) * 200), 0, 100);

  const detail = `CPI: ${Number.isFinite(cpi) ? cpi.toFixed(2) : "N/A"}`;
  return { category: "cost", score, label: labelFromScore(score), detail };
}

/**
 * Score quality based on inspection pass rate (if provided).
 * passRate 1.0 → 100, 0.5 → 50, etc.
 */
function scoreQuality(inspectionPassRate?: number): CategoryRating {
  if (inspectionPassRate == null) {
    return { category: "quality", score: 80, label: "良好", detail: "検査データなし（デフォルト）" };
  }

  const score = clamp(Math.round(inspectionPassRate * 100), 0, 100);
  const detail = `検査合格率: ${(inspectionPassRate * 100).toFixed(1)}%`;
  return { category: "quality", score, label: labelFromScore(score), detail };
}

/**
 * Score risk based on overdue tasks, schedule gaps, and circular deps.
 */
function scoreRisk(tasks: Task[], asOfDate: string): CategoryRating {
  if (tasks.length === 0) {
    return { category: "risk", score: 100, label: "優良", detail: "評価対象タスクなし" };
  }

  let riskPenalty = 0;

  // Overdue tasks: each overdue task costs 10 points (max 50)
  const overdueTasks = tasks.filter((t) => {
    if (t.status === "done") return false;
    const endDate = t.dueDate ?? t.startDate;
    return endDate != null && endDate < asOfDate;
  });
  riskPenalty += Math.min(50, overdueTasks.length * 10);

  // Schedule gaps: each gap costs 5 points (max 25)
  const gaps = detectGaps(tasks);
  riskPenalty += Math.min(25, gaps.length * 5);

  // Circular dependencies: instant 25 penalty
  const validation = validateSchedule(tasks);
  if (validation.cycles.length > 0) {
    riskPenalty += 25;
  }

  const score = clamp(100 - riskPenalty, 0, 100);
  const details: string[] = [];
  if (overdueTasks.length > 0) details.push(`遅延${overdueTasks.length}件`);
  if (gaps.length > 0) details.push(`空白${gaps.length}件`);
  if (validation.cycles.length > 0) details.push(`循環依存${validation.cycles.length}件`);

  const detail = details.length > 0 ? details.join("、") : "リスクなし";
  return { category: "risk", score, label: labelFromScore(score), detail };
}

export type HealthAssessmentInput = {
  project: Project;
  tasks: ProgressTask[];
  costRows?: CostRow[];
  inspectionPassRate?: number;
  asOfDate?: string;
};

/**
 * Comprehensive project health assessment combining schedule, cost, quality, and risk.
 */
export function assessProjectHealth(input: HealthAssessmentInput): HealthScore {
  const {
    project,
    tasks,
    costRows = [],
    inspectionPassRate,
    asOfDate = new Date().toISOString().slice(0, 10),
  } = input;

  const budget = project.budget ?? 0;

  const schedule = scoreSchedule(tasks, budget, asOfDate);
  const cost = scoreCost(tasks, costRows, budget, asOfDate);
  const quality = scoreQuality(inspectionPassRate);
  const risk = scoreRisk(tasks, asOfDate);

  const categories = [schedule, cost, quality, risk];

  // Weighted average: schedule 30%, cost 25%, quality 20%, risk 25%
  const weights = [0.3, 0.25, 0.2, 0.25];
  const overall = Math.round(
    categories.reduce((sum, cat, i) => sum + cat.score * weights[i], 0),
  );

  const recommendations: string[] = [];
  if (schedule.score < 60) {
    recommendations.push("工程が遅れています。人員追加か工期調整を検討してください。");
  }
  if (cost.score < 60) {
    recommendations.push("コスト超過が検出されました。変更注文と調達コストを確認してください。");
  }
  if (quality.score < 60) {
    recommendations.push("品質に問題があります。検査頻度を増やしてください。");
  }
  if (risk.score < 60) {
    recommendations.push("リスクレベルが高い状態です。遅延タスクの解消と依存関係の確認を行ってください。");
  }
  if (recommendations.length === 0) {
    recommendations.push("工程は順調です。引き続き監視を続けてください。");
  }

  return {
    overall,
    grade: gradeFromScore(overall),
    categories,
    recommendations,
  };
}


/**
 * Generate a printable HTML health report.
 */
export function generateHealthReport(input: HealthAssessmentInput): string {
  const health = assessProjectHealth(input);
  const { project } = input;

  const gradeColors: Record<string, string> = {
    A: "#6f916c",
    B: "#93b18f",
    C: "#eab308",
    D: "#f97316",
    F: "#ef4444",
  };

  const categoryRows = health.categories
    .map(
      (cat) =>
        `<tr>
          <td style="padding:8px;font-weight:bold;">${escapeHtml(cat.category.toUpperCase())}</td>
          <td style="padding:8px;">${cat.score}</td>
          <td style="padding:8px;">${escapeHtml(cat.label)}</td>
          <td style="padding:8px;">${escapeHtml(cat.detail)}</td>
        </tr>`,
    )
    .join("\n");

  const recommendationItems = health.recommendations
    .map((r) => `<li>${escapeHtml(r)}</li>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>案件ヘルスレポート - ${escapeHtml(project.name)}</title>
<style>
body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#1f2937;}
table{width:100%;border-collapse:collapse;margin:16px 0;}
th,td{border:1px solid #d1d5db;text-align:left;}
th{background:#1f2937;color:white;padding:8px;}
.grade{font-size:3em;font-weight:bold;text-align:center;padding:16px;border-radius:8px;margin:16px 0;}
@media print{body{padding:0;}}
</style>
</head>
<body>
<h1>案件ヘルスレポート</h1>
<table>
<tr><td><strong>案件名</strong></td><td>${escapeHtml(project.name)}</td></tr>
<tr><td><strong>ステータス</strong></td><td>${escapeHtml(project.status)}</td></tr>
<tr><td><strong>総合スコア</strong></td><td>${health.overall}/100</td></tr>
</table>
<div class="grade" style="color:${gradeColors[health.grade] ?? "#666"};border:3px solid ${gradeColors[health.grade] ?? "#666"};">
  評価: ${health.grade}
</div>
<h2>カテゴリ別内訳</h2>
<table>
<thead><tr><th>カテゴリ</th><th>スコア</th><th>評価</th><th>詳細</th></tr></thead>
<tbody>${categoryRows}</tbody>
</table>
<h2>改善提案</h2>
<ul>${recommendationItems}</ul>
<footer style="margin-top:24px;font-size:12px;color:#6b7280;">GenbaHub 案件ヘルスモジュールにより生成</footer>
</body>
</html>`;
}
