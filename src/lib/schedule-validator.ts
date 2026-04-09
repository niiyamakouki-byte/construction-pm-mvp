import type { Contractor, Task } from "../domain/types.js";
import { daysBetween } from "../components/gantt/utils.js";

export type ScheduleValidationResult = {
  isValid: boolean;
  cycles: string[][];
  missingDependencies: string[];
  order: string[];
};

export type ScheduleGap = {
  predecessorId: string;
  successorId: string;
  predecessorEndDate: string;
  successorStartDate: string;
  gapDays: number;
};

export type ContractorOverlap = {
  contractorId: string;
  contractorName: string;
  firstTaskId: string;
  secondTaskId: string;
  overlapStart: string;
  overlapEnd: string;
  overlapDays: number;
};

export type CriticalPathResult = {
  taskIds: string[];
  totalDuration: number;
  totalSpanDays: number;
  issues: string[];
};

export type TaskSlack = {
  taskId: string;
  freeSlack: number;
  totalSlack: number;
  isCritical: boolean;
};

export type ContractorConflict = ContractorOverlap;

export type ScheduleOptimizationSuggestion = {
  type: "resolve_cycle" | "close_gap" | "reassign_contractor" | "crash_task" | "parallelize";
  impactDays: number;
  taskIds: string[];
  message: string;
};

function getTaskEndDate(task: Task): string | undefined {
  return task.dueDate ?? task.startDate;
}

function getTaskDuration(task: Task): number {
  if (!task.startDate || !getTaskEndDate(task)) return 1;
  return Math.max(1, daysBetween(task.startDate, getTaskEndDate(task)!) + 1);
}

function dedupeCycle(cycle: string[]): string[] {
  if (cycle.length <= 1) return cycle;
  const body = cycle[cycle.length - 1] === cycle[0] ? cycle.slice(0, -1) : cycle.slice();
  let best = body;

  for (let index = 0; index < body.length; index += 1) {
    const candidate = [...body.slice(index), ...body.slice(0, index)];
    if (candidate.join(">") < best.join(">")) best = candidate;
  }

  return [...best, best[0]];
}

function buildSuccessorMap(tasks: Task[]): Map<string, string[]> {
  const successors = new Map<string, string[]>();

  for (const task of tasks) {
    for (const dependencyId of task.dependencies ?? []) {
      const existing = successors.get(dependencyId) ?? [];
      existing.push(task.id);
      successors.set(dependencyId, existing);
    }
  }

  return successors;
}

function buildTaskMap(tasks: Task[]): Map<string, Task> {
  return new Map(tasks.map((task) => [task.id, task]));
}

export function validateSchedule(tasks: Task[]): ScheduleValidationResult {
  const taskMap = buildTaskMap(tasks);
  const state = new Map<string, "visiting" | "visited">();
  const order: string[] = [];
  const cycles: string[][] = [];
  const cycleKeys = new Set<string>();
  const missingDependencies = Array.from(
    new Set(
      tasks.flatMap((task) => (task.dependencies ?? []).filter((dependencyId) => !taskMap.has(dependencyId))),
    ),
  ).sort();

  const visit = (taskId: string, trail: string[]) => {
    const status = state.get(taskId);
    if (status === "visited") return;
    if (status === "visiting") {
      const startIndex = trail.indexOf(taskId);
      const cycle = dedupeCycle([...trail.slice(startIndex), taskId]);
      const key = cycle.join(">");
      if (!cycleKeys.has(key)) {
        cycleKeys.add(key);
        cycles.push(cycle);
      }
      return;
    }

    state.set(taskId, "visiting");
    const task = taskMap.get(taskId);
    if (task) {
      for (const dependencyId of task.dependencies ?? []) {
        if (!taskMap.has(dependencyId)) continue;
        visit(dependencyId, [...trail, taskId]);
      }
    }

    state.set(taskId, "visited");
    order.push(taskId);
  };

  for (const task of tasks) {
    visit(task.id, []);
  }

  return {
    isValid: cycles.length === 0 && missingDependencies.length === 0,
    cycles,
    missingDependencies,
    order,
  };
}

export function detectCircularDependencies(tasks: Task[]): string[][] {
  return validateSchedule(tasks).cycles;
}

export function detectGaps(tasks: Task[]): ScheduleGap[] {
  const taskMap = buildTaskMap(tasks);
  const gaps: ScheduleGap[] = [];

  for (const task of tasks) {
    if (!task.startDate) continue;

    for (const dependencyId of task.dependencies ?? []) {
      const predecessor = taskMap.get(dependencyId);
      const predecessorEndDate = predecessor ? getTaskEndDate(predecessor) : undefined;
      if (!predecessorEndDate) continue;

      const gapDays = Math.max(0, daysBetween(predecessorEndDate, task.startDate) - 1);
      if (gapDays > 0) {
        gaps.push({
          predecessorId: dependencyId,
          successorId: task.id,
          predecessorEndDate,
          successorStartDate: task.startDate,
          gapDays,
        });
      }
    }
  }

  return gaps.sort((left, right) => right.gapDays - left.gapDays || left.successorId.localeCompare(right.successorId));
}

