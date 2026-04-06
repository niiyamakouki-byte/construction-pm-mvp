export { requireApiKey } from "./api-key.js";
import { ApiError } from "./types.js";
import type {
  ApiContractorRecord,
  ApiProjectRecord,
  ApiStore,
  ApiTaskRecord,
} from "./types.js";

export async function requireExistingProject(
  store: ApiStore,
  projectId: string,
): Promise<ApiProjectRecord> {
  const project = await store.getProject(projectId);
  if (!project) {
    throw new ApiError(404, "指定されたプロジェクトが見つかりません。");
  }

  return project;
}

export async function requireExistingTask(store: ApiStore, taskId: string): Promise<ApiTaskRecord> {
  const task = await store.getTask(taskId);
  if (!task) {
    throw new ApiError(404, "指定されたタスクが見つかりません。");
  }

  return task;
}

export async function requireExistingContractor(
  store: ApiStore,
  contractorId: string,
): Promise<ApiContractorRecord> {
  const contractor = await store.getContractor(contractorId);
  if (!contractor) {
    throw new ApiError(404, "指定された業者が見つかりません。");
  }

  return contractor;
}

export async function resolveTaskContractor(
  store: ApiStore,
  contractorId: string | undefined | null,
): Promise<{ contractorId?: string | null; contractor?: string | null }> {
  if (contractorId === undefined) {
    return {};
  }
  if (contractorId === null) {
    return { contractorId: null, contractor: null };
  }

  const contractor = await requireExistingContractor(store, contractorId);
  return {
    contractorId: contractor.id,
    contractor: contractor.name,
  };
}

export async function wouldCreateDependencyCycle(
  store: ApiStore,
  taskId: string,
  predecessorId: string,
): Promise<boolean> {
  const taskMap = new Map((await store.listAllTasks()).map((task) => [task.id, task]));
  const queue = [predecessorId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) {
      continue;
    }
    if (currentId === taskId) {
      return true;
    }

    visited.add(currentId);
    const currentTask = taskMap.get(currentId);
    if (!currentTask) {
      continue;
    }

    for (const dependency of currentTask.dependencies) {
      if (!visited.has(dependency.predecessorId)) {
        queue.push(dependency.predecessorId);
      }
    }
  }

  return false;
}
