/**
 * AI Risk Predictor — Procore-inspired risk prediction for GenbaHub.
 * Integrates cost-forecaster, project-health, and earned-value data
 * to surface actionable risk alerts.
 */

import type { Expense, Project, Task } from "../domain/types.js";
import { predictFinalCost, trendAnalysis, type MonthlyData } from "./cost-forecaster.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type RiskAlertType = "budget" | "schedule" | "safety" | "resource";
export type RiskAlertSeverity = "low" | "medium" | "high" | "critical";

export type RiskAlert = {
  type: RiskAlertType;
  severity: RiskAlertSeverity;
  message: string;
  recommendation: string;
};

export type BudgetOverrunPrediction = {
  probability: number; // 0.0 – 1.0
  estimatedOverrun: number; // 円
  triggers: string[];
};

export type ScheduleDelayPrediction = {
  probability: number; // 0.0 – 1.0
  estimatedDays: number;
  criticalTasks: string[]; // task names
};

// ── Internal helpers ───────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function approvedExpenses(expenses: Pick<Expense, "amount" | "approvalStatus">[]): number {
  return expenses
    .filter((e) => e.approvalStatus === "approved" || e.approvalStatus === "pending")
    .reduce((s, e) => s + e.amount, 0);
}

// ── predictBudgetOverrun ───────────────────────────────────────────────────

/**
 * Estimate probability and amount of budget overrun.
 *
 * Probability model (additive factors capped at 1.0):
 *   - EAC > budget:           base 0.6  + (overrun ratio * 0.4)
 *   - spend > 80% budget:     +0.15
 *   - completion < 50%:       +0.10
 *   - cost trend increasing:  +0.10
 */
export function predictBudgetOverrun(
  project: Pick<Project, "budget" | "name">,
  tasks: Pick<Task, "progress" | "status">[],
  expenses: Pick<Expense, "amount" | "approvalStatus">[],
  monthlyData?: MonthlyData[],
): BudgetOverrunPrediction {
  const budget = project.budget ?? 0;
  const spent = approvedExpenses(expenses);
  const eac = predictFinalCost(project, tasks, expenses);
  const overrun = Math.max(0, eac - budget);

  const triggers: string[] = [];
  let probability = 0;

  if (budget > 0 && eac > budget) {
    const ratio = (eac - budget) / budget;
    probability += clamp01(0.6 + ratio * 0.4);
    triggers.push(`EAC ¥${Math.round(eac / 10_000)}万 > 予算 ¥${Math.round(budget / 10_000)}万`);
  }

  if (budget > 0 && spent > budget * 0.8) {
    probability = clamp01(probability + 0.15);
    triggers.push("支出が予算の80%超");
  }

  const avgProgress =
    tasks.length > 0
      ? tasks.reduce((s, t) => s + t.progress, 0) / tasks.length
      : 100;

  if (avgProgress < 50 && spent > budget * 0.5) {
    probability = clamp01(probability + 0.10);
    triggers.push("進捗50%未満なのに支出が50%超");
  }

  if (monthlyData && monthlyData.length >= 2) {
    const trend = trendAnalysis(monthlyData);
    if (trend.trend === "increasing") {
      probability = clamp01(probability + 0.10);
      triggers.push("月次コストが増加傾向");
    }
  }

  return {
    probability: Math.round(probability * 100) / 100,
    estimatedOverrun: overrun,
    triggers,
  };
}

// ── predictScheduleDelay ───────────────────────────────────────────────────

/**
 * Estimate probability and days of schedule delay.
 *
 * Probability model:
 *   - Each overdue task:            +0.15 (max 0.60)
 *   - Tasks with no dueDate:        +0.05 (max 0.15)
 *   - Overall progress < planned:   +0.20
 */
