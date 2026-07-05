import type { Task } from "../domain/types.js";
import { TaskSchema, parseOrWarn } from "../domain/schemas.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import type { Repository } from "../domain/repository.js";

function wrapWithValidation(inner: Repository<Task>): Repository<Task> {
  return {
    async findById(id) {
      const result = await inner.findById(id);
      if (result === null) return null;
      return parseOrWarn(TaskSchema, "Task", result);
    },
    async findAll() {
      const results = await inner.findAll();
      return results.map((item) => parseOrWarn(TaskSchema, "Task", item));
    },
    create: inner.create.bind(inner),
    update: inner.update.bind(inner),
    delete: inner.delete.bind(inner),
  };
}

/**
 * Marking a task "done" without also touching its progress field leaves a
 * stale progress value (often 0) in storage. Several call sites only patch
 * `status` on a quick status change (e.g. TodayDashboardPage/ProjectDetailPage
 * handleStatusChange), which produced completed tasks stuck at "0%" in every
 * screen that reads the raw progress field instead of going through the
 * Gantt-only effectiveProgress() display helper (regression
 * construction_pm_mvp-7ry / construction_pm_mvp-e0q).
 *
 * This wrapper is the single write-path choke point for task updates, so it
 * normalizes progress to 100 whenever a patch sets status to "done" —
 * matching the same unconditional rule already used everywhere progress is
 * displayed (effectiveProgress()/getActualProgress(): "done" always reads as
 * 100% regardless of the stored value) and by TaskEditModal's own
 * done→100/todo→0 sync. A progress value included in the same patch is
 * overridden, same as TaskEditModal already does.
 */
function withProgressSync(inner: Repository<Task>): Repository<Task> {
  return {
    findById: inner.findById.bind(inner),
    findAll: inner.findAll.bind(inner),
    create: inner.create.bind(inner),
    async update(id, fields) {
      const patch = fields.status === "done" ? { ...fields, progress: 100 } : fields;
      return inner.update(id, patch);
    },
    delete: inner.delete.bind(inner),
  };
}

/**
 * Returns a repository for Task entities.
 * In Supabase mode, read results are validated against TaskSchema.
 * In test/local mode, validation is skipped to preserve test compatibility.
 * Progress/status sync (see withProgressSync) applies in both modes.
 */
export function createTaskRepository(
  getOrganizationId?: () => string | null,
): Repository<Task> {
  const inner = withProgressSync(createAppRepository<Task>("tasks", getOrganizationId));
  if (import.meta.env.MODE === "test" || import.meta.env.VITEST) {
    return inner;
  }
  return wrapWithValidation(inner);
}
