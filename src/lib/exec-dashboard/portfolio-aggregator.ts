/**
 * Portfolio aggregator — combines all project data into a single PortfolioSummary
 * for the Executive Dashboard.
 */

import type { Project, Invoice, Task, ChatMessage, Photo } from "../../domain/types.js";
import { detectDangerSignals, type DangerSignal } from "./danger-signals.js";
import { getPredictionStore } from "../delay-predictor/prediction-store.js";
import { marginAlertStore } from "../margin-watch/margin-alert-store.js";
import { buildAllProjectMetrics } from "../profit-ranking/metrics-builder.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type ProjectPortfolioEntry = {
  project: Project;
  tasks: Task[];
  invoices: Invoice[];
  chatMessages: ChatMessage[];
  photos: Photo[];
  /** Contract amount (e.g. from signed contract). Defaults to project.budget. */
  contractAmount?: number;
  /** Estimated At Completion — sum of all actual + projected costs */
  eac?: number;
  /** Gross profit amount (contractAmount − totalCost) */
  grossProfit?: number;
  /** Total estimated cost loss in JPY for this project (from cost-loss-detector) */
  totalLossYen?: number;
  /** Number of critical loss signals for this project */
  criticalLossCount?: number;
};

export type PortfolioSummary = {
  totalProjects: number;
  /** Sum of grossProfit across all projects */
  totalGrossProfit: number;
  /**
   * Progress weighted by contract amount.
   * = Σ(progress_i × contractAmount_i) / Σ(contractAmount_i)
   * Falls back to simple average when no projects have a contract amount.
   */
  weightedProgress: number;
  /** Sum of amounts for invoices with status !== 'paid' and !== 'cancelled' */
  unpaidAmount: number;
  dangerSignals: DangerSignal[];
  /** Number of projects with at least one danger signal */
  dangerProjectCount: number;
  /** Total estimated cost loss in JPY (from cost-loss-detector) */
  totalLossYen?: number;
  /** Number of critical loss signals across all projects */
  criticalLossCount?: number;
  /** Number of tasks with critical delay risk (from delay-predictor) */
  criticalDelayCount?: number;
  /** Number of tasks with high delay risk (from delay-predictor) */
  highDelayCount?: number;
  /** Number of projects with critical margin alerts (粗利率 < 15%, last 24h) */
  criticalMarginCount?: number;
  /** Number of projects with warning margin alerts (粗利率 15–25%, last 24h) */
  warningMarginCount?: number;
  /** Project ID with highest margin ratio */
  topProfitProjectId?: string;
  /** Project ID with lowest margin ratio */
  bottomProfitProjectId?: string;
  /** Highest margin ratio across all projects (%) */
  topMarginRatioPct?: number;
  /** Lowest margin ratio across all projects (%) */
  bottomMarginRatioPct?: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function computeProjectProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const sum = tasks.reduce((acc, t) => acc + (t.progress ?? 0), 0);
  return sum / tasks.length;
}

function computeUnpaid(invoices: Invoice[]): number {
  return invoices
    .filter((inv) => inv.status !== "paid" && inv.status !== "cancelled")
    .reduce((sum, inv) => sum + inv.amount, 0);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Aggregate a portfolio of project entries into a single summary.
 * All financial figures in JPY.
 */
export function aggregatePortfolio(entries: ProjectPortfolioEntry[]): PortfolioSummary {
  if (entries.length === 0) {
    return {
      totalProjects: 0,
      totalGrossProfit: 0,
      weightedProgress: 0,
      unpaidAmount: 0,
      dangerSignals: [],
      dangerProjectCount: 0,
      totalLossYen: 0,
      criticalLossCount: 0,
      criticalDelayCount: 0,
      highDelayCount: 0,
      criticalMarginCount: 0,
      warningMarginCount: 0,
    };
  }

  let totalGrossProfit = 0;
  let unpaidAmount = 0;
  let totalLossYen = 0;
  let criticalLossCount = 0;
  const allSignals: DangerSignal[] = [];
  const dangerProjectIds = new Set<string>();

  // Weighted progress accumulators
  let weightedProgressSum = 0;
  let totalWeight = 0;
  let simpleProgressSum = 0; // fallback

  for (const entry of entries) {
    const { project, tasks, invoices, chatMessages, photos, contractAmount, eac, grossProfit } = entry;
    const resolvedContractAmount = contractAmount ?? project.budget ?? 0;
    const resolvedGrossProfit = grossProfit ?? 0;

    totalGrossProfit += resolvedGrossProfit;
    unpaidAmount += computeUnpaid(invoices);
    totalLossYen += entry.totalLossYen ?? 0;
    criticalLossCount += entry.criticalLossCount ?? 0;

    const progress = computeProjectProgress(tasks);
    simpleProgressSum += progress;

    if (resolvedContractAmount > 0) {
      weightedProgressSum += progress * resolvedContractAmount;
      totalWeight += resolvedContractAmount;
    }

    const signals = detectDangerSignals({
      project,
      tasks,
      invoices,
      chatMessages,
      photos,
      contractAmount: resolvedContractAmount,
      eac,
      grossProfit: resolvedGrossProfit,
    });

    allSignals.push(...signals);
    if (signals.length > 0) {
      dangerProjectIds.add(project.id);
    }
  }

  const weightedProgress =
    totalWeight > 0
      ? Math.round((weightedProgressSum / totalWeight) * 10) / 10
      : Math.round((simpleProgressSum / entries.length) * 10) / 10;

  // Delay prediction counts — read from PredictionStore
  const projectIds = entries.map((e) => e.project.id);
  const predStore = getPredictionStore();
  let criticalDelayCount = 0;
  let highDelayCount = 0;
  for (const projectId of projectIds) {
    const preds = predStore.queryByProject(projectId);
    criticalDelayCount += preds.filter((p) => p.riskLevel === "critical").length;
    highDelayCount += preds.filter((p) => p.riskLevel === "high").length;
  }

  // Margin alert counts from last 24h
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentAlerts = marginAlertStore.since(since24h);
  const criticalMarginCount = recentAlerts.filter((a) => a.level === "critical").length;
  const warningMarginCount = recentAlerts.filter((a) => a.level === "warning").length;

  // Profit ranking fields — top/bottom project by margin ratio
  const profitMetrics = buildAllProjectMetrics();
  let topProfitProjectId: string | undefined;
  let bottomProfitProjectId: string | undefined;
  let topMarginRatioPct: number | undefined;
  let bottomMarginRatioPct: number | undefined;
  if (profitMetrics.length > 0) {
    const sorted = [...profitMetrics].sort((a, b) => b.marginRatioPct - a.marginRatioPct);
    topProfitProjectId = sorted[0].projectId;
    topMarginRatioPct = sorted[0].marginRatioPct;
    bottomProfitProjectId = sorted[sorted.length - 1].projectId;
    bottomMarginRatioPct = sorted[sorted.length - 1].marginRatioPct;
  }

  return {
    totalProjects: entries.length,
    totalGrossProfit,
    weightedProgress,
    unpaidAmount,
    dangerSignals: allSignals,
    dangerProjectCount: dangerProjectIds.size,
    totalLossYen,
    criticalLossCount,
    criticalDelayCount,
    highDelayCount,
    criticalMarginCount,
    warningMarginCount,
    topProfitProjectId,
    bottomProfitProjectId,
    topMarginRatioPct,
    bottomMarginRatioPct,
  };
}