export function predictScheduleDelay(
  project: Pick<Project, "startDate" | "endDate">,
  tasks: Pick<Task, "id" | "name" | "status" | "dueDate" | "progress" | "startDate">[],
): ScheduleDelayPrediction {
  const asOf = today();
  const criticalTasks: string[] = [];
  let probability = 0;
  let delayDays = 0;

  // Overdue tasks
  const overdue = tasks.filter(
    (t) => t.status !== "done" && t.dueDate != null && t.dueDate < asOf,
  );
  probability = clamp01(probability + Math.min(0.60, overdue.length * 0.15));
  for (const t of overdue) {
    criticalTasks.push(t.name);
    if (t.dueDate) {
      const ms = new Date(asOf).getTime() - new Date(t.dueDate).getTime();
      delayDays = Math.max(delayDays, Math.ceil(ms / 86_400_000));
    }
  }

  // Tasks missing dueDate
  const noDueDate = tasks.filter((t) => t.status !== "done" && t.dueDate == null);
  probability = clamp01(probability + Math.min(0.15, noDueDate.length * 0.05));

  // Progress lag vs planned timeline
  if (project.startDate && project.endDate) {
    const totalMs =
      new Date(project.endDate).getTime() - new Date(project.startDate).getTime();
    const elapsedMs = new Date(asOf).getTime() - new Date(project.startDate).getTime();
    const plannedPct = totalMs > 0 ? clamp01(elapsedMs / totalMs) * 100 : 0;
    const actualPct =
      tasks.length > 0
        ? tasks.reduce((s, t) => s + t.progress, 0) / tasks.length
        : plannedPct;

    if (actualPct < plannedPct - 10) {
      probability = clamp01(probability + 0.20);
      const lagPct = Math.round(plannedPct - actualPct);
      if (!criticalTasks.includes(`進捗乖離 ${lagPct}%`)) {
        criticalTasks.push(`全体進捗が計画より${lagPct}%遅れ`);
      }
      // Estimate remaining days based on lag
      if (totalMs > 0 && actualPct < 100) {
        const remainingMs =
          new Date(project.endDate).getTime() - new Date(asOf).getTime();
        const neededDays = Math.ceil(remainingMs / 86_400_000) * (lagPct / 100);
        delayDays = Math.max(delayDays, Math.round(neededDays));
      }
    }
  }

  return {
    probability: Math.round(probability * 100) / 100,
    estimatedDays: delayDays,
    criticalTasks,
  };
}

// ── generateRiskAlerts ─────────────────────────────────────────────────────

/**
 * Generate prioritised risk alerts from budget + schedule predictions.
 */
export function generateRiskAlerts(
  project: Pick<Project, "budget" | "name" | "startDate" | "endDate">,
  tasks: Pick<Task, "id" | "name" | "status" | "dueDate" | "progress" | "startDate">[],
  expenses: Pick<Expense, "amount" | "approvalStatus">[],
  monthlyData?: MonthlyData[],
): RiskAlert[] {
  const alerts: RiskAlert[] = [];

  // Budget overrun
  const budget = predictBudgetOverrun(project, tasks, expenses, monthlyData);
  if (budget.probability >= 0.7) {
    const pct = Math.round(budget.probability * 100);
    const overrunLabel =
      budget.estimatedOverrun >= 10_000
        ? `¥${Math.round(budget.estimatedOverrun / 10_000)}万超過`
        : `¥${budget.estimatedOverrun}超過`;
    alerts.push({
      type: "budget",
      severity: budget.probability >= 0.85 ? "critical" : "high",
      message: `予算超過リスク${pct}% — 推定${overrunLabel}`,
      recommendation: "コスト削減策または追加予算の確保を検討してください。",
    });
  } else if (budget.probability >= 0.4) {
    alerts.push({
      type: "budget",
      severity: "medium",
      message: `予算超過リスク${Math.round(budget.probability * 100)}% — 注意が必要`,
      recommendation: "支出ペースを月次で確認してください。",
    });
  } else if (budget.probability > 0) {
    alerts.push({
      type: "budget",
      severity: "low",
      message: `予算超過リスク${Math.round(budget.probability * 100)}% — 概ね良好`,
      recommendation: "現状維持で継続してください。",
    });
  }

  // Schedule delay
  const schedule = predictScheduleDelay(project, tasks);
  if (schedule.probability >= 0.6) {
    const dayLabel = schedule.estimatedDays > 0 ? `${schedule.estimatedDays}日` : "";
    alerts.push({
      type: "schedule",
      severity: schedule.probability >= 0.8 ? "critical" : "high",
      message: `工期遅延リスク${Math.round(schedule.probability * 100)}%${dayLabel ? ` — 推定${dayLabel}遅延` : ""}`,
      recommendation: "クリティカルパスのタスクにリソースを集中させてください。",
    });
  } else if (schedule.probability >= 0.3) {
    alerts.push({
      type: "schedule",
      severity: "medium",
      message: `工期遅延リスク${Math.round(schedule.probability * 100)}% — 期限未設定タスクあり`,
      recommendation: "全タスクに完了期限を設定してください。",
    });
  }

  // Resource alert: too many tasks in_progress simultaneously
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  if (inProgressCount > 5) {
    alerts.push({
      type: "resource",
      severity: "medium",
      message: `同時進行タスク${inProgressCount}件 — リソース分散リスク`,
      recommendation: "優先順位を絞り、並行作業数を削減してください。",
    });
  }

  // Sort: critical → high → medium → low
  const order: Record<RiskAlertSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);

  return alerts;
}
