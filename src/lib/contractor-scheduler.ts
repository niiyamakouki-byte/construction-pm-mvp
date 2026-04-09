import type { Contractor, Task } from "../domain/types.js";

export type ContractorAssignment = {
  taskId: string;
  contractorId: string;
  assignedAt: string;
};

export type WorkloadEntry = {
  taskId: string;
  taskName: string;
  startDate: string;
  endDate: string;
  hoursPerDay: number;
};

export type OverallocationWarning = {
  contractorId: string;
  date: string;
  totalHours: number;
  taskIds: string[];
};

function getTaskEndDate(task: Task): string | undefined {
  return task.dueDate ?? task.startDate;
}

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Assign a contractor to a task. Returns updated task with contractorId set.
 */
export function assignContractor(
  tasks: Task[],
  taskId: string,
  contractorId: string,
): { tasks: Task[]; assignment: ContractorAssignment } {
  const now = new Date().toISOString();
  const updatedTasks = tasks.map((task) =>
    task.id === taskId
      ? { ...task, contractorId, updatedAt: now }
      : task,
  );

  return {
    tasks: updatedTasks,
    assignment: { taskId, contractorId, assignedAt: now },
  };
}

/**
 * Get all tasks assigned to a contractor within a date range.
 */
export function getContractorWorkload(
  tasks: Task[],
  contractorId: string,
  rangeStart: string,
  rangeEnd: string,
): WorkloadEntry[] {
  return tasks
    .filter((task) => {
      if (task.contractorId !== contractorId) return false;
      if (!task.startDate || !getTaskEndDate(task)) return false;
      const taskEnd = getTaskEndDate(task)!;
      return task.startDate <= rangeEnd && taskEnd >= rangeStart;
    })
    .map((task) => ({
      taskId: task.id,
      taskName: task.name,
      startDate: task.startDate!,
      endDate: getTaskEndDate(task)!,
      hoursPerDay: 8,
    }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/**
 * Find contractors that are not booked on a given date.
 * Optionally filter by required skill (matched against contractor.specialty).
 */
export function findAvailableContractors(
  contractors: Contractor[],
  tasks: Task[],
  date: string,
  requiredSkill?: string,
): Contractor[] {
  const busyContractorIds = new Set(
    tasks
      .filter((task) => {
        if (!task.contractorId || !task.startDate || !getTaskEndDate(task)) return false;
        return task.startDate <= date && getTaskEndDate(task)! >= date;
      })
      .map((task) => task.contractorId!),
  );

  return contractors.filter((contractor) => {
    if (busyContractorIds.has(contractor.id)) return false;
    if (requiredSkill && contractor.specialty) {
      return contractor.specialty.toLowerCase().includes(requiredSkill.toLowerCase());
    }
    if (requiredSkill && !contractor.specialty) return false;
    return true;
  });
}

/**
 * Detect overallocation: contractors assigned >8h in a single day.
 */
export function detectOverallocation(
  contractors: Contractor[],
  tasks: Task[],
  maxHoursPerDay = 8,
): OverallocationWarning[] {
  const contractorTasks = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.contractorId || !task.startDate || !getTaskEndDate(task)) continue;
    const existing = contractorTasks.get(task.contractorId) ?? [];
    existing.push(task);
    contractorTasks.set(task.contractorId, existing);
  }

  const warnings: OverallocationWarning[] = [];
  const contractorIds = new Set(contractors.map((c) => c.id));

  for (const [contractorId, cTasks] of contractorTasks.entries()) {
    if (!contractorIds.has(contractorId)) continue;
    if (cTasks.length < 2) continue;

    const dailyHours = new Map<string, { hours: number; taskIds: string[] }>();

    for (const task of cTasks) {
      const dates = dateRange(task.startDate!, getTaskEndDate(task)!);
      for (const d of dates) {
        const entry = dailyHours.get(d) ?? { hours: 0, taskIds: [] };
        entry.hours += 8;
        entry.taskIds.push(task.id);
        dailyHours.set(d, entry);
      }
    }

    for (const [date, entry] of dailyHours.entries()) {
      if (entry.hours > maxHoursPerDay) {
        warnings.push({
          contractorId,
          date,
          totalHours: entry.hours,
          taskIds: entry.taskIds,
        });
      }
    }
  }

  return warnings.sort((a, b) => a.date.localeCompare(b.date) || a.contractorId.localeCompare(b.contractorId));
}
