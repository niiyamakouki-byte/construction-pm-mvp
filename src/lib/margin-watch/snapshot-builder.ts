/**
 * Snapshot builder — constructs ProjectFinanceSnapshot from available stores.
 *
 * Uses:
 *   - order-management: listOrders() for actual cost (totalWithTax of 検収済/請求済/支払済)
 *   - store (project): getProject() for contractAmountYen (falls back to project.budget)
 *   - cost-management: CostRow accumulation as alternative cost source
 *
 * Estimated remaining cost is approximated as:
 *   sum of (発注済 + 納品待ち orders) — i.e. committed but not yet inspected costs.
 */

import type { ProjectFinanceSnapshot } from "./types.js";
import { listOrders } from "../order-management.js";
import { getProject } from "../store.js";

/** Status sets for cost calculation */
const ACTUAL_COST_STATUSES = new Set(["検収済", "請求済", "支払済"]);
const COMMITTED_STATUSES = new Set(["発注済", "納品待ち", "納品済"]);

/**
 * Build a ProjectFinanceSnapshot from the in-memory stores.
 *
 * Returns null if the project does not exist.
 */
export function buildSnapshotFromProject(
  projectId: string,
): ProjectFinanceSnapshot | null {
  const project = getProject(projectId);
  if (!project) return null;

  const orders = listOrders(projectId);

  // Actual cost: confirmed orders (検収済 and beyond)
  const totalCostYen = orders
    .filter((o) => ACTUAL_COST_STATUSES.has(o.status))
    .reduce((sum, o) => sum + o.totalWithTax, 0);

  // Estimated remaining: committed (発注済/納品待ち/納品済) but not yet inspected
  const estimatedRemainingCostYen = orders
    .filter((o) => COMMITTED_STATUSES.has(o.status))
    .reduce((sum, o) => sum + o.totalWithTax, 0);

  // Contract amount: use project.budget as proxy (no ContractStore exists yet)
  const contractAmountYen = project.budget ?? 0;

  const marginRatioPct =
    contractAmountYen > 0
      ? ((contractAmountYen - totalCostYen) / contractAmountYen) * 100
      : 0;

  const forecastMarginRatioPct =
    contractAmountYen > 0
      ? ((contractAmountYen - totalCostYen - estimatedRemainingCostYen) /
          contractAmountYen) *
        100
      : 0;

  return {
    projectId,
    projectName: project.name,
    contractAmountYen,
    totalCostYen,
    estimatedRemainingCostYen,
    marginRatioPct,
    forecastMarginRatioPct,
  };
}
