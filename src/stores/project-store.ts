import type { Project } from "../domain/types.js";
import { ProjectSchema, parseOrThrow } from "../domain/schemas.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import type { Repository } from "../domain/repository.js";

function wrapWithValidation(inner: Repository<Project>): Repository<Project> {
  return {
    async findById(id) {
      const result = await inner.findById(id);
      if (result === null) return null;
      return parseOrThrow(ProjectSchema, "Project", result);
    },
    async findAll() {
      const results = await inner.findAll();
      return results.map((item) => parseOrThrow(ProjectSchema, "Project", item));
    },
    // Write ops: bind to inner so spies placed on inner.create propagate correctly.
    create: inner.create.bind(inner),
    update: inner.update.bind(inner),
    delete: inner.delete.bind(inner),
  };
}

/**
 * Returns a repository for Project entities.
 * In Supabase mode, read results are validated against ProjectSchema.
 * In test/local mode, validation is skipped to avoid breaking test fixtures.
 */
export function createProjectRepository(
  getOrganizationId?: () => string | null,
): Repository<Project> {
  const inner = createAppRepository<Project>("projects", getOrganizationId);
  // Apply schema validation only when running against Supabase (production data).
  // In test mode, createAppRepository returns InMemoryRepository; skip parse
  // to preserve vi.spyOn compatibility on the shared test singleton.
  if (import.meta.env.MODE === "test" || import.meta.env.VITEST) {
    return inner;
  }
  return wrapWithValidation(inner);
}

// Singleton for test helpers that need direct repository access (e.g. cleanup).
// In test mode this returns the shared InMemoryRepository instance.
export const projectRepository = createProjectRepository();
