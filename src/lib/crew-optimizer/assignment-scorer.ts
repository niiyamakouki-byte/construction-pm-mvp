/**
 * Assignment Scorer — computes a composite score for assigning a craftsman to a task.
 *
 * score = weightSkill*skillScore
 *       + weightDistance*(1 - dist/maxKm)
 *       + weightUtilization*(1 - currentLoad)
 *       + weightPriority*(task.priority/5)
 */

import type { Craftsman, TaskAssignment, OptimizationConfig } from "./types.js";
import { DEFAULT_OPTIMIZATION_CONFIG } from "./types.js";
import { matchScore } from "./skill-matcher.js";
import { haversineKm } from "./distance-calculator.js";

/**
 * @param craftsman      職人
 * @param task           タスク
 * @param currentLoad    0..1 — 現在の稼働率 (割当済みタスク数 / maxConcurrentSites)
 * @param config         最適化設定 (省略時は DEFAULT_OPTIMIZATION_CONFIG)
 * @returns              0..1 のスコア
 */
export function scoreAssignment(
  craftsman: Craftsman,
  task: TaskAssignment,
  currentLoad: number,
  config: OptimizationConfig = DEFAULT_OPTIMIZATION_CONFIG,
): number {
  const { weightSkill, weightDistance, weightUtilization, weightPriority, maxTravelKm } = config;

  // Skill score
  const skillScore = matchScore(craftsman, task);

  // Distance score: 1 at origin, 0 at maxTravelKm
  const dist = haversineKm(
    craftsman.baseLocationLat,
    craftsman.baseLocationLng,
    task.siteLat,
    task.siteLng,
  );
  const distScore = Math.max(0, 1 - dist / maxTravelKm);

  // Utilization score: prefer less-loaded craftsmen
  const clampedLoad = Math.min(1, Math.max(0, currentLoad));
  const utilizationScore = 1 - clampedLoad;

  // Priority score
  const priorityScore = Math.min(1, Math.max(0, task.priority / 5));

  return (
    weightSkill * skillScore +
    weightDistance * distScore +
    weightUtilization * utilizationScore +
    weightPriority * priorityScore
  );
}
