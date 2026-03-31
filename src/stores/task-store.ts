import type { Task } from "../domain/types.js";
import { createAppRepository } from "../infra/create-app-repository.js";

export const taskRepository = createAppRepository<Task>("tasks");
