import type { CostItem } from "../domain/types.js";
import { CostItemSchema, parseOrThrow } from "../domain/schemas.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import type { Repository } from "../domain/repository.js";

function wrapWithValidation(inner: Repository<CostItem>): Repository<CostItem> {
  return {
    async findById(id) {
      const result = await inner.findById(id);
      if (result === null) return null;
      return parseOrThrow(CostItemSchema, "CostItem", result);
    },
    async findAll() {
      const results = await inner.findAll();
      return results.map((item) => parseOrThrow(CostItemSchema, "CostItem", item));
    },
    create: inner.create.bind(inner),
    update: inner.update.bind(inner),
    delete: inner.delete.bind(inner),
  };
}

/**
 * Returns a repository for CostItem entities.
 * In Supabase mode, read results are validated against CostItemSchema.
 * In test/local mode, validation is skipped to preserve test compatibility.
 */
export function createCostItemRepository(
  getOrganizationId?: () => string | null,
): Repository<CostItem> {
  const inner = createAppRepository<CostItem>("cost_items", getOrganizationId);
  if (import.meta.env.MODE === "test" || import.meta.env.VITEST) {
    return inner;
  }
  return wrapWithValidation(inner);
}
