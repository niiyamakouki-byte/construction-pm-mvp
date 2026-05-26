/**
 * approval-flow — 施主→監督→社長の3段階承認フロー。
 *
 * Sprint 17-B: 変更管理ワークフロー
 * 各段階で approve / reject / escalate が可能。
 */

import type {
  ChangeOrder,
  ChangeOrderStatus,
  ApprovalRecord,
} from "./types.js";
import { changeOrderStore } from "./change-order-store.js";

// ── Flow transitions ───────────────────────────────────────────────────────

const STATUS_FLOW: Record<ChangeOrderStatus, ChangeOrderStatus | null> = {
  requested: "estimating",
  estimating: "ownerApproval",
  ownerApproval: "supervisorApproval",
  supervisorApproval: "executiveApproval",
  executiveApproval: "approved",
  approved: null,
  rejected: null,
};

const ROLE_FOR_STATUS: Record<ChangeOrderStatus, ApprovalRecord["role"] | null> = {
  requested: null,
  estimating: null,
  ownerApproval: "owner",
  supervisorApproval: "supervisor",
  executiveApproval: "executive",
  approved: null,
  rejected: null,
};

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 見積完了として状態を estimating → ownerApproval に進める。
 */
export function markEstimatingComplete(orderId: string): ChangeOrder | null {
  const co = changeOrderStore.get(orderId as ChangeOrder["id"]);
  if (!co || co.status !== "estimating") return null;

  const updated: ChangeOrder = { ...co, status: "ownerApproval" };
  changeOrderStore.save(updated);
  return updated;
}

/**
 * 承認を記録し、次のステータスに遷移する。
 */
export function recordApproval(
  orderId: string,
  params: {
    decidedBy: string;
    decision: "approved" | "rejected" | "escalated";
    comment?: string;
  },
  now = new Date(),
): ChangeOrder | null {
  const co = changeOrderStore.get(orderId as ChangeOrder["id"]);
  if (!co) return null;

  const role = ROLE_FOR_STATUS[co.status];
  if (!role) return null;

  const record: ApprovalRecord = {
    role,
    decidedBy: params.decidedBy,
    decidedAt: now.toISOString(),
    decision: params.decision,
    comment: params.comment,
  };

  let nextStatus: ChangeOrderStatus;
  if (params.decision === "rejected") {
    nextStatus = "rejected";
  } else if (params.decision === "escalated") {
    // escalate: advance to next approval stage skipping current
    nextStatus = STATUS_FLOW[co.status] ?? co.status;
  } else {
    // approved: advance to next stage
    nextStatus = STATUS_FLOW[co.status] ?? "approved";
  }

  const updated: ChangeOrder = {
    ...co,
    status: nextStatus,
    approvalRecords: [...co.approvalRecords, record],
    ...(nextStatus === "approved" ? { approvedAt: now.toISOString() } : {}),
    ...(nextStatus === "rejected" ? { rejectedAt: now.toISOString() } : {}),
  };

  changeOrderStore.save(updated);
  return updated;
}

/**
 * 施主承認を記録する。
 */
export function recordOwnerApproval(
  orderId: string,
  decidedBy: string,
  decision: "approved" | "rejected",
  comment?: string,
  now = new Date(),
): ChangeOrder | null {
  const co = changeOrderStore.get(orderId as ChangeOrder["id"]);
  if (!co || co.status !== "ownerApproval") return null;
  return recordApproval(orderId, { decidedBy, decision, comment }, now);
}

/**
 * 監督承認を記録する。
 */
export function recordSupervisorApproval(
  orderId: string,
  decidedBy: string,
  decision: "approved" | "rejected",
  comment?: string,
  now = new Date(),
): ChangeOrder | null {
  const co = changeOrderStore.get(orderId as ChangeOrder["id"]);
  if (!co || co.status !== "supervisorApproval") return null;
  return recordApproval(orderId, { decidedBy, decision, comment }, now);
}

/**
 * 社長承認を記録する。
 */
export function recordExecutiveApproval(
  orderId: string,
  decidedBy: string,
  decision: "approved" | "rejected",
  comment?: string,
  now = new Date(),
): ChangeOrder | null {
  const co = changeOrderStore.get(orderId as ChangeOrder["id"]);
  if (!co || co.status !== "executiveApproval") return null;
  return recordApproval(orderId, { decidedBy, decision, comment }, now);
}

/**
 * 現在のステータスで必要な承認者ロールを返す。
 * 承認待ち状態でない場合は null。
 */
export function requiredApproverRole(co: ChangeOrder): ApprovalRecord["role"] | null {
  return ROLE_FOR_STATUS[co.status] ?? null;
}

/**
 * 承認サイクル日数 (requested → approved) を計算する。
 * 未完了の場合は null。
 */
export function computeApprovalCycleDays(co: ChangeOrder): number | null {
  if (!co.approvedAt) return null;
  const start = new Date(co.requestedAt).getTime();
  const end = new Date(co.approvedAt).getTime();
  return Math.round((end - start) / (1000 * 60 * 60 * 24) * 10) / 10;
}
