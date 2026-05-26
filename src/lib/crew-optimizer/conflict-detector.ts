/**
 * Conflict Detector — detects scheduling conflicts from a list of assignments.
 */

import type { CraftsmanAssignment, CrewConflict, Craftsman, TaskAssignment } from "./types.js";
import { haversineKm } from "./distance-calculator.js";
import { matchScore } from "./skill-matcher.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Convert YYYY-MM-DD to Date at midnight UTC */
function parseDate(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}

/** Check if two date ranges [s1, e1] and [s2, e2] overlap (inclusive) */
function datesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  const start1 = parseDate(s1).getTime();
  const end1 = parseDate(e1).getTime();
  const start2 = parseDate(s2).getTime();
  const end2 = parseDate(e2).getTime();
  return start1 <= end2 && start2 <= end1;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export type ConflictDetectorContext = {
  assignments: CraftsmanAssignment[];
  tasks: TaskAssignment[];
  crew: Craftsman[];
  maxTravelKm: number;
};

/**
 * Detect all conflicts from a set of assignments.
 */
export function detectConflicts(ctx: ConflictDetectorContext): CrewConflict[] {
  const { assignments, tasks, crew, maxTravelKm } = ctx;
  const conflicts: CrewConflict[] = [];

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const craftsmanMap = new Map(crew.map((c) => [c.id, c]));

  // Group assignments by craftsmanId
  const byCraftsman = new Map<string, CraftsmanAssignment[]>();
  for (const a of assignments) {
    const list = byCraftsman.get(a.craftsmanId) ?? [];
    list.push(a);
    byCraftsman.set(a.craftsmanId, list);
  }

  for (const [craftsmanId, craftsmanAssignments] of byCraftsman) {
    const craftsman = craftsmanMap.get(craftsmanId);

    // ── doubleBooking ───────────────────────────────────────────────────────
    for (let i = 0; i < craftsmanAssignments.length; i++) {
      for (let j = i + 1; j < craftsmanAssignments.length; j++) {
        const ta = taskMap.get(craftsmanAssignments[i].taskId);
        const tb = taskMap.get(craftsmanAssignments[j].taskId);
        if (!ta || !tb) continue;
        if (datesOverlap(ta.startDate, ta.endDate, tb.startDate, tb.endDate)) {
          conflicts.push({
            kind: "doubleBooking",
            craftsmanId,
            taskIds: [ta.id, tb.id],
            severity: "critical",
            messageJa: `${craftsmanId} が「${ta.taskName}」と「${tb.taskName}」でダブルブッキングしています`,
          });
        }
      }
    }

    // ── skillMismatch ───────────────────────────────────────────────────────
    for (const a of craftsmanAssignments) {
      const task = taskMap.get(a.taskId);
      if (!task || !craftsman) continue;
      const score = matchScore(craftsman, task);
      if (score === 0 && task.requiredSkills.length > 0) {
        conflicts.push({
          kind: "skillMismatch",
          craftsmanId,
          taskIds: [task.id],
          severity: "critical",
          messageJa: `${craftsman.name} は「${task.taskName}」の必要スキルを持っていません`,
        });
      }
    }

    // ── overcapacity ────────────────────────────────────────────────────────
    if (craftsman) {
      // Count how many tasks overlap on any given date — simplified: count by overlap pairs
      const overlappingGroups: string[][] = [];
      for (let i = 0; i < craftsmanAssignments.length; i++) {
        const group: string[] = [craftsmanAssignments[i].taskId];
        for (let j = i + 1; j < craftsmanAssignments.length; j++) {
          const ta = taskMap.get(craftsmanAssignments[i].taskId);
          const tb = taskMap.get(craftsmanAssignments[j].taskId);
          if (ta && tb && datesOverlap(ta.startDate, ta.endDate, tb.startDate, tb.endDate)) {
            group.push(craftsmanAssignments[j].taskId);
          }
        }
        if (group.length > craftsman.maxConcurrentSites) {
          overlappingGroups.push(group);
        }
      }
      for (const group of overlappingGroups) {
        conflicts.push({
          kind: "overcapacity",
          craftsmanId,
          taskIds: group,
          severity: "warn",
          messageJa: `${craftsman.name} の同時現場数が上限 ${craftsman.maxConcurrentSites} を超えています`,
        });
      }
    }

    // ── travelTooLong ───────────────────────────────────────────────────────
    for (const a of craftsmanAssignments) {
      const task = taskMap.get(a.taskId);
      if (!task || !craftsman) continue;
      const dist = haversineKm(
        craftsman.baseLocationLat,
        craftsman.baseLocationLng,
        task.siteLat,
        task.siteLng,
      );
      if (dist > maxTravelKm) {
        conflicts.push({
          kind: "travelTooLong",
          craftsmanId,
          taskIds: [task.id],
          severity: "warn",
          messageJa: `${craftsman.name} から「${task.taskName}」現場まで ${dist.toFixed(1)}km — 上限 ${maxTravelKm}km を超えています`,
        });
      }
    }
  }

  return conflicts;
}
