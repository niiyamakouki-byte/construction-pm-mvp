/**
 * StageTransitionEngine — deal ステージ遷移ロジック.
 *
 * Sprint 16-B: 営業パイプライン可視化
 */

import type { Deal, DealStage, StageTransition } from "./types.js";
import { dealStore } from "./deal-store.js";

/**
 * Deal のステージを遷移させる。
 * stageHistory に StageTransition を append し、daysInPreviousStage を計算する。
 * won/lost への遷移時は wonAt/lostAt を自動セットする。
 */
export function transition(
  deal: Deal,
  toStage: DealStage,
  transitionedAt: Date = new Date(),
): Deal {
  const now = transitionedAt.toISOString();

  // 直前ステージの開始日時を計算
  const lastTransition = deal.stageHistory[deal.stageHistory.length - 1];
  const prevStart = lastTransition
    ? new Date(lastTransition.transitionedAt)
    : new Date(deal.createdAt);
  const daysInPreviousStage = Math.floor(
    (transitionedAt.getTime() - prevStart.getTime()) / 86400000,
  );

  const newTransition: StageTransition = {
    fromStage: deal.currentStage,
    toStage,
    transitionedAt: now,
    daysInPreviousStage,
  };

  const updated: Deal = {
    ...deal,
    currentStage: toStage,
    stageHistory: [...deal.stageHistory, newTransition],
    updatedAt: now,
  };

  if (toStage === "won") {
    updated.wonAt = now;
  } else if (toStage === "lost") {
    updated.lostAt = now;
  }

  return updated;
}

/**
 * 直前のステージに戻す (最後の StageTransition を取り消す)。
 * 変更を dealStore に保存して返す。
 * 見つからない場合は null を返す。
 */
export function revertLastTransition(dealId: string): Deal | null {
  const deal = dealStore.byId(dealId);
  if (!deal) return null;
  if (deal.stageHistory.length === 0) return deal;

  const newHistory = deal.stageHistory.slice(0, -1);
  const lastTransition = deal.stageHistory[deal.stageHistory.length - 1];

  const updated: Deal = {
    ...deal,
    currentStage: lastTransition.fromStage,
    stageHistory: newHistory,
    updatedAt: new Date().toISOString(),
  };

  // Clear wonAt/lostAt if reverting from won/lost
  if (lastTransition.toStage === "won") {
    updated.wonAt = undefined;
  } else if (lastTransition.toStage === "lost") {
    updated.lostAt = undefined;
    updated.lossReason = undefined;
  }

  dealStore.save(updated);
  return updated;
}
