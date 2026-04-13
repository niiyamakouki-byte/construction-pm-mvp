/**
 * Full-text cross-project Gantt search for GenbaHub.
 * Supports text search across task name, assignee, and project name,
 * combined with status and assignee filters.
 */

import type { TaskStatus } from "../../domain/types.js";
import type { CrossProjectGanttTask } from "./cross-project-gantt.js";

export type GanttSearchFilter = {
  /** Free-text query matched against task name, projectName, and assigneeId */
  query?: string;
  /** Only return tasks with these statuses (empty = no filter) */
  statuses?: TaskStatus[];
  /** Only return tasks assigned to this assigneeId (undefined = no filter) */
  assigneeId?: string;
};

export type MatchHighlight = {
  field: "name" | "projectName" | "assigneeId";
  /** Start index (inclusive) of the match within the field value */
  startIndex: number;
  /** End index (exclusive) of the match within the field value */
  endIndex: number;
};

export type GanttSearchResult = {
  task: CrossProjectGanttTask;
  highlights: MatchHighlight[];
};

function indexOfCaseInsensitive(haystack: string, needle: string): number {
  return haystack.toLowerCase().indexOf(needle.toLowerCase());
}

function buildHighlights(
  task: CrossProjectGanttTask,
  query: string,
): MatchHighlight[] {
  const highlights: MatchHighlight[] = [];
  const fields: Array<{ field: MatchHighlight["field"]; value: string | undefined }> = [
    { field: "name", value: task.name },
    { field: "projectName", value: task.projectName },
    { field: "assigneeId", value: task.assigneeId },
  ];

  for (const { field, value } of fields) {
    if (!value) continue;
    const idx = indexOfCaseInsensitive(value, query);
    if (idx !== -1) {
      highlights.push({ field, startIndex: idx, endIndex: idx + query.length });
    }
  }

  return highlights;
}

function matchesQuery(task: CrossProjectGanttTask, query: string): boolean {
  const lower = query.toLowerCase();
  return (
    task.name.toLowerCase().includes(lower) ||
    task.projectName.toLowerCase().includes(lower) ||
    (task.assigneeId?.toLowerCase().includes(lower) ?? false)
  );
}

/**
 * Search and filter a flat list of CrossProjectGanttTask.
 *
 * - query: matched case-insensitively against name, projectName, assigneeId
 * - statuses: if non-empty, only tasks with matching status are returned
 * - assigneeId: exact match against task.assigneeId
 *
 * Returns matched tasks with highlight metadata.
 */
export function searchGanttTasks(
  filter: GanttSearchFilter,
  tasks: CrossProjectGanttTask[],
): GanttSearchResult[] {
  const { query = "", statuses = [], assigneeId } = filter;
  const trimmedQuery = query.trim();

  return tasks
    .filter((task) => {
      if (trimmedQuery && !matchesQuery(task, trimmedQuery)) return false;
      if (statuses.length > 0 && !statuses.includes(task.status)) return false;
      if (assigneeId !== undefined && task.assigneeId !== assigneeId) return false;
      return true;
    })
    .map((task) => ({
      task,
      highlights: trimmedQuery ? buildHighlights(task, trimmedQuery) : [],
    }));
}
