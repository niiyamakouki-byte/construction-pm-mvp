/**
 * Skill Matcher — computes how well a craftsman matches a task's required skills.
 */

import type { Craftsman, TaskAssignment } from "./types.js";

/**
 * Returns a match score 0..1.
 *
 * - 全必要スキルを充足 → 1.0
 * - 一部充足 → 充足比率 (matched / required)
 * - 必要スキルなし → 1.0 (no constraint)
 * - 不足のみ → 0
 */
export function matchScore(craftsman: Craftsman, task: TaskAssignment): number {
  if (task.requiredSkills.length === 0) return 1.0;
  const craftsmanSkillSet = new Set(craftsman.skills);
  const matched = task.requiredSkills.filter((s) => craftsmanSkillSet.has(s)).length;
  return matched / task.requiredSkills.length;
}
