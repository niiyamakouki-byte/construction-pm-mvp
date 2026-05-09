/**
 * change-order-facade — Change Order ワークフローの公開API
 *
 * Sprint 17-B: 変更管理ワークフロー
 */

import type {
  ChangeOrder,
  ChangeOrderId,
  ChangeOrderKind,
  ChangeOrderStatus,
  ImpactAnalysis,
} from "./types.js";
import { makeChangeOrderId } from "./types.js";
import { changeOrderStore } from "./change-order-store.js";
import { analyzeImpact, isDangerousImpact } from "./impact-analyzer.js";
import type { ImpactAnalysisInput } from "./impact-analyzer.js";
import { resolveDependencyChain } from "./dependency-resolver.js";
import type { WorkNode } from "./dependency-resolver.js";
import {
  markEstimatingComplete,
  recordOwnerApproval,
  recordSupervisorApproval,
  recordExecutiveApproval,
  requiredApproverRole,
  computeApprovalCycleDays,
} from "./approval-flow.js";
import { renderChangeOrder } from "./change-order-renderer.js";
import type { ChangeOrderRenderTarget } from "./change-order-renderer.js";

// ── Counter ────────────────────────────────────────────────────────────────

let _orderCounter = 0;

function newOrderId(): ChangeOrderId {
  return makeChangeOrderId(`co-${Date.now()}-${++_orderCounter}`);
}

// ── Change order creation ──────────────────────────────────────────────────

/**
 * 新しい変更指示を作成・保存して返す。
 */
export function createChangeOrder(params: {
  projectId: string;
  kind: ChangeOrderKind;
  descriptionJa: string;
  requestedBy: string;
  targetWorkItem?: string;
  relatedEstimateLineIds?: string[];
  relatedPhaseIds?: string[];
}, now = new Date()): ChangeOrder {
  const co: ChangeOrder = {
    id: newOrderId(),
    projectId: params.projectId,
    kind: params.kind,
    status: "requested",
    descriptionJa: params.descriptionJa,
    requestedBy: params.requestedBy,
    requestedAt: now.toISOString(),
    approvalRecords: [],
    targetWorkItem: params.targetWorkItem,
    relatedEstimateLineIds: params.relatedEstimateLineIds,
    relatedPhaseIds: params.relatedPhaseIds,
  };

  changeOrderStore.save(co);
  return co;
}

// ── Impact analysis ────────────────────────────────────────────────────────

/**
 * 変更指示に影響分析を実行して保存する。
 */
export function runImpactAnalysis(
  orderId: string,
  input: Omit<ImpactAnalysisInput, "kind">,
  workNodes?: WorkNode[],
): ChangeOrder | null {
  const co = changeOrderStore.get(orderId as ChangeOrderId);
  if (!co) return null;

  const analysis = analyzeImpact({ ...input, kind: co.kind });

  // Resolve dependency chain for related phases
  const targetWorkIds = co.relatedPhaseIds ?? [];
  const chain = resolveDependencyChain(targetWorkIds, workNodes);
  const fullAnalysis: ImpactAnalysis = { ...analysis, dependencyChain: chain };

  const updated: ChangeOrder = {
    ...co,
    status: "estimating",
    impactAnalysis: fullAnalysis,
  };

  changeOrderStore.save(updated);
  return updated;
}

/**
 * 影響分析が危険域かどうかを返す。
 */
export { isDangerousImpact };

// ── Approval flow ──────────────────────────────────────────────────────────

export { markEstimatingComplete };
export { recordOwnerApproval };
export { recordSupervisorApproval };
export { recordExecutiveApproval };
export { requiredApproverRole };
export { computeApprovalCycleDays };

// ── Rendering ──────────────────────────────────────────────────────────────

/**
 * 変更指示書を指定フォーマットで生成する。
 */
export function generateChangeOrderDocument(
  orderId: string,
  target: ChangeOrderRenderTarget,
): string | null {
  const co = changeOrderStore.get(orderId as ChangeOrderId);
  if (!co) return null;
  return renderChangeOrder(co, target);
}

// ── Queries ────────────────────────────────────────────────────────────────

/** プロジェクトの全変更指示を返す */
export function listProjectChangeOrders(projectId: string): ChangeOrder[] {
  return changeOrderStore.listByProject(projectId);
}

/** ステータスで絞り込む */
export function listChangeOrdersByStatus(status: ChangeOrderStatus): ChangeOrder[] {
  return changeOrderStore.listByStatus(status);
}

/** 最近の変更指示一覧 */
export function listRecentChangeOrders(limit = 20): ChangeOrder[] {
  return changeOrderStore.listRecent(limit);
}

/** 特定IDの変更指示を取得 */
export function getChangeOrder(orderId: string): ChangeOrder | null {
  return changeOrderStore.get(orderId as ChangeOrderId);
}
