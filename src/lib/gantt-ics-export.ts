/**
 * Adapter between GanttTask and calendar-export's exportToICS.
 * Converts GanttTask[] (which uses startDate/endDate) to Task[] (startDate/dueDate)
 * and triggers a browser download of the resulting .ics file.
 */

import type { GanttTask } from "../components/gantt/types.js";
import type { Project, Task } from "../domain/types.js";
import { exportToICS } from "./calendar-export.js";

/**
 * Filter GanttTask[] down to tasks that have both a startDate and an endDate
 * (excluding auto-estimated placeholders optionally, but keeping all dated tasks).
 */
export function ganttTasksWithDates(tasks: GanttTask[]): GanttTask[] {
  return tasks.filter((t) => !!t.startDate);
}

/**
 * Convert a GanttTask to a Task-compatible shape for exportToICS.
 * GanttTask.endDate maps to Task.dueDate.
 */
export function ganttTaskToCalendarTask(task: GanttTask): Task {
  return {
    ...task,
    dueDate: task.endDate ?? task.dueDate,
  };
}

/**
 * Export project tasks to ICS and trigger a browser file download.
 * Returns the number of events written (tasks with startDate).
 */
export function downloadProjectICS(project: Project, tasks: GanttTask[]): number {
  const calendarTasks: Task[] = tasks.map(ganttTaskToCalendarTask);
  const icsContent = exportToICS(project, calendarTasks);
  const dated = calendarTasks.filter((t) => !!t.startDate);

  if (dated.length === 0) return 0;

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = project.name.replace(/[^\w　-鿿]/g, "_");
  a.href = url;
  a.download = `${safeName}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return dated.length;
}
