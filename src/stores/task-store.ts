import type { Task } from "../domain/types.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import type { Repository } from "../domain/repository.js";

export function createTaskRepository(
  getOrganizationId?: () => string | null,
): Repository<Task> {
  return createAppRepository<Task>("tasks", getOrganizationId);
}