export function detectOverlaps(tasks: Task[], contractors: Contractor[]): ContractorOverlap[] {
  const contractorNames = new Map(contractors.map((contractor) => [contractor.id, contractor.name]));
  const grouped = new Map<string, Task[]>();

  for (const task of tasks) {
    if (!task.contractorId || !task.startDate || !getTaskEndDate(task)) continue;
    const existing = grouped.get(task.contractorId) ?? [];
    existing.push(task);
    grouped.set(task.contractorId, existing);
  }

  const overlaps: ContractorOverlap[] = [];

  for (const [contractorId, contractorTasks] of grouped.entries()) {
    const scheduledTasks = contractorTasks
      .filter((task): task is Task & { startDate: string; dueDate?: string } => Boolean(task.startDate && getTaskEndDate(task)))
      .sort((left, right) => left.startDate!.localeCompare(right.startDate!));

    for (let index = 0; index < scheduledTasks.length; index += 1) {
      const current = scheduledTasks[index];
      const currentEnd = getTaskEndDate(current)!;

      for (let nextIndex = index + 1; nextIndex < scheduledTasks.length; nextIndex += 1) {
        const next = scheduledTasks[nextIndex];
        if (next.startDate! > currentEnd) break;

        const nextEnd = getTaskEndDate(next)!;
        const overlapStart = current.startDate! > next.startDate! ? current.startDate! : next.startDate!;
        const overlapEnd = currentEnd < nextEnd ? currentEnd : nextEnd;
        const overlapDays = daysBetween(overlapStart, overlapEnd) + 1;

        if (overlapDays > 0) {
          overlaps.push({
            contractorId,
            contractorName: contractorNames.get(contractorId) ?? contractorId,
            firstTaskId: current.id,
            secondTaskId: next.id,
            overlapStart,
            overlapEnd,
            overlapDays,
          });
        }
      }
    }
  }

  return overlaps.sort((left, right) => right.overlapDays - left.overlapDays || left.contractorName.localeCompare(right.contractorName));
}

export function detectContractorConflicts(tasks: Task[]): ContractorConflict[] {
  return detectOverlaps(tasks, []);
}

export function criticalPath(tasks: Task[]): CriticalPathResult {
  const validation = validateSchedule(tasks);
  if (!validation.isValid) {
    const issues = [
      ...validation.cycles.map((cycle) => `Cycle detected: ${cycle.join(" -> ")}`),
      ...validation.missingDependencies.map((dependencyId) => `Missing dependency: ${dependencyId}`),
    ];

    return {
      taskIds: [],
      totalDuration: 0,
      totalSpanDays: 0,
      issues,
    };
  }

  const taskMap = buildTaskMap(tasks);
  const successors = buildSuccessorMap(tasks);
  const longestDurationTo = new Map<string, number>();
  const predecessorChoice = new Map<string, string | null>();

  for (const taskId of validation.order) {
    const task = taskMap.get(taskId);
    if (!task) continue;

    const duration = getTaskDuration(task);
    let bestDuration = duration;
    let bestPredecessor: string | null = null;

    for (const dependencyId of task.dependencies ?? []) {
      const predecessorDuration = longestDurationTo.get(dependencyId);
      if (predecessorDuration == null) continue;

      const candidateDuration = predecessorDuration + duration;
      if (candidateDuration > bestDuration) {
        bestDuration = candidateDuration;
        bestPredecessor = dependencyId;
      }
    }

    longestDurationTo.set(taskId, bestDuration);
    predecessorChoice.set(taskId, bestPredecessor);
  }

  let sinkTaskId: string | null = null;
  let bestTotalDuration = 0;

  for (const taskId of validation.order) {
    if ((successors.get(taskId) ?? []).length > 0) continue;
    const totalDuration = longestDurationTo.get(taskId) ?? 0;
    if (totalDuration > bestTotalDuration) {
      bestTotalDuration = totalDuration;
      sinkTaskId = taskId;
    }
  }

  if (!sinkTaskId && validation.order.length > 0) {
    sinkTaskId = validation.order[validation.order.length - 1];
    bestTotalDuration = longestDurationTo.get(sinkTaskId) ?? 0;
  }

  const path: string[] = [];
  while (sinkTaskId) {
    path.unshift(sinkTaskId);
    sinkTaskId = predecessorChoice.get(sinkTaskId) ?? null;
  }

  const datedTasks = path
    .map((taskId) => taskMap.get(taskId))
    .filter((task): task is Task => Boolean(task))
    .filter((task) => Boolean(task.startDate && getTaskEndDate(task)));

  const totalSpanDays =
    datedTasks.length === path.length && datedTasks.length > 0
      ? Math.max(1, daysBetween(datedTasks[0].startDate!, getTaskEndDate(datedTasks[datedTasks.length - 1])!) + 1)
      : bestTotalDuration;

  return {
    taskIds: path,
    totalDuration: bestTotalDuration,
    totalSpanDays,
    issues: [],
  };
}

export function findCriticalPath(tasks: Task[]): CriticalPathResult {
  return criticalPath(tasks);
}

