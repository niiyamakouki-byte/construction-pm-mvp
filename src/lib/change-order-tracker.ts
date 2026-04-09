import type { Task } from "../domain/types.js";

export type ChangeOrderStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "implemented";

export type ChangeOrderImpact = {
  costDelta: number;
  scheduleDeltaDays: number;
  affectedTaskIds: string[];
};

export type ChangeOrder = {
  id: string;
  projectId: string;
  description: string;
  requestedBy: string;
  dateRequested: string;
  impact: ChangeOrderImpact;
  status: ChangeOrderStatus;
  notes?: string;
};

export type ChangeLogEntry = {
  order: ChangeOrder;
  cumulativeCostDelta: number;
  cumulativeScheduleDelta: number;
};

// In-memory store (per-module singleton, matches project patterns)
const changeOrders: ChangeOrder[] = [];

/**
 * Record a new change order.
 */
export function createChangeOrder(order: ChangeOrder): ChangeOrder {
  changeOrders.push({ ...order });
  return order;
}

/**
 * Get all change orders (optionally filtered by projectId).
 */
export function getChangeOrders(projectId?: string): ChangeOrder[] {
  if (!projectId) return [...changeOrders];
  return changeOrders.filter((o) => o.projectId === projectId);
}

/**
 * Clear all stored change orders (for testing).
 */
export function clearChangeOrders(): void {
  changeOrders.length = 0;
}

/**
 * Assess the impact of a change order against the current schedule.
 * Returns estimated cost and schedule impact.
 */
export function assessImpact(
  order: ChangeOrder,
  currentSchedule: Task[],
): {
  estimatedCostImpact: number;
  estimatedScheduleImpact: number;
  affectedTasks: Task[];
  riskLevel: "low" | "medium" | "high";
} {
  const affectedTasks = currentSchedule.filter((t) =>
    order.impact.affectedTaskIds.includes(t.id),
  );

  const estimatedCostImpact = order.impact.costDelta;
  const estimatedScheduleImpact = order.impact.scheduleDeltaDays;

  let riskLevel: "low" | "medium" | "high" = "low";
  if (Math.abs(estimatedCostImpact) > 1000000 || Math.abs(estimatedScheduleImpact) > 14) {
    riskLevel = "high";
  } else if (Math.abs(estimatedCostImpact) > 500000 || Math.abs(estimatedScheduleImpact) > 7) {
    riskLevel = "medium";
  }

  return {
    estimatedCostImpact,
    estimatedScheduleImpact,
    affectedTasks,
    riskLevel,
  };
}

/**
 * Generate a changelog showing all change orders for a project
 * with cumulative cost and schedule impact.
 */
export function generateChangeLog(projectId: string): ChangeLogEntry[] {
  const projectOrders = changeOrders
    .filter((o) => o.projectId === projectId)
    .sort((a, b) => a.dateRequested.localeCompare(b.dateRequested));

  let cumulativeCost = 0;
  let cumulativeSchedule = 0;

  return projectOrders.map((order) => {
    cumulativeCost += order.impact.costDelta;
    cumulativeSchedule += order.impact.scheduleDeltaDays;
    return {
      order,
      cumulativeCostDelta: cumulativeCost,
      cumulativeScheduleDelta: cumulativeSchedule,
    };
  });
}
