import type { Project } from "../domain/types.js";
import {
  calculateEarnedValue,
  calculateProjectProgress,
  costPerformanceIndex,
  estimateAtCompletion,
  schedulePerformanceIndex,
  type ActualCostsInput,
  type EarnedValueMetrics,
  type ProgressTask,
} from "./earned-value.js";
import { criticalPath } from "./schedule-validator.js";

export type { ActualCostsInput, EarnedValueMetrics, ProgressTask };

export {
  calculateEarnedValue,
  calculateProjectProgress,
  costPerformanceIndex,
  estimateAtCompletion,
  schedulePerformanceIndex,
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return "N/A";
  return round(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function generateProgressReport(
  project: Project,
  tasks: ProgressTask[],
  asOfDate = new Date().toISOString().slice(0, 10),
): string {
  const budget = project.budget ?? 0;
  const progress = calculateProjectProgress(tasks);
  const evm = calculateEarnedValue(tasks, budget, asOfDate);
  const spi = schedulePerformanceIndex(tasks, budget, asOfDate);
  const cpi = costPerformanceIndex(tasks, undefined, budget, asOfDate);
  const eac = estimateAtCompletion(evm.bac, cpi);
  const completedTasks = tasks.filter((task) => task.status === "done").length;
  const overdueTasks = tasks.filter((task) => task.status !== "done" && task.dueDate && task.dueDate < asOfDate).length;
  const critical = criticalPath(tasks);
  const criticalPathNames = critical.taskIds
    .map((taskId) => tasks.find((task) => task.id === taskId)?.name ?? taskId)
    .join(" -> ");

  return [
    `Progress Report: ${project.name}`,
    `Status: ${project.status}`,
    `Overall Progress: ${formatValue(progress)}%`,
    `Completed Tasks: ${completedTasks}/${tasks.length}`,
    `Overdue Tasks: ${overdueTasks}`,
    `EV: ${formatValue(evm.ev)}  PV: ${formatValue(evm.pv)}  AC: ${formatValue(evm.ac)}`,
    `SPI: ${formatValue(spi)}  CPI: ${formatValue(cpi)}  EAC: ${formatValue(eac)}`,
    `Critical Path: ${criticalPathNames || "None"}`,
  ].join("\n");
}
