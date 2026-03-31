import type { Project } from "../domain/types.js";
import { createAppRepository } from "../infra/create-app-repository.js";

export const projectRepository = createAppRepository<Project>("projects");
