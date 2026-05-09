/**
 * Handover Package — shared types.
 *
 * Sprint 17-C: 引渡しパッケージ自動生成
 * 施主への引渡し時に必要な書類一式を自動でまとめるシステム。
 */

// ── Branded types ──────────────────────────────────────────────────────────

export type HandoverPackageId = string & { readonly __brand: "HandoverPackageId" };

export function makeHandoverPackageId(raw: string): HandoverPackageId {
  return raw as HandoverPackageId;
}

// ── Enumerations ───────────────────────────────────────────────────────────

export type HandoverDocumentKind =
  | "equipment_manual"
  | "warranty_certificate"
  | "maintenance_schedule"
  | "aftercare_contact"
  | "key_handover_record"
  | "completion_inspection"
  | "as_built_drawing";

export type HandoverPackageStatus =
  | "draft"
  | "documents_collected"
  | "review"
  | "delivered"
  | "archived";

// ── Domain objects ─────────────────────────────────────────────────────────

export type HandoverDocument = {
  id: string;
  kind: HandoverDocumentKind;
  /** ドキュメントのタイトル (日本語) */
  titleJa: string;
  /** 添付ファイル参照 (任意) */
  fileRef?: string;
  /** ドキュメント本文 (任意) */
  contentJa?: string;
  /** 保証期限 ISO 8601 (任意) */
  expiresAt?: string;
};

export type MaintenanceMilestone = {
  /** 引渡し後の点検間隔 (月) */
  intervalMonths: number;
  /** 点検内容の説明 (日本語) */
  descriptionJa: string;
  /** 点検予定日 ISO 8601 */
  scheduledAt: string;
};

export type HandoverPackage = {
  id: HandoverPackageId;
  projectId: string;
  /** 施主名 */
  ownerName: string;
  /** 工事完成日 ISO 8601 */
  completedAt: string;
  status: HandoverPackageStatus;
  documents: HandoverDocument[];
  maintenanceSchedule: MaintenanceMilestone[];
  /** 引渡し完了日時 ISO 8601 (任意) */
  deliveredAt?: string;
};

// ── Label maps ─────────────────────────────────────────────────────────────

export const DOCUMENT_KIND_LABELS: Record<HandoverDocumentKind, string> = {
  equipment_manual: "設備マニュアル",
  warranty_certificate: "保証書",
  maintenance_schedule: "メンテナンススケジュール",
  aftercare_contact: "アフター連絡先",
  key_handover_record: "鍵引渡し記録",
  completion_inspection: "完成検査書",
  as_built_drawing: "竣工図面",
};

export const PACKAGE_STATUS_LABELS: Record<HandoverPackageStatus, string> = {
  draft: "下書き",
  documents_collected: "書類収集済",
  review: "確認中",
  delivered: "引渡し完了",
  archived: "アーカイブ",
};
