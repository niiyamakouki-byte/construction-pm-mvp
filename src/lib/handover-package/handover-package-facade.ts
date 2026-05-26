/**
 * handover-package-facade — 引渡しパッケージワークフローの公開API
 *
 * Sprint 17-C: 引渡しパッケージ自動生成
 */

import type {
  HandoverPackage,
  HandoverPackageId,
  HandoverPackageStatus,
  HandoverDocument,
} from "./types.js";
import { makeHandoverPackageId } from "./types.js";
import { handoverPackageStore } from "./handover-package-store.js";
import { collectDocumentsFromEquipment } from "./document-collector.js";
import type { EquipmentInput } from "./document-collector.js";
import { buildMaintenanceSchedule } from "./maintenance-scheduler.js";
import type { InspectionPreset } from "./maintenance-scheduler.js";
import { getExpiringSoon } from "./warranty-tracker.js";
import { renderHandoverPackage } from "./handover-pdf-builder.js";
import type { HandoverRenderTarget } from "./handover-pdf-builder.js";

// ── Counter ────────────────────────────────────────────────────────────────

let _packageCounter = 0;

function newPackageId(): HandoverPackageId {
  return makeHandoverPackageId(`hp-${Date.now()}-${++_packageCounter}`);
}

// ── Package creation ───────────────────────────────────────────────────────

/**
 * 新しい引渡しパッケージを作成・保存して返す。
 */
export function createHandoverPackage(params: {
  projectId: string;
  ownerName: string;
  completedAt: string;
}, now = new Date()): HandoverPackage {
  void now; // reserved for future use
  const pkg: HandoverPackage = {
    id: newPackageId(),
    projectId: params.projectId,
    ownerName: params.ownerName,
    completedAt: params.completedAt,
    status: "draft",
    documents: [],
    maintenanceSchedule: [],
  };

  handoverPackageStore.save(pkg);
  return pkg;
}

// ── Document collection ────────────────────────────────────────────────────

/**
 * 設備リストからドキュメントを自動収集してパッケージに追加する。
 * ステータスを documents_collected に更新する。
 */
export function collectDocuments(
  packageId: string,
  equipment: EquipmentInput[],
): HandoverPackage | null {
  const pkg = handoverPackageStore.get(packageId as HandoverPackageId);
  if (!pkg) return null;

  const docs = collectDocumentsFromEquipment(equipment, pkg.completedAt);
  const updated: HandoverPackage = {
    ...pkg,
    status: "documents_collected",
    documents: docs,
  };

  handoverPackageStore.save(updated);
  return updated;
}

/**
 * メンテナンススケジュールを生成してパッケージに設定する。
 */
export function scheduleMaintenanceMilestones(
  packageId: string,
  presets?: InspectionPreset[],
): HandoverPackage | null {
  const pkg = handoverPackageStore.get(packageId as HandoverPackageId);
  if (!pkg) return null;

  const schedule = buildMaintenanceSchedule(pkg.completedAt, presets);
  const updated: HandoverPackage = {
    ...pkg,
    maintenanceSchedule: schedule,
  };

  handoverPackageStore.save(updated);
  return updated;
}

// ── Status transitions ─────────────────────────────────────────────────────

/**
 * パッケージを確認中 (review) に進める。
 */
export function markReview(packageId: string): HandoverPackage | null {
  return _updateStatus(packageId as HandoverPackageId, "review");
}

/**
 * パッケージを引渡し完了 (delivered) にする。
 */
export function markDelivered(packageId: string, deliveredAt?: string): HandoverPackage | null {
  const pkg = handoverPackageStore.get(packageId as HandoverPackageId);
  if (!pkg) return null;

  const updated: HandoverPackage = {
    ...pkg,
    status: "delivered",
    deliveredAt: deliveredAt ?? new Date().toISOString(),
  };

  handoverPackageStore.save(updated);
  return updated;
}

/**
 * パッケージをアーカイブする。
 */
export function archivePackage(packageId: string): HandoverPackage | null {
  return _updateStatus(packageId as HandoverPackageId, "archived");
}

function _updateStatus(
  id: HandoverPackageId,
  status: HandoverPackageStatus,
): HandoverPackage | null {
  const pkg = handoverPackageStore.get(id);
  if (!pkg) return null;

  const updated: HandoverPackage = { ...pkg, status };
  handoverPackageStore.save(updated);
  return updated;
}

// ── Document management ────────────────────────────────────────────────────

/**
 * パッケージにドキュメントを追加する。
 */
export function addDocument(
  packageId: string,
  doc: HandoverDocument,
): HandoverPackage | null {
  const pkg = handoverPackageStore.get(packageId as HandoverPackageId);
  if (!pkg) return null;

  const updated: HandoverPackage = {
    ...pkg,
    documents: [...pkg.documents, doc],
  };

  handoverPackageStore.save(updated);
  return updated;
}

/**
 * パッケージからドキュメントを削除する。
 */
export function removeDocument(
  packageId: string,
  docId: string,
): HandoverPackage | null {
  const pkg = handoverPackageStore.get(packageId as HandoverPackageId);
  if (!pkg) return null;

  const updated: HandoverPackage = {
    ...pkg,
    documents: pkg.documents.filter((d) => d.id !== docId),
  };

  handoverPackageStore.save(updated);
  return updated;
}

// ── Warranty tracking ──────────────────────────────────────────────────────

/**
 * 失効30日前の保証書を返す。
 */
export function getExpiringSoonDocuments(
  packageId: string,
  withinDays = 30,
): HandoverDocument[] {
  const pkg = handoverPackageStore.get(packageId as HandoverPackageId);
  if (!pkg) return [];
  return getExpiringSoon(pkg.documents, withinDays);
}

// ── Rendering ──────────────────────────────────────────────────────────────

/**
 * 引渡しパッケージを指定フォーマットで生成する。
 */
export function generateHandoverDocument(
  packageId: string,
  target: HandoverRenderTarget,
): string | null {
  const pkg = handoverPackageStore.get(packageId as HandoverPackageId);
  if (!pkg) return null;
  return renderHandoverPackage(pkg, target);
}

// ── Queries ────────────────────────────────────────────────────────────────

/** プロジェクトの全引渡しパッケージを返す */
export function listProjectHandoverPackages(projectId: string): HandoverPackage[] {
  return handoverPackageStore.listByProject(projectId);
}

/** ステータスで絞り込む */
export function listHandoverPackagesByStatus(status: HandoverPackageStatus): HandoverPackage[] {
  return handoverPackageStore.listByStatus(status);
}

/** 最近の引渡しパッケージ一覧 */
export function listRecentHandoverPackages(limit = 20): HandoverPackage[] {
  return handoverPackageStore.listRecent(limit);
}

/** 特定IDの引渡しパッケージを取得 */
export function getHandoverPackage(packageId: string): HandoverPackage | null {
  return handoverPackageStore.get(packageId as HandoverPackageId);
}
