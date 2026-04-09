import type { Task } from "../domain/types.js";

export type ProcurementAlert = {
  taskId: string;
  projectId: string;
  taskName: string;
  startDate: string;
  leadTime: number;
  daysRemaining: number;
};

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function getTaskLeadTime(task: Pick<Task, "lead_time" | "leadTimeDays">): number | null {
  const rawLeadTime = task.lead_time ?? task.leadTimeDays;
  if (!Number.isFinite(rawLeadTime)) {
    return null;
  }

  return Math.max(0, Math.trunc(rawLeadTime));
}

export function buildProcurementAlerts(
  tasks: Task[],
  today = toLocalDateString(new Date()),
): ProcurementAlert[] {
  return tasks
    .filter((task) => task.status !== "done" && Boolean(task.startDate))
    .flatMap((task) => {
      const leadTime = getTaskLeadTime(task);
      if (leadTime == null || !task.startDate) {
        return [];
      }

      const daysRemaining = daysBetween(today, task.startDate);
      if (daysRemaining < 0 || daysRemaining > leadTime + 3) {
        return [];
      }

      return [{
        taskId: task.id,
        projectId: task.projectId,
        taskName: task.name,
        startDate: task.startDate,
        leadTime,
        daysRemaining,
      }];
    })
    .sort((left, right) => {
      const byRemaining = left.daysRemaining - right.daysRemaining;
      if (byRemaining !== 0) return byRemaining;
      return left.startDate.localeCompare(right.startDate);
    });
}
