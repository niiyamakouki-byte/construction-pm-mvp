import { addDaysSkipWeekends, daysBetween } from "../components/gantt/utils.js";
import type { GanttTask } from "../components/gantt/types.js";
import type { DependencyType } from "../domain/types.js";

/**
 * Given a map of taskId -> GanttTask, and a set of tasks whose dates changed,
 * cascade dependency shifts to all downstream descendants.
 * Supports FS, FF, SS, SF, and none dependency types.
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

  // Reflect the initial change into taskMap so FF/SS/SF successors see new dates
  taskMap.set(changedTaskId, { ...originalTask, startDate: newStartDate, endDate: newEndDate });

  // BFS cascade through dependents
  const visited = new Set<string>();
  const queue: string[] = [changedTaskId];

  // Build reverse dependency map: predecessorId -> list of {successorId, depType}
  const successorMap = new Map<string, Array<{ id: string; depType: DependencyType }>>();
  for (const task of tasks) {
    for (const depId of task.dependencies ?? []) {
      const existing = successorMap.get(depId) ?? [];
      existing.push({ id: task.id, depType: task.dependencyType ?? "FS" });
      successorMap.set(depId, existing);
    }
  }

  visited.add(changedTaskId);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const successors = successorMap.get(currentId) ?? [];

    for (const { id: successorId, depType } of successors) {
      if (visited.has(successorId)) continue;

      // none = no scheduling constraint
      if (depType === "none") continue;

      visited.add(successorId);

      const successor = taskMap.get(successorId);
      if (!successor) continue;

      const prevUpdate = updates.get(successorId);
      const currentStart = prevUpdate?.startDate ?? successor.startDate;
      const currentEnd = prevUpdate?.endDate ?? successor.endDate;
      const duration = daysBetween(currentStart, currentEnd);

      const predecessor = taskMap.get(currentId);
      if (!predecessor) continue;

      const predUpdate = updates.get(currentId);
      const predStart = predUpdate?.startDate ?? predecessor.startDate;
      const predEnd = predUpdate?.endDate ?? predecessor.endDate;

      let newSStart: string;
      let newSEnd: string;

      switch (depType) {
        case "FF": {
          // Finish-to-Finish: successor end = predecessor end
          newSEnd = predEnd;
          newSStart = addDaysSkipWeekends(
            newSEnd,
            -duration,
            successor.projectIncludesWeekends,
            successor.includeWeekends,
          );
          break;
        }
        case "SS": {
          // Start-to-Start: successor start = predecessor start
          newSStart = predStart;
          newSEnd = addDaysSkipWeekends(
            newSStart,
            duration,
            successor.projectIncludesWeekends,
            successor.includeWeekends,
          );
          break;
        }
        case "SF": {
          // Start-to-Finish: successor end = predecessor start
          newSEnd = predStart;
          newSStart = addDaysSkipWeekends(
            newSEnd,
            -duration,
            successor.projectIncludesWeekends,
            successor.includeWeekends,
          );
          break;
        }
        case "FS":
        default: {
          // Finish-to-Start: successor start = predecessor end (shift by delta)
          newSStart = addDaysSkipWeekends(
            currentStart,
            shiftDays,
            successor.projectIncludesWeekends,
            successor.includeWeekends,
          );
          newSEnd = addDaysSkipWeekends(
            currentEnd,
            shiftDays,
            successor.projectIncludesWeekends,
            successor.includeWeekends,
          );
          break;
        }
      }

      updates.set(successorId, { startDate: newSStart, endDate: newSEnd });

      // Update taskMap so further cascades use updated dates
      taskMap.set(successorId, { ...successor, startDate: newSStart, endDate: newSEnd });

      queue.push(successorId);
    }
  }

  return updates;
}
