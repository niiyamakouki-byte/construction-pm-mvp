import type { Project } from "../domain/types.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import type { Repository } from "../domain/repository.js";

export function createProjectRepository(
  getOrganizationId?: () => string | null,
): Repository<Project> {
  return createAppRepository<Project>("projects", getOrganizationId);
}

// Singleton for test helpers that need direct repository access (e.g. cleanup).
// In test mode this returns the shared InMemoryRepository instance.
export const projectRepository = createProjectRepository();