export function calculateSlack(tasks: Task[]): TaskSlack[] {
  const validation = validateSchedule(tasks);
  if (!validation.isValid) return [];

  const taskMap = buildTaskMap(tasks);
  const successors = buildSuccessorMap(tasks);
  const earliestStart = new Map<string, number>();
  const earliestFinish = new Map<string, number>();

  for (const taskId of validation.order) {
    const task = taskMap.get(taskId);
    if (!task) continue;

    const duration = getTaskDuration(task);
    const es = Math.max(0, ...(task.dependencies ?? []).map((dependencyId) => earliestFinish.get(dependencyId) ?? 0));
    earliestStart.set(taskId, es);
    earliestFinish.set(taskId, es + duration);
  }

  const projectDuration = Math.max(0, ...Array.from(earliestFinish.values()));
  const latestStart = new Map<string, number>();
  const latestFinish = new Map<string, number>();

  for (const taskId of [...validation.order].reverse()) {
    const task = taskMap.get(taskId);
    if (!task) continue;

    const duration = getTaskDuration(task);
    const taskSuccessors = successors.get(taskId) ?? [];
    const lf =
      taskSuccessors.length > 0
        ? Math.min(...taskSuccessors.map((successorId) => latestStart.get(successorId) ?? projectDuration))
        : projectDuration;
    latestFinish.set(taskId, lf);
    latestStart.set(taskId, lf - duration);
  }

  return tasks.map((task) => {
    const ef = earliestFinish.get(task.id) ?? getTaskDuration(task);
    const es = earliestStart.get(task.id) ?? 0;
    const ls = latestStart.get(task.id) ?? es;
    const taskSuccessors = successors.get(task.id) ?? [];
    const freeSlack =
      taskSuccessors.length > 0
        ? Math.max(0, Math.min(...taskSuccessors.map((successorId) => earliestStart.get(successorId) ?? ef)) - ef)
        : Math.max(0, projectDuration - ef);
    const totalSlack = Math.max(0, ls - es);

    return {
      taskId: task.id,
      freeSlack,
      totalSlack,
      isCritical: totalSlack === 0,
    };
  });
}

export function suggestOptimization(tasks: Task[]): ScheduleOptimizationSuggestion[] {
  const validation = validateSchedule(tasks);
  if (validation.cycles.length > 0) {
    return validation.cycles.map((cycle) => ({
      type: "resolve_cycle",
      impactDays: 0,
      taskIds: cycle.slice(0, -1),
      message: `Resolve the circular dependency ${cycle.join(" -> ")} before resequencing work.`,
    }));
  }

  const suggestions: ScheduleOptimizationSuggestion[] = [];
  const critical = criticalPath(tasks);
  const criticalTaskIds = new Set(critical.taskIds);
  const slackByTask = new Map(calculateSlack(tasks).map((item) => [item.taskId, item]));
  const taskMap = buildTaskMap(tasks);

  for (const gap of detectGaps(tasks)) {
    if (!criticalTaskIds.has(gap.predecessorId) || !criticalTaskIds.has(gap.successorId)) continue;

    suggestions.push({
      type: "close_gap",
      impactDays: gap.gapDays,
      taskIds: [gap.predecessorId, gap.successorId],
      message: `Pull ${gap.successorId} forward by ${gap.gapDays} day(s) after ${gap.predecessorId} to remove idle time on the critical path.`,
    });
  }

  for (const overlap of detectOverlaps(tasks, [])) {
    suggestions.push({
      type: "reassign_contractor",
      impactDays: overlap.overlapDays,
      taskIds: [overlap.firstTaskId, overlap.secondTaskId],
      message: `Reassign or stagger ${overlap.firstTaskId} and ${overlap.secondTaskId}; contractor ${overlap.contractorName} is double-booked for ${overlap.overlapDays} day(s).`,
    });
  }

  const longestCriticalTasks = critical.taskIds
    .map((taskId) => taskMap.get(taskId))
    .filter((task): task is Task => Boolean(task))
    .map((task) => ({ task, duration: getTaskDuration(task) }))
    .filter(({ duration }) => duration >= 3)
    .sort((left, right) => right.duration - left.duration);

  for (const { task, duration } of longestCriticalTasks.slice(0, 2)) {
    suggestions.push({
      type: "crash_task",
      impactDays: 1,
      taskIds: [task.id],
      message: `Consider adding labor, prefab, or split crews on ${task.name} to reduce this ${duration}-day critical-path task.`,
    });
  }

  for (const task of tasks) {
    const slack = slackByTask.get(task.id);
    if (!slack || criticalTaskIds.has(task.id) || slack.totalSlack < 2) continue;

    suggestions.push({
      type: "parallelize",
      impactDays: 0,
      taskIds: [task.id],
      message: `${task.id} has ${slack.totalSlack} day(s) of total slack and can shift to free crews for critical-path work.`,
    });
  }

  return suggestions
    .sort((left, right) => right.impactDays - left.impactDays || left.message.localeCompare(right.message))
    .slice(0, 5);
}
