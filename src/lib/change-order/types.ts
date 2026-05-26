/**
 * Change Order — shared types.
 *
 * Sprint 17-B: 変更管理ワークフロー
 * 施主の追加/変更要望を受けて、金額影響+工期影響+他工種への波及を自動算出し、
 * 施主→監督→社長の承認フローを通す。
 */

// ── Branded types ──────────────────────────────────────────────────────────

export type ChangeOrderId = string & { readonly __brand: "ChangeOrderId" };

export function makeChangeOrderId(raw: string): ChangeOrderId {
  return raw as ChangeOrderId;
}

// ── Enumerations ───────────────────────────────────────────────────────────

export type ChangeOrderKind =
  | "addition"
  | "modification"
  | "deletion"
  | "materialUpgrade"
  | "scheduleShift";

export type ChangeOrderStatus =
  | "requested"
  | "estimating"
  | "ownerApproval"
  | "supervisorApproval"
  | "executiveApproval"
  | "approved"
  | "rejected";

// ── Domain objects ─────────────────────────────────────────────────────────

export type ImpactAnalysis = {
  /** 金額差分 (JPY)。正=増額、負=減額 */
  costDeltaJpy: number;
  /** 工期差分 (日)。正=延長、負=短縮 */
  scheduleDeltaDays: number;
  /** 影響を受ける職種リスト */
  affectedTrades: string[];
  /** 波及連鎖 (DAGトポロジカル順) */
  dependencyChain: string[];
  /** コスト増加率 (%). 10%以上で危険信号 */
  costIncreaseRatioPct: number;
};

export type ApprovalRecord = {
  role: "owner" | "supervisor" | "executive";
  decidedBy: string;
  /** ISO 8601 datetime */
  decidedAt: string;
  decision: "approved" | "rejected" | "escalated";
  comment?: string;
};

export type ChangeOrder = {
  id: ChangeOrderId;
  projectId: string;
  /** 変更要望の種別 */
  kind: ChangeOrderKind;
  status: ChangeOrderStatus;
  /** 変更内容の説明 */
  descriptionJa: string;
  /** 要望者名 */
  requestedBy: string;
  /** ISO 8601 datetime */
  requestedAt: string;
  impactAnalysis?: ImpactAnalysis;
  approvalRecords: ApprovalRecord[];
  /** 関連する見積行ID */
  relatedEstimateLineIds?: string[];
  /** 関連する工程フェーズID */
  relatedPhaseIds?: string[];
  /** 変更対象の工事箇所 (例: "壁仕上げ", "電気配線") */
  targetWorkItem?: string;
  /** 承認完了日時 */
  approvedAt?: string;
  /** 却下日時 */
  rejectedAt?: string;
};

// ── Label maps ─────────────────────────────────────────────────────────────

export const CHANGE_ORDER_KIND_LABELS: Record<ChangeOrderKind, string> = {
  addition: "追加工事",
  modification: "仕様変更",
  deletion: "削除・省略",
  materialUpgrade: "材料グレードアップ",
  scheduleShift: "工程変更",
};

export const CHANGE_ORDER_STATUS_LABELS: Record<ChangeOrderStatus, string> = {
  requested: "要望受付",
  estimating: "見積中",
  ownerApproval: "施主承認待ち",
  supervisorApproval: "監督承認待ち",
  executiveApproval: "社長承認待ち",
  approved: "承認済",
  rejected: "却下",
};

export const APPROVAL_ROLE_LABELS: Record<ApprovalRecord["role"], string> = {
  owner: "施主",
  supervisor: "監督",
  executive: "社長",
};
