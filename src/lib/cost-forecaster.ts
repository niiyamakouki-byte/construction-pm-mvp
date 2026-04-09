/**
 * Cost forecasting: predict final cost, trend analysis, and reporting.
 */

import type { Expense, Project, Task } from "../domain/types.js";

export type MonthlyData = {
  month: string; // "2025-01"
  actualCost: number;
  budgetedCost: number;
};

export type TrendResult = {
  slope: number;
  averageMonthly: number;
  projectedNext: number;
  trend: "increasing" | "decreasing" | "stable";
};

export type ForecastReport = {
  projectName: string;
  totalBudget: number;
  spentToDate: number;
  remainingBudget: number;
  predictedFinalCost: number;
  overUnder: number;
  completionPct: number;
  trend: TrendResult;
  riskLevel: "low" | "medium" | "high";
  recommendations: string[];
};

// ── Overhead cost calculation ─────────────────────────

export type OverheadRates = {
  siteManagement: number; // e.g. 0.05 = 5%
  generalAdmin: number;   // e.g. 0.08 = 8%
  designFee: number;      // e.g. 0 = optional
};

export type OverheadBreakdown = {
  directCost: number;
  siteManagement: number;
  generalAdmin: number;
  designFee: number;
  totalOverhead: number;
  grandTotal: number;
  rates: OverheadRates;
};

const DEFAULT_OVERHEAD_RATES: OverheadRates = {
  siteManagement: 0.05,
  generalAdmin: 0.08,
  designFee: 0,
};

export function calculateOverheadCosts(
  directCost: number,
  overheadRates: Partial<OverheadRates> = {},
): OverheadBreakdown {
  const rates: OverheadRates = { ...DEFAULT_OVERHEAD_RATES, ...overheadRates };

  const siteManagement = Math.round(directCost * rates.siteManagement);
  const generalAdmin = Math.round(directCost * rates.generalAdmin);
  const designFee = Math.round(directCost * rates.designFee);
  const totalOverhead = siteManagement + generalAdmin + designFee;

  return {
    directCost,
    siteManagement,
    generalAdmin,
    designFee,
    totalOverhead,
    grandTotal: directCost + totalOverhead,
    rates,
  };
}

// ── Predict final cost ─────────────────────────────

export function predictFinalCost(
  project: Pick<Project, "budget" | "name">,
  tasks: Pick<Task, "progress" | "status">[],
  expenses: Pick<Expense, "amount" | "approvalStatus">[],
): number {
  const approvedExpenses = expenses.filter(
    (e) => e.approvalStatus === "approved" || e.approvalStatus === "pending",
  );
  const spentToDate = approvedExpenses.reduce((s, e) => s + e.amount, 0);

  // Weighted average progress
  const totalProgress =
    tasks.length > 0
      ? tasks.reduce((s, t) => s + t.progress, 0) / tasks.length / 100
      : 0;

  if (totalProgress <= 0) {
    // No progress: assume budget as prediction
    return project.budget ?? spentToDate;
  }

  // EAC = spent / progress (Estimate At Completion)
  const eac = spentToDate / totalProgress;
  return Math.round(eac);
}

// ── Trend analysis ─────────────────────────────────

export function trendAnalysis(monthlyData: MonthlyData[]): TrendResult {
  if (monthlyData.length === 0) {
    return { slope: 0, averageMonthly: 0, projectedNext: 0, trend: "stable" };
  }

  const costs = monthlyData.map((m) => m.actualCost);
  const avg = costs.reduce((s, c) => s + c, 0) / costs.length;

  // Simple linear regression
  let slope = 0;
  if (costs.length >= 2) {
    const n = costs.length;
    const xMean = (n - 1) / 2;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (costs[i] - avg);
      den += (i - xMean) ** 2;
    }
    slope = den !== 0 ? num / den : 0;
  }

  const projectedNext = avg + slope * monthlyData.length;

  let trend: TrendResult["trend"] = "stable";
  const threshold = avg * 0.05; // 5% of average
  if (slope > threshold) trend = "increasing";
  else if (slope < -threshold) trend = "decreasing";

  return {
    slope: Math.round(slope),
    averageMonthly: Math.round(avg),
    projectedNext: Math.round(Math.max(0, projectedNext)),
    trend,
  };
}

// ── Generate forecast report ───────────────────────

export function generateForecastReport(
  project: Pick<Project, "budget" | "name">,
  tasks: Pick<Task, "progress" | "status">[],
  expenses: Pick<Expense, "amount" | "approvalStatus">[],
  monthlyData: MonthlyData[] = [],
): ForecastReport {
  const budget = project.budget ?? 0;
  const approved = expenses.filter(
    (e) => e.approvalStatus === "approved" || e.approvalStatus === "pending",
  );
  const spentToDate = approved.reduce((s, e) => s + e.amount, 0);
  const remaining = budget - spentToDate;
  const predicted = predictFinalCost(project, tasks, expenses);
  const overUnder = predicted - budget;

  const completionPct =
    tasks.length > 0
      ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length)
      : 0;

  const trend = trendAnalysis(monthlyData);

  // Risk assessment
  let riskLevel: ForecastReport["riskLevel"] = "low";
  if (overUnder > budget * 0.15) riskLevel = "high";
  else if (overUnder > budget * 0.05) riskLevel = "medium";

  // Recommendations
  const recommendations: string[] = [];
  if (riskLevel === "high") {
    recommendations.push("予算超過リスクが高いです。コスト削減策を検討してください。");
  }
  if (trend.trend === "increasing") {
    recommendations.push("月次コストが増加傾向です。原因を調査してください。");
  }
  if (remaining < 0) {
    recommendations.push("予算を既に超過しています。追加予算の確保が必要です。");
  }
  if (completionPct < 50 && spentToDate > budget * 0.6) {
    recommendations.push("進捗に対して支出が多すぎます。工程を見直してください。");
  }
  if (recommendations.length === 0) {
    recommendations.push("現在のペースは予算内です。");
  }

  return {
    projectName: project.name,
    totalBudget: budget,
    spentToDate,
    remainingBudget: remaining,
    predictedFinalCost: predicted,
    overUnder,
    completionPct,
    trend,
    riskLevel,
    recommendations,
  };
}
