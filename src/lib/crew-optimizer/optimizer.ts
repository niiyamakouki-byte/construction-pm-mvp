/**
 * Optimizer — greedy crew scheduling engine.
 *
 * タスクを priority 降順で並べ、各タスクに score 上位の職人を peopleNeeded 数だけ割当。
 * 1人目=lead、残り=sub
 * 割当不可 (skill 該当 0 or 全員 overlap) → unassignedTaskIds へ
 */

import type {
  TaskAssignment,
  Craftsman,
  CraftsmanAssignment,
  CrewSchedule,
  CrewOptimizationResult,
  OptimizationConfig,
} from "./types.js";
import { DEFAULT_OPTIMIZATION_CONFIG } from "./types.js";
import { scoreAssignment } from "./assignment-scorer.js";
import { matchScore } from "./skill-matcher.js";
import { detectConflicts } from "./conflict-detector.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}

function datesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return (
    parseDate(s1).getTime() <= parseDate(e2).getTime() &&
    parseDate(s2).getTime() <= parseDate(e1).getTime()
  );
}

/** All YYYY-MM-DD dates within [startDate, endDate] inclusive */
function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cur = parseDate(startDate);
  const end = parseDate(endDate);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function optimize(
  tasks: TaskAssignment[],
  crew: Craftsman[],
  config: OptimizationConfig = DEFAULT_OPTIMIZATION_CONFIG,
): CrewOptimizationResult {
  const allAssignments: CraftsmanAssignment[] = [];
  const unassignedTaskIds: string[] = [];

  // Track active assignments per craftsman for overlap detection
  // craftsmanId → TaskAssignment[]
  const activeByCraftsman = new Map<string, TaskAssignment[]>();
  for (const c of crew) activeByCraftsman.set(c.id, []);

  // Sort tasks by priority descending
  const sortedTasks = [...tasks].sort((a, b) => b.priority - a.priority);

  for (const task of sortedTasks) {
    // Compute current load for each craftsman
    const scored = crew
      .map((c) => {
        const existingTasks = activeByCraftsman.get(c.id) ?? [];

        // Check overlap with existing assignments
        const overlapping = existingTasks.filter((et) =>
          datesOverlap(task.startDate, task.endDate, et.startDate, et.endDate),
        );

        // Skip if already at max concurrent sites
        if (overlapping.length >= c.maxConcurrentSites) return null;

        // Skip if skill score is 0 and required skills exist
        const skill = matchScore(c, task);
        if (skill === 0 && task.requiredSkills.length > 0) return null;

        const currentLoad = overlapping.length / c.maxConcurrentSites;
        const score = scoreAssignment(c, task, currentLoad, config);

        return { craftsman: c, score };
      })
      .filter((x): x is { craftsman: Craftsman; score: number } => x !== null)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      unassignedTaskIds.push(task.id);
      continue;
    }

    const selected = scored.slice(0, task.peopleNeeded);

    if (selected.length === 0) {
      unassignedTaskIds.push(task.id);
      continue;
    }

    selected.forEach(({ craftsman, score }, idx) => {
      const role: "lead" | "sub" = idx === 0 ? "lead" : "sub";
      const skillScore = matchScore(craftsman, task);
      const reasoning_ja =
        skillScore >= 1.0
          ? `スコア ${score.toFixed(2)}: 必要スキル完全充足、距離・稼働率良好`
          : skillScore > 0
          ? `スコア ${score.toFixed(2)}: スキル部分充足 (${Math.round(skillScore * 100)}%)`
          : `スコア ${score.toFixed(2)}: スキル割当`;

      allAssignments.push({
        taskId: task.id,
        craftsmanId: craftsman.id,
        role,
        score,
        reasoning_ja,
      });

      activeByCraftsman.get(craftsman.id)!.push(task);
    });
  }

  // Build daily schedules
  const dateSet = new Set<string>();
  for (const task of tasks) {
    for (const d of dateRange(task.startDate, task.endDate)) {
      dateSet.add(d);
    }
  }
  const allDates = [...dateSet].sort();

  // Map taskId → TaskAssignment
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  // Detect conflicts from all assignments
  const allConflicts = detectConflicts({
    assignments: allAssignments,
    tasks,
    crew,
    maxTravelKm: config.maxTravelKm,
  });

  const schedules: CrewSchedule[] = allDates.map((date) => {
    // Assignments active on this date
    const dayAssignments = allAssignments.filter((a) => {
      const task = taskMap.get(a.taskId);
      if (!task) return false;
      return datesOverlap(date, date, task.startDate, task.endDate);
    });

    // Conflicts on this date
    const dayConflicts = allConflicts.filter((c) => {
      return c.taskIds.some((tid) => {
        const task = taskMap.get(tid);
        if (!task) return false;
        return datesOverlap(date, date, task.startDate, task.endDate);
      });
    });

    // Utilization = assigned craftsmen / total crew
    const assignedCraftsmenIds = new Set(dayAssignments.map((a) => a.craftsmanId));
    const utilizationPct =
      crew.length > 0
        ? Math.round((assignedCraftsmenIds.size / crew.length) * 100)
        : 0;

    return {
      date,
      assignments: dayAssignments,
      conflicts: dayConflicts,
      utilizationPct,
    };
  });

  const totalConflicts = allConflicts.length;
  const avgUtilizationPct =
    schedules.length > 0
      ? Math.round(
          schedules.reduce((sum, s) => sum + s.utilizationPct, 0) / schedules.length,
        )
      : 0;

  return {
    schedules,
    totalConflicts,
    avgUtilizationPct,
    unassignedTaskIds,
    generatedAt: new Date().toISOString(),
  };
}
