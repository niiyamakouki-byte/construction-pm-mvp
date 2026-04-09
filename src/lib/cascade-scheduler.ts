import { addDaysSkipWeekends, daysBetween } from "../components/gantt/utils.js";
import type { GanttTask } from "../components/gantt/types.js";

/**
 * Given a map of taskId -> GanttTask, and a set of tasks whose dates changed,
 * cascade FS (finish-to-start) dependency shifts to all downstream descendants.
 * Returns a map of taskId -> { startDate, endDate } for tasks that need updating.
 */
export function cascadeSchedule(
  tasks: GanttTask[],
  changedTaskId: string,
  newStartDate: string,
  newEndDate: string,
): Map<string, { startDate: string; endDate: string }> {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const updates = new Map<string, { startDate: string; endDate: string }>();

  // Apply the initial change
  const originalTask = taskMap.get(changedTaskId);
  if (!originalTask) return updates;

  const originalEnd = originalTask.endDate;
  const shiftDays = daysBetween(originalEnd, newEndDate);

  if (shiftDays === 0) return updates;

  // BFS cascade through dependents
  const visited = new Set<string>();
  const queue: string[] = [changedTaskId];

  // Build reverse dependency map: predecessorId -> successorIds
  const successorMap = new Map<string, string[]>();
  for (const task of tasks) {
    for (const depId of task.dependencies ?? []) {
      const existing = successorMap.get(depId) ?? [];
      existing.push(task.id);
      successorMap.set(depId, existing);
    }
  }

  visited.add(changedTaskId);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const successors = successorMap.get(currentId) ?? [];

    for (const successorId of successors) {
      if (visited.has(successorId)) continue;
      visited.add(successorId);

      const successor = taskMap.get(successorId);
      if (!successor) continue;

      const prevUpdate = updates.get(successorId);
      const currentStart = prevUpdate?.startDate ?? successor.startDate;
      const currentEnd = prevUpdate?.endDate ?? successor.endDate;

      const newSStart = addDaysSkipWeekends(
        currentStart,
        shiftDays,
        successor.projectIncludesWeekends,
        successor.includeWeekends,
      );
      const newSEnd = addDaysSkipWeekends(
        currentEnd,
        shiftDays,
        successor.projectIncludesWeekends,
        successor.includeWeekends,
      );

      updates.set(successorId, { startDate: newSStart, endDate: newSEnd });

      // Update taskMap so further cascades use updated dates
      taskMap.set(successorId, { ...successor, startDate: newSStart, endDate: newSEnd });

      queue.push(successorId);
    }
  }

  return updates;
}
