import type { Project, Task, TaskStatus } from "../domain/types.js";
import { daysBetween } from "../components/gantt/utils.js";

export type ProgressTask = Task & {
  plannedCost?: number;
  actualCost?: number;
};

export type ActualCostsInput =
  | number
  | Record<string, number>
  | Array<{ taskId?: string; cost?: number; amount?: number }>;

export type EarnedValueMetrics = {
  ev: number;
  pv: number;
  ac: number;
  bac: number;
  percentComplete: number;
  plannedPercentComplete: number;
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function getTaskEndDate(task: ProgressTask): string | undefined {
  return task.dueDate ?? task.startDate;
}

function getTaskDuration(task: ProgressTask): number {
  if (!task.startDate || !getTaskEndDate(task)) return 1;
  return Math.max(1, daysBetween(task.startDate, getTaskEndDate(task)!) + 1);
}

function getFallbackProgress(status: TaskStatus): number {
  if (status === "done") return 100;
  if (status === "in_progress") return 50;
  return 0;
}

function getActualProgress(task: ProgressTask): number {
  return clampPercentage(task.progress ?? getFallbackProgress(task.status));
}

function inferBudget(tasks: ProgressTask[], budget?: number): number {
  if (typeof budget === "number" && budget > 0) return budget;
  const plannedCostTotal = tasks.reduce((sum, task) => sum + Math.max(0, task.plannedCost ?? 0), 0);
  if (plannedCostTotal > 0) return plannedCostTotal;
  return Math.max(1, tasks.reduce((sum, task) => sum + getTaskDuration(task), 0));
}

function getTaskWeights(tasks: ProgressTask[]): Map<string, number> {
  const hasPlannedCosts = tasks.some((task) => (task.plannedCost ?? 0) > 0);
  return new Map(
    tasks.map((task) => [task.id, hasPlannedCosts ? Math.max(0, task.plannedCost ?? 0) : getTaskDuration(task)]),
  );
}

function getPlannedPercent(task: ProgressTask, asOfDate: string): number {
  if (!task.startDate || !getTaskEndDate(task)) {
    return getActualProgress(task) / 100;
  }

  const endDate = getTaskEndDate(task)!;
  if (asOfDate < task.startDate) return 0;
  if (asOfDate >= endDate) return 1;

  const totalDuration = getTaskDuration(task);
  const elapsedDays = Math.max(1, daysBetween(task.startDate, asOfDate) + 1);
  return Math.max(0, Math.min(1, elapsedDays / totalDuration));
}

function resolveActualCost(actualCosts: ActualCostsInput | undefined, fallbackAc: number): number {
  if (typeof actualCosts === "number") return actualCosts;

  if (Array.isArray(actualCosts)) {
    return actualCosts.reduce((sum, item) => sum + Math.max(0, item.cost ?? item.amount ?? 0), 0);
  }

  if (actualCosts) {
    return Object.values(actualCosts).reduce((sum, cost) => sum + Math.max(0, cost), 0);
  }

  return fallbackAc;
}

function safeRatio(numerator: number, denominator: number): number {
  if (denominator === 0) return numerator === 0 ? 1 : Number.POSITIVE_INFINITY;
  return round(numerator / denominator);
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return "N/A";
  return round(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function isProgressTaskArray(value: ProgressTask[] | ActualCostsInput): value is ProgressTask[] {
  return Array.isArray(value) && value.every((item) => typeof item === "object" && item !== null && "status" in item);
}

export function calculateProjectProgress(tasks: ProgressTask[]): number {
  if (tasks.length === 0) return 0;

  const weightedProgress = tasks.reduce(
    (sum, task) => sum + getTaskDuration(task) * getActualProgress(task),
    0,
  );
  const totalWeight = tasks.reduce((sum, task) => sum + getTaskDuration(task), 0);

  return totalWeight === 0 ? 0 : round(weightedProgress / totalWeight);
}

export function calculateEarnedValue(
  tasks: ProgressTask[],
  budget: number,
  asOfDate = new Date().toISOString().slice(0, 10),
): EarnedValueMetrics {
  const bac = inferBudget(tasks, budget);
  const weights = getTaskWeights(tasks);
  const totalWeight = Math.max(1, Array.from(weights.values()).reduce((sum, weight) => sum + weight, 0));

  let ev = 0;
  let pv = 0;
  let ac = 0;

  for (const task of tasks) {
    const taskBudget = (bac * (weights.get(task.id) ?? 0)) / totalWeight;
    const actualPercent = getActualProgress(task) / 100;
    const plannedPercent = getPlannedPercent(task, asOfDate);

    ev += taskBudget * actualPercent;
    pv += taskBudget * plannedPercent;
    ac += task.actualCost ?? taskBudget * actualPercent;
  }

  return {
    ev: round(ev),
    pv: round(pv),
    ac: round(ac),
    bac: round(bac),
    percentComplete: calculateProjectProgress(tasks),
    plannedPercentComplete: bac === 0 ? 0 : round((pv / bac) * 100),
  };
}

export function schedulePerformanceIndex(
  tasks: ProgressTask[],
  budget = 0,
  asOfDate = new Date().toISOString().slice(0, 10),
): number {
  const metrics = calculateEarnedValue(tasks, budget, asOfDate);
  return safeRatio(metrics.ev, metrics.pv);
}

export function costPerformanceIndex(
  tasks: ProgressTask[],
  actualCosts?: ActualCostsInput,
  budget?: number,
  asOfDate?: string,
): number;
export function costPerformanceIndex(
  actualCosts: ActualCostsInput,
  budget: number,
): number;
export function costPerformanceIndex(
  tasksOrCosts: ProgressTask[] | ActualCostsInput,
  actualCostsOrBudget?: ActualCostsInput | number,
  budget = 0,
  asOfDate = new Date().toISOString().slice(0, 10),
): number {
  if (isProgressTaskArray(tasksOrCosts)) {
    const metrics = calculateEarnedValue(tasksOrCosts, budget, asOfDate);
    const actualCost = resolveActualCost(
      typeof actualCostsOrBudget === "number" ? undefined : actualCostsOrBudget,
      metrics.ac,
    );
    return safeRatio(metrics.ev, actualCost);
  }

  const actualCost = resolveActualCost(tasksOrCosts, 0);
  return safeRatio(typeof actualCostsOrBudget === "number" ? actualCostsOrBudget : budget, actualCost);
}

export function estimateAtCompletion(budget: number, cpi: number): number {
  if (!Number.isFinite(cpi) || cpi <= 0) return Number.POSITIVE_INFINITY;
  return round(budget / cpi);
}

export function generateEVReport(
  project: Project,
  tasks: ProgressTask[],
  actualCosts?: ActualCostsInput,
  asOfDate = new Date().toISOString().slice(0, 10),
): string {
  const budget = project.budget ?? 0;
  const metrics = calculateEarnedValue(tasks, budget, asOfDate);
  const spi = schedulePerformanceIndex(tasks, budget, asOfDate);
  const cpi = costPerformanceIndex(tasks, actualCosts, budget, asOfDate);
  const eac = estimateAtCompletion(metrics.bac, cpi);
  const completedTasks = tasks.filter((task) => task.status === "done").length;

  return [
    `Earned Value Report: ${project.name}`,
    `Status: ${project.status}`,
    `Budget (BAC): ${formatValue(metrics.bac)}`,
    `EV: ${formatValue(metrics.ev)}  PV: ${formatValue(metrics.pv)}  AC: ${formatValue(
      resolveActualCost(actualCosts, metrics.ac),
    )}`,
    `SPI: ${formatValue(spi)}  CPI: ${formatValue(cpi)}  EAC: ${formatValue(eac)}`,
    `Progress: ${formatValue(metrics.percentComplete)}% actual vs ${formatValue(metrics.plannedPercentComplete)}% planned`,
    `Completed Tasks: ${completedTasks}/${tasks.length}`,
  ].join("\n");
}
