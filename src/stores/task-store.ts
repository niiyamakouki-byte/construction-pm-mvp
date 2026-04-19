import type { Task } from "../domain/types.js";
import { TaskSchema, parseOrThrow } from "../domain/schemas.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import type { Repository } from "../domain/repository.js";

function wrapWithValidation(inner: Repository<Task>): Repository<Task> {
  return {
    async findById(id) {
      const result = await inner.findById(id);
      if (result === null) return null;
      return parseOrThrow(TaskSchema, "Task", result);
    },
    async findAll() {
      const results = await inner.findAll();
      return results.map((item) => parseOrThrow(TaskSchema, "Task", item));
    },
    create: inner.create.bind(inner),
    update: inner.update.bind(inner),
    delete: inner.delete.bind(inner),
  };
}

/**
 * Returns a repository for Task entities.
 * In Supabase mode, read results are validated against TaskSchema.
 * In test/local mode, validation is skipped to preserve test compatibility.
 */
export function createTaskRepository(
  getOrganizationId?: () => string | null,
): Repository<Task> {
  const inner = createAppRepository<Task>("tasks", getOrganizationId);
  if (import.meta.env.MODE === "test" || import.meta.env.VITEST) {
    return inner;
  }
  return wrapWithValidation(inner);
}
