import type { ProjectPaymentPlan } from "../domain/types.js";
import { ProjectPaymentPlanSchema, parseOrWarn } from "../domain/schemas.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import type { Repository } from "../domain/repository.js";

function wrapWithValidation(
  inner: Repository<ProjectPaymentPlan>,
): Repository<ProjectPaymentPlan> {
  return {
    async findById(id) {
      const result = await inner.findById(id);
      if (result === null) return null;
      return parseOrWarn(ProjectPaymentPlanSchema, "ProjectPaymentPlan", result);
    },
    async findAll() {
      const results = await inner.findAll();
      return results.map((item) =>
        parseOrWarn(ProjectPaymentPlanSchema, "ProjectPaymentPlan", item),
      );
    },
    create: inner.create.bind(inner),
    update: inner.update.bind(inner),
    delete: inner.delete.bind(inner),
  };
}

/**
 * Task #41: 入金計画 Repository。
 * Supabase 側のテーブル名は project_payment_plans (要 apply_migration 後動作)
 */
export function createPaymentPlanRepository(
  getOrganizationId?: () => string | null,
): Repository<ProjectPaymentPlan> {
  const inner = createAppRepository<ProjectPaymentPlan>(
    "project_payment_plans",
    getOrganizationId,
  );
  if (import.meta.env.MODE === "test" || import.meta.env.VITEST) {
    return inner;
  }
  return wrapWithValidation(inner);
}

export const paymentPlanRepository = createPaymentPlanRepository();
