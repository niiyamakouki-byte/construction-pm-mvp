import { InMemoryRepository } from "../infra/in-memory-repository.js";
import type { Project } from "../domain/types.js";

export const projectRepository = new InMemoryRepository<Project>();
