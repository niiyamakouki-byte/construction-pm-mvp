import type { Resource } from "../domain/types.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import type { Repository } from "../domain/repository.js";

export function createResourceRepository(
  getOrganizationId?: () => string | null,
): Repository<Resource> {
  return createAppRepository<Resource>("resources", getOrganizationId);
}
