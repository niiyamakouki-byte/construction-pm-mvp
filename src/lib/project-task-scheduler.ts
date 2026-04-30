export type SchedulableProjectTask = {
  id: string;
  durationDays: number;
  dependsOn: string[];
  orderIndex: number;
};

export type ScheduledProjectTask<T extends SchedulableProjectTask> = T & {
  startDate: string;
  endDate: string;
};

function parseDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function moveToWorkingDay(date: Date): Date {
  const next = new Date(date);
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function addWorkingDays(start: Date, days: number, skipWeekends: boolean): Date {
  const normalizedStart = skipWeekends ? moveToWorkingDay(start) : new Date(start);

  if (!skipWeekends || days <= 1) {
    const result = new Date(normalizedStart);
    result.setDate(result.getDate() + Math.max(0, days - 1));
    return result;
  }

  const current = new Date(normalizedStart);
  let remaining = days - 1;
  while (remaining > 0) {
    current.setDate(current.getDate() + 1);
    if (current.getDay() !== 0 && current.getDay() !== 6) {
      remaining--;
    }
  }
  return current;
}

function nextWorkingDay(date: Date, skipWeekends: boolean): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return skipWeekends ? moveToWorkingDay(next) : next;
}

export function resolveProjectTaskSchedule<T extends SchedulableProjectTask>(
  tasks: T[],
  options: {
    projectStartDate: string;
    skipWeekends: boolean;
  },
): Array<ScheduledProjectTask<T>> {
  const orderedTasks = [...tasks].sort((left, right) => left.orderIndex - right.orderIndex);
  const scheduledById = new Map<string, ScheduledProjectTask<T>>();
  const baseStart = options.skipWeekends
    ? moveToWorkingDay(parseDate(options.projectStartDate))
    : parseDate(options.projectStartDate);

  return orderedTasks.map((task) => {
    const dependencyEnds = task.dependsOn
      .map((dependencyId) => scheduledById.get(dependencyId))
      .filter((dependency): dependency is ScheduledProjectTask<T> => dependency !== undefined)
      .map((dependency) => parseDate(dependency.endDate));

    const start = dependencyEnds.length === 0
      ? new Date(baseStart)
      : nextWorkingDay(
        dependencyEnds.reduce((latest, current) => current > latest ? current : latest, dependencyEnds[0]),
        options.skipWeekends,
      );
    const end = addWorkingDays(start, Math.max(1, task.durationDays), options.skipWeekends);

    const scheduledTask = {
      ...task,
      startDate: formatDate(start),
      endDate: formatDate(end),
    };

    scheduledById.set(task.id, scheduledTask);
    return scheduledTask;
  });
}
