import type { Contractor } from "../domain/types.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import type { Repository } from "../domain/repository.js";

export function createContractorRepository(
  getOrganizationId?: () => string | null,
): Repository<Contractor> {
  return createAppRepository<Contractor>("contractors", getOrganizationId);
}
