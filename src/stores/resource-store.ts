import type { Resource } from "../domain/types.js";
import { createAppRepository } from "../infra/create-app-repository.js";

export const resourceRepository = createAppRepository<Resource>("resources");
