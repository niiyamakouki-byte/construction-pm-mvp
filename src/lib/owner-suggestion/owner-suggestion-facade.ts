/**
 * owner-suggestion-facade — 施主提案AIワークフローの公開API
 *
 * Sprint 18-A: 施主提案AI
 */

import type {
  OwnerSuggestion,
  OwnerSuggestionId,
  OwnerProfile,
} from "./types.js";
import { makeOwnerSuggestionId } from "./types.js";
import { ownerSuggestionStore } from "./owner-suggestion-store.js";
import { generateThreePlans } from "./plan-generator.js";
import { renderSuggestion } from "./suggestion-pdf-builder.js";
import type { SuggestionRenderTarget } from "./suggestion-pdf-builder.js";

// ── Counter ────────────────────────────────────────────────────────────────

let _suggestionCounter = 0;

function newSuggestionId(): OwnerSuggestionId {
  return makeOwnerSuggestionId(`os-${Date.now()}-${++_suggestionCounter}`);
}

// ── Create ─────────────────────────────────────────────────────────────────

/**
 * 施主提案を新規作成して保存・返却する。
 * 3案 (budget / balanced / premium) を自動生成する。
 */
export function createSuggestion(
  projectId: string,
  profile: OwnerProfile,
  budgetTarget: number,
  now = new Date(),
): OwnerSuggestion {
  const plans = generateThreePlans(profile, budgetTarget);

  const suggestion: OwnerSuggestion = {
    id: newSuggestionId(),
    projectId,
    ownerProfile: profile,
    plans,
    generatedAt: now.toISOString(),
  };

  ownerSuggestionStore.add(suggestion);
  return suggestion;
}

// ── Status transitions ─────────────────────────────────────────────────────

/**
 * 提案を施主に提示済みにする。
 */
export function presentToOwner(
  id: string,
  now = new Date(),
): OwnerSuggestion | null {
  return ownerSuggestionStore.update(id as OwnerSuggestionId, {
    presentedAt: now.toISOString(),
  });
}

/**
 * 施主の決定プランを記録する。
 * accepted=true: 採用、false: 見送り
 */
export function markPlanDecision(
  id: string,
  planId: string,
  accepted: boolean,
): OwnerSuggestion | null {
  const suggestion = ownerSuggestionStore.get(id as OwnerSuggestionId);
  if (!suggestion) return null;

  const updatedPlans = suggestion.plans.map((p): typeof p => {
    if (p.id === planId) {
      return { ...p, status: accepted ? "accepted" : "rejected" };
    }
    // 他プランは rejected にする (採用は1つ)
    if (accepted && p.status !== "accepted") {
      return { ...p, status: "rejected" };
    }
    return p;
  }) as [typeof suggestion.plans[0], typeof suggestion.plans[1], typeof suggestion.plans[2]];

  return ownerSuggestionStore.update(id as OwnerSuggestionId, {
    decidedPlanId: accepted ? planId : suggestion.decidedPlanId,
    plans: updatedPlans,
  });
}

// ── Export ─────────────────────────────────────────────────────────────────

/**
 * 施主提案書を指定フォーマットで出力する。
 */
export function exportPDF(
  id: string,
  format: SuggestionRenderTarget,
): string | null {
  const suggestion = ownerSuggestionStore.get(id as OwnerSuggestionId);
  if (!suggestion) return null;
  return renderSuggestion(suggestion, format);
}

// ── Queries ────────────────────────────────────────────────────────────────

/** 全提案一覧を返す */
export function listAllSuggestions(limit = 100): OwnerSuggestion[] {
  return ownerSuggestionStore.getAll(limit);
}

/** プロジェクトIDで絞り込む */
export function listSuggestionsByProject(projectId: string): OwnerSuggestion[] {
  return ownerSuggestionStore.getAll().filter((s) => s.projectId === projectId);
}

/** IDで取得 */
export function getSuggestion(id: string): OwnerSuggestion | null {
  return ownerSuggestionStore.get(id as OwnerSuggestionId);
}

/** 提案を削除する */
export function removeSuggestion(id: string): void {
  ownerSuggestionStore.remove(id as OwnerSuggestionId);
}
