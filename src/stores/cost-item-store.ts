import type { CostItem } from "../domain/types.js";
import { createAppRepository } from "../infra/create-app-repository.js";

export const costItemRepository = createAppRepository<CostItem>("cost_items");
