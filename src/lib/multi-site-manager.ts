/**
 * サクミル蒸留 — 短期多現場同時管理 + 日報→粗利自動算出
 * Multi-site manager for short-duration interior construction projects.
 */

import { escapeHtml } from "./utils/escape-html";

// ── Types ────────────────────────────────────────────────

export type SiteStatus =
  | "scheduled"
  | "in_progress"
  | "paused"
  | "completed"
  | "cancelled";

export type Site = {
  id: string;
  projectId: string;
  name: string;
  address: string;
  status: SiteStatus;
  startDate: Date;
  endDate?: Date;
  estimatedDays: number;
  budget: number;
  actualCost: number;
  workers: string[];
  currentDay: number;
};

export type DailyReportWorker = {
  name: string;
  company: string;
  hours: number;
  dailyRate: number;
};

export type DailyReportMaterial = {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type DailyReport = {
  id: string;
  siteId: string;
  date: Date;
  workers: DailyReportWorker[];
  materials: DailyReportMaterial[];
  weather: "sunny" | "cloudy" | "rain" | "snow";
  progress: number;
  note?: string;
  photos?: string[];
};

export type SiteProfitSummary = {
  siteId: string;
  siteName: string;
  budget: number;
  laborCost: number;
  materialCost: number;
  otherCost: number;
  totalCost: number;
  grossProfit: number;
  grossMargin: number;
  remainingBudget: number;
  progressRate: number;
  costPerProgress: number;
  projectedFinalCost: number;
  projectedProfit: number;
};

export type MultiSiteDashboard = {
  totalSites: number;
  activeSites: number;
  totalBudget: number;
  totalActualCost: number;
  totalGrossProfit: number;
  avgGrossMargin: number;
  siteSummaries: SiteProfitSummary[];
  alerts: string[];
};

export type WorkerAllocation = {
  workerName: string;
  siteId: string;
  siteName: string;
};

export type WorkerAssignmentSuggestion = {
  workerName: string;
  suggestedSiteId: string;
  suggestedSiteName: string;
  reason: string;
};

export type DateRange = {
  start: Date;
  end: Date;
};

export type DailyReportAggregate = {
  totalReports: number;
  totalLaborCost: number;
  totalMaterialCost: number;
  totalCost: number;
  avgProgress: number;
  weatherBreakdown: Record<string, number>;
  siteBreakdown: Record<string, { reports: number; cost: number }>;
};

export type MonthlyCashflow = {
  month: string;
  projectedSpend: number;
  cumulativeSpend: number;
};

// ── Helpers ──────────────────────────────────────────────

let _siteCounter = 0;
let _reportCounter = 0;

function generateSiteId(): string {
  return `site-${++_siteCounter}-${Date.now()}`;
}

function generateReportId(siteId: string): string {
  return `report-${siteId}-${++_reportCounter}`;
}

function calcLaborCost(workers: DailyReportWorker[]): number {
  return workers.reduce((sum, w) => sum + w.hours * w.dailyRate, 0);
}

function calcMaterialCost(materials: DailyReportMaterial[]): number {
  return materials.reduce((sum, m) => sum + m.amount, 0);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatMonthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// ── Site lifecycle ───────────────────────────────────────

/**
 * Create a new site with default values.
 */
export function createSite(
  name: string,
  address: string,
  estimatedDays: number,
  budget: number,
  startDate: Date,
  projectId = "default",
): Site {
  return {
    id: generateSiteId(),
    projectId,
    name,
    address,
    status: "scheduled",
    startDate,
    estimatedDays,
    budget,
    actualCost: 0,
    workers: [],
    currentDay: 0,
  };
}

const VALID_TRANSITIONS: Record<SiteStatus, SiteStatus[]> = {
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["paused", "completed", "cancelled"],
  paused: ["in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

/**
 * Update site status with transition validation.
 * Returns updated site or throws if transition is invalid.
 */
export function updateSiteStatus(site: Site, newStatus: SiteStatus): Site {
  const allowed = VALID_TRANSITIONS[site.status];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `無効なステータス遷移: ${site.status} → ${newStatus}`,
    );
  }
  const updated: Site = { ...site, status: newStatus };
  if (newStatus === "completed" && !updated.endDate) {
    updated.endDate = new Date();
  }
  return updated;
}

/**
 * Add a daily report and auto-update site.actualCost and currentDay.
 * Returns { updatedSite, report }.
 */
export function addDailyReport(
  site: Site,
  reportInput: Omit<DailyReport, "id" | "siteId">,
): { updatedSite: Site; report: DailyReport } {
  const report: DailyReport = {
    ...reportInput,
    id: generateReportId(site.id),
    siteId: site.id,
  };
  const laborCost = calcLaborCost(report.workers);
  const materialCost = calcMaterialCost(report.materials);
  const dayCost = laborCost + materialCost;

  const updatedSite: Site = {
    ...site,
    actualCost: site.actualCost + dayCost,
    currentDay: site.currentDay + 1,
    status: site.status === "scheduled" ? "in_progress" : site.status,
  };

  return { updatedSite, report };
}

// ── Profit calculation ───────────────────────────────────

/**
 * Calculate profit summary for a site from its daily reports.
 */
export function calculateSiteProfit(
  site: Site,
  reports: DailyReport[],
): SiteProfitSummary {
  const siteReports = reports.filter((r) => r.siteId === site.id);

  const laborCost = siteReports.reduce(
    (sum, r) => sum + calcLaborCost(r.workers),
    0,
  );
  const materialCost = siteReports.reduce(
    (sum, r) => sum + calcMaterialCost(r.materials),
    0,
  );
  const otherCost = 0; // extensible for future cost types
  const totalCost = laborCost + materialCost + otherCost;

  const grossProfit = site.budget - totalCost;
  const grossMargin = site.budget > 0 ? (grossProfit / site.budget) * 100 : 0;
  const remainingBudget = site.budget - totalCost;

  // Use max progress from reports (latest state)
  const progressRate =
    siteReports.length > 0
      ? Math.max(...siteReports.map((r) => r.progress))
      : 0;

  // Cost per progress point (avoid div/0)
  const costPerProgress =
    progressRate > 0 ? totalCost / progressRate : totalCost;

  // Projected final cost: current cost-per-progress × 100 progress points
  const projectedFinalCost =
    progressRate > 0 ? costPerProgress * 100 : totalCost;

  const projectedProfit = site.budget - projectedFinalCost;

  return {
    siteId: site.id,
    siteName: site.name,
    budget: site.budget,
    laborCost,
    materialCost,
    otherCost,
    totalCost,
    grossProfit,
    grossMargin,
    remainingBudget,
    progressRate,
    costPerProgress,
    projectedFinalCost,
    projectedProfit,
  };
}

// ── Multi-site dashboard ─────────────────────────────────

const ALERT_OVER_BUDGET_RATIO = 1.0; // 100% spent
const ALERT_HIGH_COST_RATIO = 0.9; // 90% of budget used
const ALERT_LOW_MARGIN = 10; // below 10% projected margin
const ALERT_BEHIND_SCHEDULE_RATIO = 0.8; // cost progress / day progress ratio

/**
 * Generate a dashboard summary across all sites with alerts.
 */
export function getMultiSiteDashboard(
  sites: Site[],
  reports: DailyReport[],
): MultiSiteDashboard {
  const activeSites = sites.filter(
    (s) => s.status === "in_progress" || s.status === "paused",
  );

  const siteSummaries = sites.map((s) => calculateSiteProfit(s, reports));

  const totalBudget = sites.reduce((sum, s) => sum + s.budget, 0);
  const totalActualCost = siteSummaries.reduce((sum, s) => sum + s.totalCost, 0);
  const totalGrossProfit = totalBudget - totalActualCost;
  const avgGrossMargin =
    totalBudget > 0 ? (totalGrossProfit / totalBudget) * 100 : 0;

  const alerts: string[] = [];

  for (const summary of siteSummaries) {
    const site = sites.find((s) => s.id === summary.siteId)!;

    // Over budget
    if (summary.totalCost > summary.budget) {
      alerts.push(
        `予算超過: ${summary.siteName} (予算 ${summary.budget.toLocaleString()}円 / 実績 ${summary.totalCost.toLocaleString()}円)`,
      );
    } else if (
      summary.budget > 0 &&
      summary.totalCost / summary.budget >= ALERT_HIGH_COST_RATIO
    ) {
      alerts.push(
        `予算90%超: ${summary.siteName} (使用率 ${Math.round((summary.totalCost / summary.budget) * 100)}%)`,
      );
    }

    // Low projected margin
    if (
      summary.progressRate > 0 &&
      (summary.projectedProfit / summary.budget) * 100 < ALERT_LOW_MARGIN
    ) {
      alerts.push(
        `低粗利予測: ${summary.siteName} (予測粗利 ${Math.round((summary.projectedProfit / summary.budget) * 100)}%)`,
      );
    }

    // Behind schedule: cost progress faster than day progress
    if (
      site.estimatedDays > 0 &&
      site.currentDay > 0 &&
      summary.progressRate > 0
    ) {
      const dayProgress = (site.currentDay / site.estimatedDays) * 100;
      if (
        dayProgress > 0 &&
        summary.progressRate / dayProgress < ALERT_BEHIND_SCHEDULE_RATIO
      ) {
        alerts.push(
          `工程遅延: ${summary.siteName} (工程進捗 ${Math.round(summary.progressRate)}% / 日程消化 ${Math.round(dayProgress)}%)`,
        );
      }
    }
  }

  return {
    totalSites: sites.length,
    activeSites: activeSites.length,
    totalBudget,
    totalActualCost,
    totalGrossProfit,
    avgGrossMargin,
    siteSummaries,
    alerts,
  };
}

// ── Worker allocation ────────────────────────────────────

/**
 * Show which workers are assigned to which sites on a given date.
 * Detects double-booking (same worker on multiple sites).
 */
export function getWorkerAllocation(
  sites: Site[],
  date: Date,
): {
  allocations: WorkerAllocation[];
  doubleBooked: string[];
} {
  const activeSites = sites.filter((s) => {
    if (s.status === "completed" || s.status === "cancelled") return false;
    if (s.startDate > date) return false;
    if (s.endDate && s.endDate < date) return false;
    return true;
  });

  const allocations: WorkerAllocation[] = [];
  const workerSiteMap: Record<string, string[]> = {};

  for (const site of activeSites) {
    for (const worker of site.workers) {
      allocations.push({
        workerName: worker,
        siteId: site.id,
        siteName: site.name,
      });
      if (!workerSiteMap[worker]) {
        workerSiteMap[worker] = [];
      }
      workerSiteMap[worker].push(site.id);
    }
  }

  const doubleBooked = Object.entries(workerSiteMap)
    .filter(([, siteIds]) => siteIds.length > 1)
    .map(([worker]) => worker);

  return { allocations, doubleBooked };
}

/**
 * Suggest optimal worker assignment across sites.
 * Simple heuristic: assign workers to sites with fewest workers first.
 */
export function optimizeWorkerAssignment(
  sites: Site[],
  workers: string[],
  _date: Date,
): WorkerAssignmentSuggestion[] {
  const activeSites = sites.filter(
    (s) => s.status === "in_progress" || s.status === "scheduled",
  );

  if (activeSites.length === 0) {
    return workers.map((w) => ({
      workerName: w,
      suggestedSiteId: "",
      suggestedSiteName: "割り当て先なし",
      reason: "稼働中の現場がありません",
    }));
  }

  // Sort sites by worker count ascending (assign to under-staffed sites first)
  const sorted = [...activeSites].sort(
    (a, b) => a.workers.length - b.workers.length,
  );

  return workers.map((worker, idx) => {
    const target = sorted[idx % sorted.length];
    return {
      workerName: worker,
      suggestedSiteId: target.id,
      suggestedSiteName: target.name,
      reason: `人員不足現場への配置 (現員 ${target.workers.length}名)`,
    };
  });
}

// ── Daily report aggregation ─────────────────────────────

/**
 * Aggregate daily reports across sites for a date range.
 */
export function getDailyReportSummary(
  reports: DailyReport[],
  dateRange: DateRange,
): DailyReportAggregate {
  const filtered = reports.filter(
    (r) => r.date >= dateRange.start && r.date <= dateRange.end,
  );

  const totalLaborCost = filtered.reduce(
    (sum, r) => sum + calcLaborCost(r.workers),
    0,
  );
  const totalMaterialCost = filtered.reduce(
    (sum, r) => sum + calcMaterialCost(r.materials),
    0,
  );
  const totalCost = totalLaborCost + totalMaterialCost;

  const avgProgress =
    filtered.length > 0
      ? filtered.reduce((sum, r) => sum + r.progress, 0) / filtered.length
      : 0;

  const weatherBreakdown: Record<string, number> = {};
  for (const r of filtered) {
    weatherBreakdown[r.weather] = (weatherBreakdown[r.weather] ?? 0) + 1;
  }

  const siteBreakdown: Record<string, { reports: number; cost: number }> = {};
  for (const r of filtered) {
    const cost = calcLaborCost(r.workers) + calcMaterialCost(r.materials);
    if (!siteBreakdown[r.siteId]) {
      siteBreakdown[r.siteId] = { reports: 0, cost: 0 };
    }
    siteBreakdown[r.siteId].reports += 1;
    siteBreakdown[r.siteId].cost += cost;
  }

  return {
    totalReports: filtered.length,
    totalLaborCost,
    totalMaterialCost,
    totalCost,
    avgProgress,
    weatherBreakdown,
    siteBreakdown,
  };
}

// ── HTML profit report ───────────────────────────────────

function marginColorClass(grossMargin: number): string {
  if (grossMargin < 10) return "red";
  if (grossMargin < 20) return "yellow";
  return "green";
}

/**
 * Generate printable HTML profit report with color-coded margins.
 * Red <10%, Yellow <20%, Green >=20%.
 */
export function buildProfitReportHtml(dashboard: MultiSiteDashboard): string {
  const rows = dashboard.siteSummaries
    .map((s) => {
      const colorClass = marginColorClass(s.grossMargin);
      return `    <tr class="margin-${colorClass}">
      <td>${escapeHtml(s.siteName)}</td>
      <td class="num">${s.budget.toLocaleString()}</td>
      <td class="num">${s.laborCost.toLocaleString()}</td>
      <td class="num">${s.materialCost.toLocaleString()}</td>
      <td class="num">${s.totalCost.toLocaleString()}</td>
      <td class="num">${s.grossProfit.toLocaleString()}</td>
      <td class="num margin-label">${s.grossMargin.toFixed(1)}%</td>
      <td class="num">${s.projectedFinalCost.toLocaleString()}</td>
      <td class="num">${s.projectedProfit.toLocaleString()}</td>
    </tr>`;
    })
    .join("\n");

  const alertItems =
    dashboard.alerts.length > 0
      ? dashboard.alerts.map((a) => `<li>${escapeHtml(a)}</li>`).join("\n      ")
      : "<li>アラートなし</li>";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>粗利レポート</title>
  <style>
    body { font-family: "Hiragino Sans", "Yu Gothic", sans-serif; margin: 20px; color: #333; }
    h1 { font-size: 1.4em; border-bottom: 2px solid #333; padding-bottom: 4px; }
    h2 { font-size: 1.1em; margin-top: 1.2em; border-left: 4px solid #2563eb; padding-left: 8px; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; }
    th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
    th { background: #f3f4f6; }
    td.num { text-align: right; }
    .margin-red { background: #fef2f2; }
    .margin-red .margin-label { color: #dc2626; font-weight: bold; }
    .margin-yellow { background: #fefce8; }
    .margin-yellow .margin-label { color: #ca8a04; font-weight: bold; }
    .margin-green { background: #f0fdf4; }
    .margin-green .margin-label { color: #16a34a; font-weight: bold; }
    .summary { display: flex; gap: 2em; margin: 8px 0; flex-wrap: wrap; }
    .summary div { font-size: 0.95em; }
    .summary span { font-weight: bold; }
    .alerts ul { margin: 4px 0; padding-left: 20px; color: #b45309; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>多現場粗利レポート</h1>
  <div class="summary">
    <div>総現場数: <span>${escapeHtml(dashboard.totalSites)}</span></div>
    <div>稼働中: <span>${escapeHtml(dashboard.activeSites)}</span></div>
    <div>総予算: <span>${dashboard.totalBudget.toLocaleString()}円</span></div>
    <div>総実績原価: <span>${dashboard.totalActualCost.toLocaleString()}円</span></div>
    <div>総粗利: <span>${dashboard.totalGrossProfit.toLocaleString()}円</span></div>
    <div>平均粗利率: <span>${dashboard.avgGrossMargin.toFixed(1)}%</span></div>
  </div>

  <h2>アラート</h2>
  <div class="alerts">
    <ul>
      ${alertItems}
    </ul>
  </div>

  <h2>現場別粗利内訳</h2>
  <table>
    <thead>
      <tr>
        <th>現場名</th>
        <th>予算(円)</th>
        <th>労務費</th>
        <th>材料費</th>
        <th>合計原価</th>
        <th>粗利</th>
        <th>粗利率</th>
        <th>最終原価予測</th>
        <th>予測粗利</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</body>
</html>`;
}

// ── CSV export ───────────────────────────────────────────

function csvEscape(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export daily reports to CSV string.
 */
export function exportDailyReportsCSV(reports: DailyReport[]): string {
  const header = [
    "報告ID",
    "現場ID",
    "日付",
    "天候",
    "進捗(%)",
    "労務費(円)",
    "材料費(円)",
    "合計(円)",
    "作業員数",
    "備考",
  ].join(",");

  const rows = reports.map((r) => {
    const laborCost = calcLaborCost(r.workers);
    const materialCost = calcMaterialCost(r.materials);
    const dateStr = r.date.toISOString().slice(0, 10);
    return [
      csvEscape(r.id),
      csvEscape(r.siteId),
      csvEscape(dateStr),
      csvEscape(r.weather),
      csvEscape(r.progress),
      csvEscape(laborCost),
      csvEscape(materialCost),
      csvEscape(laborCost + materialCost),
      csvEscape(r.workers.length),
      csvEscape(r.note ?? ""),
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

// ── Schedule conflict detection ──────────────────────────

/**
 * Find sites that share workers and have overlapping schedules.
 */
export function detectScheduleConflicts(
  sites: Site[],
): Array<{ worker: string; siteA: string; siteB: string }> {
  const conflicts: Array<{ worker: string; siteA: string; siteB: string }> = [];

  for (let i = 0; i < sites.length; i++) {
    for (let j = i + 1; j < sites.length; j++) {
      const siteA = sites[i];
      const siteB = sites[j];

      // Check date overlap
      const aEnd =
        siteA.endDate ??
        new Date(
          siteA.startDate.getTime() +
            siteA.estimatedDays * 24 * 60 * 60 * 1000,
        );
      const bEnd =
        siteB.endDate ??
        new Date(
          siteB.startDate.getTime() +
            siteB.estimatedDays * 24 * 60 * 60 * 1000,
        );

      const overlaps = siteA.startDate <= bEnd && siteB.startDate <= aEnd;
      if (!overlaps) continue;

      // Check shared workers
      const setA = new Set(siteA.workers);
      for (const worker of siteB.workers) {
        if (setA.has(worker)) {
          conflicts.push({
            worker,
            siteA: siteA.name,
            siteB: siteB.name,
          });
        }
      }
    }
  }

  return conflicts;
}

// ── Cashflow forecast ────────────────────────────────────

/**
 * Project monthly cash needs based on current burn rate across all sites.
 */
export function forecastCashflow(
  sites: Site[],
  reports: DailyReport[],
  months: number,
): MonthlyCashflow[] {
  // Calculate daily burn rate per active site
  const activeSites = sites.filter(
    (s) => s.status === "in_progress" || s.status === "scheduled",
  );

  // Total remaining cost across all active sites
  const totalRemainingCost = activeSites.reduce((sum, site) => {
    const siteReports = reports.filter((r) => r.siteId === site.id);
    const spentSoFar = siteReports.reduce(
      (s, r) => s + calcLaborCost(r.workers) + calcMaterialCost(r.materials),
      0,
    );
    const remaining = Math.max(0, site.budget - spentSoFar);
    return sum + remaining;
  }, 0);

  // Distribute remaining cost evenly across forecast months
  const monthlyBurn =
    months > 0 ? totalRemainingCost / months : totalRemainingCost;

  const result: MonthlyCashflow[] = [];
  const now = new Date();
  let cumulative = 0;

  for (let m = 0; m < months; m++) {
    const forecastDate = new Date(now.getFullYear(), now.getMonth() + m, 1);
    const monthKey = formatMonthKey(forecastDate);
    cumulative += monthlyBurn;
    result.push({
      month: monthKey,
      projectedSpend: Math.round(monthlyBurn),
      cumulativeSpend: Math.round(cumulative),
    });
  }

  return result;
}
