import type { ExecutionBudget } from "../domain/types.js";
import { ExecutionBudgetSchema, parseOrWarn } from "../domain/schemas.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import type { Repository } from "../domain/repository.js";

function wrapWithValidation(
  inner: Repository<ExecutionBudget>,
): Repository<ExecutionBudget> {
  return {
    async findById(id) {
      const result = await inner.findById(id);
      if (result === null) return null;
      return parseOrWarn(ExecutionBudgetSchema, "ExecutionBudget", result);
    },
    async findAll() {
      const results = await inner.findAll();
      return results.map((item) =>
        parseOrWarn(ExecutionBudgetSchema, "ExecutionBudget", item),
      );
    },
    create: inner.create.bind(inner),
    update: inner.update.bind(inner),
    delete: inner.delete.bind(inner),
  };
}

/**
 * Task #41: 実行予算 Repository。
 * Supabase 側のテーブル名は execution_budgets (要 apply_migration 後動作)
 */
export function createExecutionBudgetRepository(
  getOrganizationId?: () => string | null,
): Repository<ExecutionBudget> {
  const inner = createAppRepository<ExecutionBudget>(
    "execution_budgets",
    getOrganizationId,
  );
  if (import.meta.env.MODE === "test" || import.meta.env.VITEST) {
    return inner;
  }
  return wrapWithValidation(inner);
}

export const executionBudgetRepository = createExecutionBudgetRepository();
