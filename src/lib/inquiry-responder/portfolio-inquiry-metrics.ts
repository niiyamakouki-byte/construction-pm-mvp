/**
 * portfolio-inquiry-metrics — portfolio-aggregator 向けの3指標集計.
 *
 * aggregatePortfolio から呼び出せるユーティリティ。
 * InquiryStore に依存するため、inquiry-responder モジュール内に配置。
 */

import { inquiryStore } from "./inquiry-store.js";

/**
 * 過去24時間以内に受け付けた new / triaged 問合せ数。
 */
export function newInquiryCount24h(): number {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return inquiryStore
    .all()
    .filter(
      (r) =>
        (r.status === "new" || r.status === "triaged") &&
        new Date(r.receivedAt) >= since,
    ).length;
}

/**
 * 未完了 (new / triaged / replied / scheduled) の urgent / high 問合せ数。
 */
export function urgentInquiryCount(): number {
  const closedStatuses = new Set(["closed_won", "closed_lost"]);
  return inquiryStore
    .all()
    .filter(
      (r) =>
        (r.priority === "urgent" || r.priority === "high") &&
        !closedStatuses.has(r.status),
    ).length;
}

/**
 * 返信待ち (new / triaged) 問合せ数。
 */
export function pendingReplyCount(): number {
  return inquiryStore
    .all()
    .filter((r) => r.status === "new" || r.status === "triaged").length;
}
