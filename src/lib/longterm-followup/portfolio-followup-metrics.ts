/**
 * portfolio-followup-metrics — portfolio-aggregator 向けフォローアップメトリクス
 *
 * Sprint 19-A: 5年/10年フォローオート
 */

import { followupStore } from "./followup-store.js";
import { listCheckpoints, getUpcomingCheckpoints, getActiveLeadsByPotential, listAllLeads } from "./followup-facade.js";

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * アクティブなフォローアップスケジュール総数。
 */
export function activeFollowupSchedules(): number {
  return followupStore.getAll().filter((s) => s.isActive).length;
}

/**
 * 直近30日以内に予定されているチェックポイント数。
 */
export function upcomingCheckpointsNext30Days(now = new Date()): number {
  return getUpcomingCheckpoints(30, now).length;
}

/**
 * LeadPotential が urgent のリフォームリード数。
 */
export function urgentRenovationLeadsCount(): number {
  return getActiveLeadsByPotential("urgent").length;
}

/**
 * 引渡し後年数別の平均劣化スコア。
 * 年数は1年/3年/5年/10年点検のリードから算出。
 */
export function avgDegradationScoreByYear(): { 1: number; 3: number; 5: number; 10: number } {
  const all = listAllLeads();

  const byYear: Record<number, number[]> = { 1: [], 3: [], 5: [], 10: [] };

  for (const lead of all) {
    // checkpointId からチェックポイントの kind を逆引き
    const checkpoints = listCheckpoints();
    const cp = checkpoints.find((c) => c.id === lead.checkpointId);
    if (!cp) continue;

    if (cp.kind === "one_year") byYear[1].push(lead.overallScore);
    if (cp.kind === "three_year") byYear[3].push(lead.overallScore);
    if (cp.kind === "five_year") byYear[5].push(lead.overallScore);
    if (cp.kind === "ten_year") byYear[10].push(lead.overallScore);
  }

  function avg(scores: number[]): number {
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  return {
    1: avg(byYear[1]),
    3: avg(byYear[3]),
    5: avg(byYear[5]),
    10: avg(byYear[10]),
  };
}
