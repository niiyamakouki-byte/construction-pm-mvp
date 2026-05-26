/**
 * warranty-tracker — 各設備の保証期間を expiresAt で管理する。
 *
 * Sprint 17-C: 引渡しパッケージ自動生成
 */

import type { HandoverDocument } from "./types.js";

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 保証期限が設定されているドキュメントのみを返す。
 */
export function warrantyDocuments(documents: HandoverDocument[]): HandoverDocument[] {
  return documents.filter((doc) => doc.expiresAt !== undefined);
}

/**
 * 保証期限が within 日以内に失効するドキュメントを返す。
 * asOf: 基準日 (省略時は現在)
 */
export function getExpiringSoon(
  documents: HandoverDocument[],
  within: number,
  asOf: Date = new Date(),
): HandoverDocument[] {
  const cutoff = new Date(asOf);
  cutoff.setDate(cutoff.getDate() + within);

  return documents.filter((doc) => {
    if (!doc.expiresAt) return false;
    const expires = new Date(doc.expiresAt);
    return expires > asOf && expires <= cutoff;
  });
}

/**
 * 保証期限が既に失効しているドキュメントを返す。
 * asOf: 基準日 (省略時は現在)
 */
export function getExpired(
  documents: HandoverDocument[],
  asOf: Date = new Date(),
): HandoverDocument[] {
  return documents.filter((doc) => {
    if (!doc.expiresAt) return false;
    return new Date(doc.expiresAt) <= asOf;
  });
}

/**
 * 保証期限まで残り日数を計算する (正=有効, 負=失効済み)。
 */
export function daysUntilExpiry(doc: HandoverDocument, asOf: Date = new Date()): number | null {
  if (!doc.expiresAt) return null;
  const diff = new Date(doc.expiresAt).getTime() - asOf.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * 保証書を有効期限の早い順に並べ替えて返す。
 */
export function sortByExpiry(documents: HandoverDocument[]): HandoverDocument[] {
  return [...documents]
    .filter((d) => d.expiresAt !== undefined)
    .sort((a, b) => {
      const dateA = new Date(a.expiresAt!).getTime();
      const dateB = new Date(b.expiresAt!).getTime();
      return dateA - dateB;
    });
}

/**
 * 特定のドキュメントが有効な保証期間内かどうかを判定する。
 */
export function isWarrantyActive(doc: HandoverDocument, asOf: Date = new Date()): boolean {
  if (!doc.expiresAt) return false;
  return new Date(doc.expiresAt) > asOf;
}
