/**
 * Metrics builder — constructs ProjectProfitMetrics from available stores.
 *
 * Uses:
 *   - store (project): getProject() / getProjects()
 *   - order-management: listOrders() for actual cost
 */

import type { ProjectProfitMetrics } from "./types.js";
import { getProject, getProjects } from "../store.js";
import { listOrders } from "../order-management.js";

/** Status sets for cost calculation (mirrors snapshot-builder) */
const ACTUAL_COST_STATUSES = new Set(["検収済", "請求済", "支払済"]);
const COMMITTED_STATUSES = new Set(["発注済", "納品待ち", "納品済"]);

/** Compute duration in months between two ISO date strings. Min 1 month. */
function computeDurationMonths(startDate: string, endDate?: string): number {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const months = diffMs / (1000 * 60 * 60 * 24 * 30.44);
  return Math.max(1, months);
}

/**
 * Build ProjectProfitMetrics for a single project.
 *
 * Returns null if the project does not exist.
 */
export function buildProjectMetrics(projectId: string): ProjectProfitMetrics | null {
  const project = getProject(projectId);
  if (!project) return null;

  const orders = listOrders(projectId);

  const actualCost = orders
    .filter((o) => ACTUAL_COST_STATUSES.has(o.status))
    .reduce((sum, o) => sum + o.totalWithTax, 0);

  const committedCost = orders
    .filter((o) => COMMITTED_STATUSES.has(o.status))
    .reduce((sum, o) => sum + o.totalWithTax, 0);

  const orderAmount = project.budget ?? 0;
  const forecastCost = actualCost + committedCost;

  const marginAmount = orderAmount - actualCost;

  const marginRatioPct =
    orderAmount > 0 ? (marginAmount / orderAmount) * 100 : 0;

  const forecastMarginRatioPct =
    orderAmount > 0
      ? ((orderAmount - forecastCost) / orderAmount) * 100
      : 0;

  const durationMonths = computeDurationMonths(project.startDate, project.endDate);
  const marginPerMonth = marginAmount / durationMonths;

  return {
    projectId,
    projectName: project.name,
    orderAmount,
    actualCost,
    forecastCost,
    marginAmount,
    marginRatioPct,
    forecastMarginRatioPct,
    durationMonths,
    marginPerMonth,
    clientName: project.address ?? "未登録",
    projectKind: project.description?.slice(0, 20) || "内装工事",
  };
}

/**
 * Build metrics for all projects in the store.
 */
export function buildAllProjectMetrics(): ProjectProfitMetrics[] {
  const projects = getProjects();
  const result: ProjectProfitMetrics[] = [];
  for (const p of projects) {
    const m = buildProjectMetrics(p.id);
    if (m !== null) result.push(m);
  }
  return result;
}
