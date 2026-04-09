/**
 * Milestone Tracker module for GenbaHub.
 * Auto-generates milestones from critical path tasks,
 * tracks status, and generates reports.
 */

import type { Project, Task } from "../domain/types.js";

export type MilestoneStatus = "on-track" | "at-risk" | "missed" | "completed";

export type Milestone = {
  id: string;
  projectId: string;
  name: string;
  targetDate: string;
  actualDate?: string;
  status: MilestoneStatus;
};

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Find tasks on the critical path (tasks with dependencies or
 * that are depended upon by other tasks, plus the last task).
 */
function findCriticalTasks(tasks: Task[]): Task[] {
  const depended = new Set<string>();
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      depended.add(dep);
    }
  }

  const critical = tasks.filter(
    (t) =>
      depended.has(t.id) ||
      t.dependencies.length > 0,
  );

  // Always include the latest-ending task as a project completion milestone
  const sortedByEnd = [...tasks]
    .filter((t) => t.dueDate || t.startDate)
    .sort((a, b) => {
      const endA = a.dueDate ?? a.startDate ?? "";
      const endB = b.dueDate ?? b.startDate ?? "";
      return endB.localeCompare(endA);
    });

  if (sortedByEnd.length > 0 && !critical.find((t) => t.id === sortedByEnd[0].id)) {
    critical.push(sortedByEnd[0]);
  }

  return critical;
}

/**
 * Auto-generate milestones from critical path tasks.
 * Each critical task's due date becomes a milestone target.
 */
export function createMilestones(project: Project, tasks: Task[]): Milestone[] {
  const critical = findCriticalTasks(tasks);

  return critical
    .filter((t) => t.dueDate || t.startDate)
    .map((task, index) => {
      const targetDate = task.dueDate ?? task.startDate!;
      return {
        id: `ms-${project.id}-${index + 1}`,
        projectId: project.id,
        name: `${task.name} complete`,
        targetDate,
        actualDate: task.status === "done" ? targetDate : undefined,
        status: "on-track" as MilestoneStatus,
      };
    });
}

/**
 * Check milestone status relative to today's date.
 * - completed: has actualDate
 * - missed: targetDate < today and not completed
 * - at-risk: within 7 days of target and not completed
 * - on-track: otherwise
 */
export function checkMilestoneStatus(
  milestones: Milestone[],
  today: string,
): Milestone[] {
  return milestones.map((ms) => {
    if (ms.actualDate) {
      return { ...ms, status: "completed" as MilestoneStatus };
    }

    const daysRemaining = daysBetween(today, ms.targetDate);

    if (daysRemaining < 0) {
      return { ...ms, status: "missed" as MilestoneStatus };
    }

    if (daysRemaining <= 7) {
      return { ...ms, status: "at-risk" as MilestoneStatus };
    }

    return { ...ms, status: "on-track" as MilestoneStatus };
  });
}

/**
 * Generate a milestone report summary with timeline.
 */
export function generateMilestoneReport(milestones: Milestone[]): string {
  if (milestones.length === 0) {
    return "No milestones defined.";
  }

  const sorted = [...milestones].sort((a, b) =>
    a.targetDate.localeCompare(b.targetDate),
  );

  const statusEmoji: Record<MilestoneStatus, string> = {
    "on-track": "[ON TRACK]",
    "at-risk": "[AT RISK]",
    missed: "[MISSED]",
    completed: "[COMPLETED]",
  };

  const counts = {
    "on-track": 0,
    "at-risk": 0,
    missed: 0,
    completed: 0,
  };

  const lines: string[] = [];
  lines.push("=== Milestone Report ===");
  lines.push("");

  for (const ms of sorted) {
    counts[ms.status]++;
    const actual = ms.actualDate ? ` (actual: ${ms.actualDate})` : "";
    lines.push(`${statusEmoji[ms.status]} ${ms.name}`);
    lines.push(`  Target: ${ms.targetDate}${actual}`);
    lines.push("");
  }

  lines.push("--- Summary ---");
  lines.push(`Total: ${milestones.length}`);
  if (counts.completed > 0) lines.push(`Completed: ${counts.completed}`);
  if (counts["on-track"] > 0) lines.push(`On Track: ${counts["on-track"]}`);
  if (counts["at-risk"] > 0) lines.push(`At Risk: ${counts["at-risk"]}`);
  if (counts.missed > 0) lines.push(`Missed: ${counts.missed}`);

  return lines.join("\n");
}
