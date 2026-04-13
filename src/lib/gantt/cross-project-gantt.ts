/**
 * Cross-Project Gantt data layer for GenbaHub.
 * Aggregates tasks across all projects, groups them by project,
 * and computes per-project summary cards.
 */

import type { GanttTask } from "../../components/gantt/types.js";

export type CrossProjectGanttTask = GanttTask & {
  projectId: string;
  projectName: string;
};

export type ProjectSummaryCard = {
  projectId: string;
  projectName: string;
  taskCount: number;
  completedCount: number;
  overdueCount: number;
  progressRate: number;
};

/**
 * Combine tasks from multiple projects into a single flat list.
 * Each task must already have projectId and projectName populated.
 */
export function getCrossProjectTasks(
  tasksByProject: { projectId: string; projectName: string; tasks: GanttTask[] }[],
): CrossProjectGanttTask[] {
  const result: CrossProjectGanttTask[] = [];
  for (const { projectId, projectName, tasks } of tasksByProject) {
    for (const task of tasks) {
      result.push({ ...task, projectId, projectName });
    }
  }
  return result;
}

/**
 * Group a flat list of CrossProjectGanttTask by projectId.
 */
export function groupByProject(
  tasks: CrossProjectGanttTask[],
): Map<string, CrossProjectGanttTask[]> {
  const map = new Map<string, CrossProjectGanttTask[]>();
  for (const task of tasks) {
    const existing = map.get(task.projectId);
    if (existing) {
      existing.push(task);
    } else {
      map.set(task.projectId, [task]);
    }
  }
  return map;
}

/**
 * Compute summary cards for each project.
 * - progressRate: average progress across all tasks (0–100)
 * - overdueCount: tasks where dueDate < today and status !== 'done'
 */
export function getProjectSummaryCards(
  tasks: CrossProjectGanttTask[],
  today: string,
): ProjectSummaryCard[] {
  const grouped = groupByProject(tasks);
  const cards: ProjectSummaryCard[] = [];

  for (const [projectId, projectTasks] of grouped) {
    const projectName = projectTasks[0].projectName;
    const taskCount = projectTasks.length;
    const completedCount = projectTasks.filter((t) => t.status === "done").length;
    const overdueCount = projectTasks.filter(
      (t) => t.status !== "done" && t.dueDate != null && t.dueDate < today,
    ).length;
    const progressRate =
      taskCount === 0
        ? 0
        : Math.round(
            projectTasks.reduce((sum, t) => sum + t.progress, 0) / taskCount,
          );

    cards.push({
      projectId,
      projectName,
      taskCount,
      completedCount,
      overdueCount,
      progressRate,
    });
  }

  return cards;
}
