import type { CostItem } from "../domain/types.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import type { Repository } from "../domain/repository.js";

export function createCostItemRepository(
  getOrganizationId?: () => string | null,
): Repository<CostItem> {
  return createAppRepository<CostItem>("cost_items", getOrganizationId);
}
