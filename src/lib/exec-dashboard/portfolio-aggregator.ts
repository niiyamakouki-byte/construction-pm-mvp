/**
 * Portfolio aggregator — combines all project data into a single PortfolioSummary
 * for the Executive Dashboard.
 */

import type { Project, Invoice, Task, ChatMessage, Photo } from "../../domain/types.js";
import { detectDangerSignals, type DangerSignal } from "./danger-signals.js";
import { getPredictionStore } from "../delay-predictor/prediction-store.js";
import { marginAlertStore } from "../margin-watch/margin-alert-store.js";
import { buildAllProjectMetrics } from "../profit-ranking/metrics-builder.js";
import { crewOptimizationStore } from "../crew-optimizer/optimization-store.js";
import { customerStore } from "../repeat-predictor/customer-store.js";
import { extractSignal } from "../repeat-predictor/signal-extractor.js";
import { predictRepeat } from "../repeat-predictor/repeat-predictor.js";
import {
  newInquiryCount24h,
  urgentInquiryCount,
  pendingReplyCount,
} from "../inquiry-responder/portfolio-inquiry-metrics.js";
import {
  weightedPipelineJpy,
  criticalRiskDealCount,
  expectedClosesThisMonthJpy,
} from "../sales-pipeline/portfolio-pipeline-metrics.js";
import {
  proposalsThisMonthCount,
  avgGenerationLeadHours,
  topRequestedWorkCategory,
} from "../proposal-generator/portfolio-proposal-metrics.js";
import type { WorkCategory } from "../proposal-generator/types.js";
import {
  meetingsThisMonth,
  avgUnresolvedItemsCount,
  mostActiveProjectId,
} from "../meeting-runner/portfolio-meeting-metrics.js";
import type { ChangeOrderKind } from "../change-order/types.js";
import {
  pendingChangeOrders,
  avgApprovalCycleDays,
  costDeltaTotalJpy,
  mostFrequentChangeKind,
} from "../change-order/portfolio-change-order-metrics.js";
import type { HandoverDocumentKind } from "../handover-package/types.js";
import {
  pendingHandoverPackages,
  avgHandoverPreparationDays,
  expiringWarranties,
  mostFrequentDocumentKind,
} from "../handover-package/portfolio-handover-metrics.js";
import type { SuggestionPlanKind } from "../owner-suggestion/types.js";
import {
  pendingOwnerSuggestions,
  acceptedSuggestionRate,
  mostPopularPlanKind,
  avgBudgetGap,
} from "../owner-suggestion/portfolio-owner-suggestion-metrics.js";
import type { StreamChannelKind } from "../site-livestream/types.js";
import {
  pendingLivestreamReviews,
  livestreamPostsThisWeek,
  avgDailyEngagement,
  mostActiveChannelKind,
} from "../site-livestream/portfolio-livestream-metrics.js";
import {
  totalActiveAmbassadors,
  pendingReferralInquiries,
  monthlyRewardPayoutJpy,
  mostProductiveAmbassadorName,
} from "../owner-ambassador/portfolio-ambassador-metrics.js";
import {
  activeFollowupSchedules,
  upcomingCheckpointsNext30Days,
  urgentRenovationLeadsCount,
  avgDegradationScoreByYear,
} from "../longterm-followup/portfolio-followup-metrics.js";
import {
  publishedArticleCount,
  top10KeywordCount,
  estimatedMonthlySearchImpressions,
  gbpActionCount,
} from "../local-seo/portfolio-local-seo-metrics.js";

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
  /** Number of critical crew conflicts in the last 24h */
  crewConflictCount?: number;
  /** Average crew utilization percentage from the latest optimization snapshot */
  avgCrewUtilizationPct?: number;
  /** Number of VIP customers */
  vipCustomerCount?: number;
  /** Number of at-risk customers */
  atRiskCustomerCount?: number;
  /** Number of customers with predicted next order within 90 days */
  next90DaysOrderForecast?: number;
  /** 過去24時間以内に受け付けた新規問合せ数 */
  newInquiryCount24h?: number;
  /** 未完了の urgent / high 問合せ数 */
  urgentInquiryCount?: number;
  /** 返信待ち (new / triaged) 問合せ数 */
  pendingReplyCount?: number;
  /** 加重パイプライン合計 (JPY) — from sales-pipeline */
  weightedPipelineJpy?: number;
  /** critical リスクアラートを持つ商談数 */
  criticalRiskDealCount?: number;
  /** 今月クローズ予定の加重金額合計 (JPY) */
  expectedClosesThisMonthJpy?: number;
  /** 今月生成された提案書の件数 */
  proposalsThisMonthCount?: number;
  /** 提案書生成の平均リードタイム (hours) */
  avgProposalLeadHours?: number;
  /** 最もリクエストされた工事種別 */
  topRequestedWorkCategory?: WorkCategory | null;
  /** 今月開催された工程会議の件数 (Sprint 17-A) */
  meetingsThisMonth?: number;
  /** 全会議の平均未解決事項数 (Sprint 17-A) */
  avgUnresolvedItemsCount?: number;
  /** 最も会議が多いプロジェクトID (Sprint 17-A) */
  mostActiveMeetingProjectId?: string | null;
  /** 承認待ち変更指示数 (Sprint 17-B) */
  pendingChangeOrders?: number;
  /** 承認サイクル平均日数 (Sprint 17-B) */
  avgApprovalCycleDays?: number;
  /** 変更金額差分合計 JPY (Sprint 17-B) */
  costDeltaTotalJpy?: number;
  /** 最多変更種別 (Sprint 17-B) */
  mostFrequentChangeKind?: ChangeOrderKind | null;
  /** 未引渡しパッケージ数 (Sprint 17-C) */
  pendingHandoverPackages?: number;
  /** 平均引渡し準備日数 (Sprint 17-C) */
  avgHandoverPreparationDays?: number;
  /** 保証期限30日以内の件数 (Sprint 17-C) */
  expiringWarranties?: number;
  /** 最多書類種別 (Sprint 17-C) */
  mostFrequentDocumentKind?: HandoverDocumentKind | null;
  /** 未決定施主提案数 (Sprint 18-A) */
  pendingOwnerSuggestions?: number;
  /** 施主提案採用率 (Sprint 18-A) */
  acceptedSuggestionRate?: number;
  /** 最人気プランKind (Sprint 18-A) */
  mostPopularPlanKind?: SuggestionPlanKind | null;
  /** 採用プランと予算の平均差分 JPY (Sprint 18-A) */
  avgBudgetGap?: number;
  /** 審査待ちライブストリーム投稿数 (Sprint 18-B) */
  pendingLivestreamReviews?: number;
  /** 今週のライブストリーム投稿数 (Sprint 18-B) */
  livestreamPostsThisWeek?: number;
  /** 1日あたりの平均視聴数 (Sprint 18-B) */
  avgDailyEngagement?: number;
  /** 最多投稿チャネル種別 (Sprint 18-B) */
  mostActiveChannelKind?: StreamChannelKind | null;
  /** アクティブアンバサダー総数 (Sprint 18-C) */
  totalActiveAmbassadors?: number;
  /** 未処理紹介問合せ数 (Sprint 18-C) */
  pendingReferralInquiries?: number;
  /** 今月報酬支払予定合計 JPY (Sprint 18-C) */
  monthlyRewardPayoutJpy?: number;
  /** 最多紹介者アンバサダー名 (Sprint 18-C) */
  mostProductiveAmbassadorName?: string | null;
  /** アクティブなフォローアップスケジュール数 (Sprint 19-A) */
  activeFollowupSchedules?: number;
  /** 直近30日のチェックポイント数 (Sprint 19-A) */
  upcomingCheckpointsNext30Days?: number;
  /** 緊急リフォームリード数 (Sprint 19-A) */
  urgentRenovationLeadsCount?: number;
  /** 年数別平均劣化スコア (Sprint 19-A) */
  avgDegradationScoreByYear?: { 1: number; 3: number; 5: number; 10: number };
  /** 公開済み地域SEO記事数 (Sprint 19-B) */
  publishedSeoArticleCount?: number;
  /** TOP10獲得キーワード数 (Sprint 19-B) */
  top10KeywordCount?: number;
  /** 月間検索流入推定 (Sprint 19-B) */
  estimatedMonthlySearchImpressions?: number;
  /** GBPアクション数 (Sprint 19-B) */
  gbpActionCount?: number;
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
      crewConflictCount: 0,
      avgCrewUtilizationPct: 0,
      vipCustomerCount: 0,
      atRiskCustomerCount: 0,
      next90DaysOrderForecast: 0,
      newInquiryCount24h: 0,
      urgentInquiryCount: 0,
      pendingReplyCount: 0,
      weightedPipelineJpy: 0,
      criticalRiskDealCount: 0,
      expectedClosesThisMonthJpy: 0,
      proposalsThisMonthCount: 0,
      avgProposalLeadHours: 0,
      topRequestedWorkCategory: null,
      meetingsThisMonth: 0,
      avgUnresolvedItemsCount: 0,
      mostActiveMeetingProjectId: null,
      pendingChangeOrders: 0,
      avgApprovalCycleDays: 0,
      costDeltaTotalJpy: 0,
      mostFrequentChangeKind: null,
      pendingHandoverPackages: 0,
      avgHandoverPreparationDays: 0,
      expiringWarranties: 0,
      mostFrequentDocumentKind: null,
      pendingOwnerSuggestions: 0,
      acceptedSuggestionRate: 0,
      mostPopularPlanKind: null,
      avgBudgetGap: 0,
      pendingLivestreamReviews: 0,
      livestreamPostsThisWeek: 0,
      avgDailyEngagement: 0,
      mostActiveChannelKind: null,
      totalActiveAmbassadors: 0,
      pendingReferralInquiries: 0,
      monthlyRewardPayoutJpy: 0,
      mostProductiveAmbassadorName: null,
      activeFollowupSchedules: 0,
      upcomingCheckpointsNext30Days: 0,
      urgentRenovationLeadsCount: 0,
      avgDegradationScoreByYear: { 1: 0, 3: 0, 5: 0, 10: 0 },
      publishedSeoArticleCount: 0,
      top10KeywordCount: 0,
      estimatedMonthlySearchImpressions: 0,
      gbpActionCount: 0,
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

  // Crew optimizer fields — from latest snapshot
  const latestCrew = crewOptimizationStore.latest();
  let crewConflictCount: number | undefined;
  let avgCrewUtilizationPct: number | undefined;
  if (latestCrew) {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const isRecent = new Date(latestCrew.generatedAt) >= since24h;
    crewConflictCount = isRecent
      ? latestCrew.schedules
          .flatMap((s) => s.conflicts)
          .filter((c) => c.severity === "critical").length
      : undefined;
    avgCrewUtilizationPct = latestCrew.avgUtilizationPct;
  }

  // Repeat predictor fields — VIP / at_risk / next 90 days forecast
  const customers = customerStore.all();
  let vipCustomerCount = 0;
  let atRiskCustomerCount = 0;
  let next90DaysOrderForecast = 0;
  for (const history of customers) {
    const signal = extractSignal(history);
    const pred = predictRepeat(history.customerId, signal);
    if (pred.segment === "vip") vipCustomerCount++;
    if (pred.segment === "at_risk") atRiskCustomerCount++;
    if (pred.predictedNextOrderMonths <= 3) next90DaysOrderForecast++;
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
    crewConflictCount,
    avgCrewUtilizationPct,
    vipCustomerCount,
    atRiskCustomerCount,
    next90DaysOrderForecast,
    newInquiryCount24h: newInquiryCount24h(),
    urgentInquiryCount: urgentInquiryCount(),
    pendingReplyCount: pendingReplyCount(),
    weightedPipelineJpy: weightedPipelineJpy(),
    criticalRiskDealCount: criticalRiskDealCount(),
    expectedClosesThisMonthJpy: expectedClosesThisMonthJpy(),
    proposalsThisMonthCount: proposalsThisMonthCount(),
    avgProposalLeadHours: avgGenerationLeadHours(),
    topRequestedWorkCategory: topRequestedWorkCategory(),
    meetingsThisMonth: meetingsThisMonth(),
    avgUnresolvedItemsCount: avgUnresolvedItemsCount(),
    mostActiveMeetingProjectId: mostActiveProjectId(),
    pendingChangeOrders: pendingChangeOrders(),
    avgApprovalCycleDays: avgApprovalCycleDays(),
    costDeltaTotalJpy: costDeltaTotalJpy(),
    mostFrequentChangeKind: mostFrequentChangeKind(),
    pendingHandoverPackages: pendingHandoverPackages(),
    avgHandoverPreparationDays: avgHandoverPreparationDays(),
    expiringWarranties: expiringWarranties(),
    mostFrequentDocumentKind: mostFrequentDocumentKind(),
    pendingOwnerSuggestions: pendingOwnerSuggestions(),
    acceptedSuggestionRate: acceptedSuggestionRate(),
    mostPopularPlanKind: mostPopularPlanKind(),
    avgBudgetGap: avgBudgetGap(),
    pendingLivestreamReviews: pendingLivestreamReviews(),
    livestreamPostsThisWeek: livestreamPostsThisWeek(),
    avgDailyEngagement: avgDailyEngagement(),
    mostActiveChannelKind: mostActiveChannelKind(),
    totalActiveAmbassadors: totalActiveAmbassadors(),
    pendingReferralInquiries: pendingReferralInquiries(),
    monthlyRewardPayoutJpy: monthlyRewardPayoutJpy(),
    mostProductiveAmbassadorName: mostProductiveAmbassadorName(),
    activeFollowupSchedules: activeFollowupSchedules(),
    upcomingCheckpointsNext30Days: upcomingCheckpointsNext30Days(),
    urgentRenovationLeadsCount: urgentRenovationLeadsCount(),
    avgDegradationScoreByYear: avgDegradationScoreByYear(),
    publishedSeoArticleCount: publishedArticleCount(),
    top10KeywordCount: top10KeywordCount(),
    estimatedMonthlySearchImpressions: estimatedMonthlySearchImpressions(),
    gbpActionCount: gbpActionCount(),
  };
}
